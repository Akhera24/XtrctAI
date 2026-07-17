'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Redis = require('ioredis');

const { createApp } = require('../src/app');

/**
 * End-to-end tests over the real Express app with a stubbed X API.
 *
 * These assert the behavior the whole proxy exists for: never spend more than
 * the budget, never hammer a dead upstream, and never lie about where the data
 * came from.
 */

// db 14 — test files run in parallel under `node --test`, and each flushes its
// own db. Sharing one would have these two suites wipe each other mid-run.
const redis = new Redis(process.env.REDIS_TEST_URL || 'redis://127.0.0.1:6379/14');

test.before(async () => { await redis.flushdb(); });
test.after(async () => { await redis.quit(); });
test.beforeEach(async () => { await redis.flushdb(); });

/** Minimal axios stand-in that records calls and replays scripted responses. */
function stubHttp(handler) {
  const calls = [];
  return {
    calls,
    get: async (url, config) => {
      calls.push({ url, config });
      return handler(url, config, calls.length);
    },
  };
}

const userPayload = (name = 'jack') => ({
  data: { id: '12', name, username: name, public_metrics: { followers_count: 6_000_000 } },
});

const okResponse = (data) => ({ status: 200, data, headers: { 'x-rate-limit-remaining': '299' } });

/** Boots the app on an ephemeral port and returns a fetch helper. */
async function serve(t, opts) {
  const { app, client } = createApp(opts);
  const server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  const port = server.address().port;

  t.after(() => new Promise((r) => server.close(r)));

  const call = (path, body) =>
    fetch(`http://127.0.0.1:${port}${path}`, {
      method: body ? 'POST' : 'GET',
      headers: { 'content-type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });

  return { call, client, port };
}

test('proxies a valid request and labels it as live', async (t) => {
  const http = stubHttp(() => okResponse(userPayload()));
  const { call } = await serve(t, { http, redis, bearerToken: 'test-token' });

  const res = await call('/api/proxy', { endpoint: 'users/by/username/jack' });
  const body = await res.json();

  assert.equal(res.status, 200);
  assert.equal(body.data.data.username, 'jack');
  assert.equal(body.meta.source, 'x-api-v2:live');
  assert.equal(body.meta.degraded, false);
  assert.equal(http.calls.length, 1);
});

test('never forwards the bearer token to the client', async (t) => {
  const http = stubHttp(() => okResponse(userPayload()));
  const { call } = await serve(t, { http, redis, bearerToken: 'super-secret-token' });

  const res = await call('/api/proxy', { endpoint: 'users/by/username/jack' });
  const raw = await res.text();

  assert.ok(!raw.includes('super-secret-token'), 'the proxy is the trust boundary');
  assert.ok(!JSON.stringify([...res.headers]).includes('super-secret-token'));
});

test('serves the second identical request from cache without touching upstream', async (t) => {
  const http = stubHttp(() => okResponse(userPayload()));
  const { call } = await serve(t, { http, redis, bearerToken: 't' });

  await call('/api/proxy', { endpoint: 'users/by/username/jack' });
  const res = await call('/api/proxy', { endpoint: 'users/by/username/jack' });
  const body = await res.json();

  assert.equal(http.calls.length, 1, 'cache hit must not spend a token');
  assert.ok(body.meta.source.startsWith('cache'));
  assert.equal(res.headers.get('x-cache'), 'HIT');
});

test('coalesces concurrent identical requests into ONE upstream call', async (t) => {
  let resolveUpstream;
  const gate = new Promise((r) => { resolveUpstream = r; });
  const http = stubHttp(async () => { await gate; return okResponse(userPayload()); });

  const { call } = await serve(t, { http, redis, bearerToken: 't' });

  // 50 simultaneous requests for the same handle, none cached yet.
  const inflight = Array.from({ length: 50 }, () =>
    call('/api/proxy', { endpoint: 'users/by/username/jack' })
  );

  await new Promise((r) => setTimeout(r, 50)); // let them all arrive and coalesce
  resolveUpstream();

  const responses = await Promise.all(inflight);
  assert.ok(responses.every((r) => r.status === 200), 'all 50 callers get an answer');
  assert.equal(http.calls.length, 1, '50 concurrent requests must cost ONE upstream call');
});

test('degrades to stale cache when upstream dies, and says so', async (t) => {
  let healthy = true;
  const http = stubHttp(() => {
    if (healthy) return okResponse(userPayload());
    const err = new Error('upstream down');
    err.response = { status: 503 };
    return Promise.reject(err);
  });

  const { call } = await serve(t, {
    http, redis, bearerToken: 't',
    limits: { cacheTtlMs: 1 }, // expire immediately so the next read is stale
  });

  await call('/api/proxy', { endpoint: 'users/by/username/jack' });
  await new Promise((r) => setTimeout(r, 20));
  healthy = false;

  const res = await call('/api/proxy', { endpoint: 'users/by/username/jack' });
  const body = await res.json();

  assert.equal(res.status, 200, 'stale data beats a 503');
  assert.equal(body.meta.degraded, true, 'degraded data MUST be labeled degraded');
  assert.equal(body.meta.source, 'cache:stale');
  assert.equal(res.headers.get('x-data-source'), 'stale-cache');
  assert.equal(body.data.data.username, 'jack', 'real cached data, not invented');
});

test('returns an error rather than fabricating data when upstream fails cold', async (t) => {
  const http = stubHttp(() => {
    const err = new Error('upstream down');
    err.response = { status: 503 };
    return Promise.reject(err);
  });
  const { call } = await serve(t, { http, redis, bearerToken: 't' });

  const res = await call('/api/proxy', { endpoint: 'users/by/username/nobody' });
  const body = await res.json();

  assert.ok(res.status >= 500, 'no cache + dead upstream = an honest error');
  assert.ok(!body.data, 'must NOT invent plausible-looking metrics');
  assert.ok(body.error);
});

test('breaker opens after repeated upstream failures and stops calling it', async (t) => {
  const http = stubHttp(() => {
    const err = new Error('boom');
    err.response = { status: 500 };
    return Promise.reject(err);
  });

  const { call, client } = await serve(t, {
    http, redis, bearerToken: 't',
    limits: { failureThreshold: 3, breakerResetMs: 60_000 },
  });

  // Distinct handles so nothing coalesces or caches.
  for (let i = 0; i < 6; i++) {
    await call('/api/proxy', { endpoint: `users/by/username/user${i}` });
  }

  const health = await client.health();
  assert.equal(health.breaker.state, 'OPEN', 'breaker must trip on a dead upstream');

  const before = http.calls.length;
  await call('/api/proxy', { endpoint: 'users/by/username/later' });
  assert.equal(http.calls.length, before, 'an OPEN breaker must not call upstream at all');
});

test('rejects endpoints outside the allowlist', async (t) => {
  const http = stubHttp(() => okResponse({}));
  const { call } = await serve(t, { http, redis, bearerToken: 't' });

  // A generic relay would let a compromised client do anything as us.
  for (const endpoint of ['tweets/manage', '../../admin', 'https://evil.com/steal', 'users/me']) {
    const res = await call('/api/proxy', { endpoint });
    assert.equal(res.status, 403, `must reject "${endpoint}"`);
  }
  assert.equal(http.calls.length, 0, 'nothing disallowed reached upstream');
});

test('validates malformed input instead of crashing', async (t) => {
  const http = stubHttp(() => okResponse({}));
  const { call } = await serve(t, { http, redis, bearerToken: 't' });

  const cases = [{}, { endpoint: '' }, { endpoint: 123 }, { endpoint: null }];
  for (const body of cases) {
    const res = await call('/api/proxy', body);
    assert.ok(res.status === 400 || res.status === 403, `rejected ${JSON.stringify(body)}`);
  }
});

test('keeps serving when Redis is unavailable', async (t) => {
  // The whole reliability argument for adding Redis collapses if losing Redis
  // takes the service down with it.
  const dead = new Redis('redis://127.0.0.1:6399', {
    lazyConnect: true, enableOfflineQueue: false, retryStrategy: () => null,
  });
  dead.on('error', () => {});
  t.after(() => dead.disconnect());

  const http = stubHttp(() => okResponse(userPayload()));
  const { call } = await serve(t, { http, redis: dead, bearerToken: 't' });

  const res = await call('/api/proxy', { endpoint: 'users/by/username/jack' });
  const body = await res.json();

  assert.equal(res.status, 200, 'Redis down must not mean service down');
  assert.equal(body.data.data.username, 'jack');

  // And the in-process tier still absorbs the repeat.
  const second = await call('/api/proxy', { endpoint: 'users/by/username/jack' });
  assert.equal((await second.json()).meta.source, 'cache:local');
  assert.equal(http.calls.length, 1);
});

test('health reports degraded when the breaker is open', async (t) => {
  const http = stubHttp(() => {
    const err = new Error('boom');
    err.response = { status: 500 };
    return Promise.reject(err);
  });
  const { call } = await serve(t, {
    http, redis, bearerToken: 't', limits: { failureThreshold: 1 },
  });

  assert.equal((await call('/health')).status, 200);

  await call('/api/proxy', { endpoint: 'users/by/username/x' });

  const res = await call('/health');
  assert.equal(res.status, 503, 'a load balancer needs to see this, not "ok"');
  assert.equal((await res.json()).status, 'degraded');
});

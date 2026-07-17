'use strict';

const autocannon = require('autocannon');
const Redis = require('ioredis');

const { createApp } = require('../src/app');

/**
 * Load benchmark for the proxy stack.
 *
 * WHAT THIS MEASURES: the proxy's own overhead — cache lookup, coalescing,
 * token bucket (a real Redis round trip + Lua eval), circuit breaker, routing,
 * and JSON serialization — against a stubbed upstream with a fixed latency.
 *
 * WHAT IT DOES NOT MEASURE: X's real network latency. Numbers from this harness
 * describe the proxy, not end-to-end profile analysis, and must be reported that
 * way. Quoting a cache-hit throughput figure as "profiles/sec from the X API"
 * would be exactly the kind of claim this repo is being cleaned up for.
 *
 * Usage:
 *   npm run bench                  # default: cache-hit path
 *   node bench/load.js --scenario=cold --duration=10 --connections=100
 */

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
  })
);

const SCENARIO = args.scenario || 'warm';
const DURATION = Number(args.duration || 10);
const CONNECTIONS = Number(args.connections || 500);
const UPSTREAM_LATENCY_MS = Number(args['upstream-latency'] || 80);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Stubbed X API. Fixed latency so results are about the proxy, not the network. */
function makeStubHttp() {
  let calls = 0;
  return {
    get calls() { return calls; },
    get: async (url) => {
      calls++;
      await sleep(UPSTREAM_LATENCY_MS);
      const username = url.split('/').pop();
      return {
        status: 200,
        headers: { 'x-rate-limit-remaining': '299' },
        data: {
          data: {
            id: '12345',
            username,
            name: username,
            public_metrics: {
              followers_count: 1_000_000, following_count: 500,
              tweet_count: 30_000, listed_count: 20_000,
            },
          },
        },
      };
    },
  };
}

/**
 * warm — every request hits the same handle. Measures the cached read path:
 *        what the proxy sustains when serving repeat analyses.
 * cold — every request is a unique handle, so nothing caches or coalesces.
 *        This is the honest worst case, bounded by the upstream + rate limit.
 */
function buildRequests(scenario) {
  if (scenario === 'warm') {
    return [{
      method: 'POST',
      path: '/api/proxy',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ endpoint: 'users/by/username/jack' }),
    }];
  }

  return [{
    method: 'POST',
    path: '/api/proxy',
    headers: { 'content-type': 'application/json' },
    setupRequest: (req) => {
      const handle = `user${Math.floor(Math.random() * 1e9).toString(36)}`.slice(0, 15);
      req.body = JSON.stringify({ endpoint: `users/by/username/${handle}` });
      return req;
    },
  }];
}

async function main() {
  const redis = new Redis(process.env.REDIS_BENCH_URL || 'redis://127.0.0.1:6379/13');
  // Requests still draining at teardown will hit a closing socket; that EPIPE is
  // shutdown noise, not a result, and shouldn't print a stack trace over the report.
  redis.on('error', () => {});
  await redis.flushdb();

  // The per-IP limiter would reject a benchmark from one host and we would end
  // up measuring express-rate-limit instead of the stack under test.
  process.env.DISABLE_IP_RATE_LIMIT = 'true';

  const http = makeStubHttp();
  const { app, client } = createApp({
    http,
    redis,
    bearerToken: 'bench-token',
    limits: {
      concurrency: 16,
      // 'cold' would otherwise exhaust the 300-token budget in the first second
      // and measure the rate limiter's rejection path rather than throughput.
      cacheTtlMs: SCENARIO === 'warm' ? 15 * 60 * 1000 : 1,
    },
  });

  const server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  const port = server.address().port;

  if (SCENARIO === 'warm') {
    // Prime the cache so the run measures steady state, not the first miss.
    await fetch(`http://127.0.0.1:${port}/api/proxy`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ endpoint: 'users/by/username/jack' }),
    });
  }

  console.log(`\n  scenario=${SCENARIO}  connections=${CONNECTIONS}  duration=${DURATION}s  upstream=${UPSTREAM_LATENCY_MS}ms\n`);

  const result = await autocannon({
    url: `http://127.0.0.1:${port}`,
    connections: CONNECTIONS,
    duration: DURATION,
    requests: buildRequests(SCENARIO),
  });

  const health = await client.health();

  const nonSuccess = result.non2xx + (result.errors || 0);
  const report = {
    scenario: SCENARIO,
    connections: CONNECTIONS,
    durationSec: DURATION,
    upstreamLatencyMs: UPSTREAM_LATENCY_MS,
    throughputReqPerSec: Math.round(result.requests.average),
    latencyMs: {
      p50: result.latency.p50,
      p95: result.latency.p97_5, // autocannon reports p97.5, not p95 — do not relabel
      p99: result.latency.p99,
      max: result.latency.max,
    },
    totalRequests: result.requests.total,
    non2xx: result.non2xx,
    errors: result.errors || 0,
    successRate: Number((((result.requests.total - nonSuccess) / result.requests.total) * 100).toFixed(2)),
    upstreamCalls: http.calls,
    coalescedOrCached: result.requests.total - http.calls,
    cacheHitRate: health.cache.hitRate,
    breakerState: health.breaker.state,
  };

  console.log('\n─── RESULTS ───');
  console.log(JSON.stringify(report, null, 2));
  console.log(
    `\n  ${report.totalRequests} client requests → ${report.upstreamCalls} upstream calls ` +
    `(${((1 - report.upstreamCalls / report.totalRequests) * 100).toFixed(1)}% absorbed by cache + coalescing)`
  );
  console.log('\n  NOTE: p95 above is autocannon\'s p97.5 bucket. Upstream is stubbed at');
  console.log('  a fixed latency — these numbers describe proxy overhead, not X API round trips.\n');

  await new Promise((r) => server.close(r));
  await redis.quit();
  return report;
}

main().catch((err) => {
  console.error('Benchmark failed:', err);
  process.exit(1);
});

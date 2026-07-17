'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Redis = require('ioredis');

const { TokenBucket } = require('../src/tokenBucket');

/**
 * Uses a real Redis on db 15 — the Lua refill is the whole point of this module,
 * and a mock would test the mock. db 15 is flushed between tests, and is this
 * file's alone: `node --test` runs files in parallel, so a shared db would have
 * suites flushing each other's state.
 */
const redis = new Redis(process.env.REDIS_TEST_URL || 'redis://127.0.0.1:6379/15');

test.before(async () => { await redis.flushdb(); });
test.after(async () => { await redis.quit(); });
test.beforeEach(async () => { await redis.flushdb(); });

/** Controllable clock so refill tests assert math instead of sleeping. */
function fakeClock(start = 1_000_000) {
  let t = start;
  return { now: () => t, advance: (ms) => { t += ms; } };
}

test('starts full and allows a burst up to capacity', async () => {
  const bucket = new TokenBucket({ redis, capacity: 10, refillPerSec: 1, now: () => 1000 });

  for (let i = 0; i < 10; i++) {
    const { allowed } = await bucket.take('burst');
    assert.equal(allowed, true, `request ${i + 1} within capacity should be allowed`);
  }

  const overflow = await bucket.take('burst');
  assert.equal(overflow.allowed, false, 'request past capacity must be denied');
  assert.equal(overflow.remaining, 0);
  assert.ok(overflow.retryAfterMs > 0, 'a denied request must say when to retry');
});

test('refills at the configured rate over time', async () => {
  const clock = fakeClock();
  const bucket = new TokenBucket({ redis, capacity: 10, refillPerSec: 2, now: clock.now });

  for (let i = 0; i < 10; i++) await bucket.take('refill');
  assert.equal((await bucket.take('refill')).allowed, false, 'drained');

  clock.advance(1000); // 1s @ 2/sec = 2 tokens
  assert.equal((await bucket.take('refill')).allowed, true);
  assert.equal((await bucket.take('refill')).allowed, true);
  assert.equal((await bucket.take('refill')).allowed, false, 'only 2 tokens refilled');
});

test('refill is clamped at capacity — idle time does not bank tokens', async () => {
  const clock = fakeClock();
  const bucket = new TokenBucket({ redis, capacity: 5, refillPerSec: 1, now: clock.now });

  await bucket.take('clamp');
  clock.advance(60 * 60 * 1000); // an hour idle

  const tokens = await bucket.peek('clamp');
  assert.equal(tokens, 5, 'must clamp at capacity, not accumulate an hour of tokens');

  for (let i = 0; i < 5; i++) {
    assert.equal((await bucket.take('clamp')).allowed, true);
  }
  assert.equal((await bucket.take('clamp')).allowed, false, 'no banked burst beyond capacity');
});

test('enforces the real X budget: 300 per 15 minutes, no window-boundary doubling', async () => {
  const clock = fakeClock();
  // Production defaults: capacity 300, refill 300/900s.
  const bucket = new TokenBucket({ redis, now: clock.now });

  let allowed = 0;
  for (let i = 0; i < 300; i++) if ((await bucket.take('x')).allowed) allowed++;
  assert.equal(allowed, 300, 'full budget available as a burst');
  assert.equal((await bucket.take('x')).allowed, false, '301st denied');

  // The failure mode of a fixed window: at the boundary the counter resets and
  // admits another full 300, for 600 in a few seconds. The bucket must not.
  clock.advance(900_000); // exactly one window later
  let secondWindow = 0;
  for (let i = 0; i < 400; i++) if ((await bucket.take('x')).allowed) secondWindow++;

  assert.equal(secondWindow, 300, 'refills to exactly capacity, never above');
  assert.ok(secondWindow <= 300, 'must never admit a 600-request boundary burst');
});

test('concurrent takes do not over-admit (atomicity)', async () => {
  const bucket = new TokenBucket({ redis, capacity: 50, refillPerSec: 0.001, now: () => 5000 });

  // 200 simultaneous takes against 50 tokens. A read-modify-write in Node would
  // interleave and over-admit; the Lua script must not.
  const results = await Promise.all(
    Array.from({ length: 200 }, () => bucket.take('race'))
  );

  const granted = results.filter((r) => r.allowed).length;
  assert.equal(granted, 50, `exactly capacity may be granted under concurrency, got ${granted}`);
});

test('reconcile lowers tokens to match X headers but never raises them', async () => {
  const bucket = new TokenBucket({ redis, capacity: 100, refillPerSec: 1, now: () => 9000 });

  await bucket.take('rec');
  await bucket.reconcile('rec', 10); // X says only 10 left
  assert.equal(Math.floor(await bucket.peek('rec')), 10, 'trusts X downward');

  await bucket.reconcile('rec', 250); // X claims more than we think
  assert.equal(Math.floor(await bucket.peek('rec')), 10, 'must not trust an optimistic upstream');
});

test('ignores invalid reconcile values instead of corrupting the bucket', async () => {
  const bucket = new TokenBucket({ redis, capacity: 20, refillPerSec: 1, now: () => 1000 });
  await bucket.take('bad');

  for (const bogus of [NaN, -5, undefined, null, 'abc']) {
    await bucket.reconcile('bad', bogus);
  }

  const tokens = await bucket.peek('bad');
  assert.ok(tokens > 0 && tokens <= 20, `bucket stayed sane, got ${tokens}`);
});

test('a backwards clock step does not drain the bucket', async () => {
  let t = 100_000;
  const bucket = new TokenBucket({ redis, capacity: 10, refillPerSec: 1, now: () => t });

  await bucket.take('skew');
  t -= 50_000; // NTP correction backwards

  const { allowed } = await bucket.take('skew');
  assert.equal(allowed, true, 'negative elapsed must clamp to 0, not subtract tokens');
});

test('buckets are isolated by id', async () => {
  const bucket = new TokenBucket({ redis, capacity: 2, refillPerSec: 1, now: () => 1000 });

  await bucket.take('tenant-a');
  await bucket.take('tenant-a');
  assert.equal((await bucket.take('tenant-a')).allowed, false);
  assert.equal((await bucket.take('tenant-b')).allowed, true, 'separate id has its own budget');
});

test('rejects invalid construction', () => {
  assert.throws(() => new TokenBucket({ redis: null }), /requires a redis client/);
  assert.throws(() => new TokenBucket({ redis, capacity: 0 }), /capacity must be > 0/);
  assert.throws(() => new TokenBucket({ redis, refillPerSec: 0 }), /refillPerSec must be > 0/);
});

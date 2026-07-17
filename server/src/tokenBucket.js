'use strict';

const { isRedisReady } = require('./redis');

/**
 * Distributed token bucket rate limiter backed by Redis.
 *
 * X allows 300 requests per 15-minute window per app. A fixed-window counter
 * satisfies that on paper but permits a burst of 600 across a window boundary
 * (300 at 14:59, 300 at 15:01), which is exactly the pattern that gets an app
 * throttled. A token bucket smooths the refill instead: capacity 300, refilling
 * at 300/900s = 0.333 tokens/sec, so the long-run rate can never exceed the
 * budget no matter how requests line up in time.
 *
 * The refill-and-take is a Lua script so it executes atomically inside Redis.
 * Doing it as GET/compute/SET in Node would race across concurrent requests and
 * over-admit under exactly the load this exists to survive.
 */

/**
 * KEYS[1] bucket hash. ARGV: capacity, refillPerSec, nowMs, requested, ttlMs.
 * Returns { allowed, tokensRemaining, retryAfterMs }.
 */
const BUCKET_LUA = `
local key          = KEYS[1]
local capacity     = tonumber(ARGV[1])
local refill_rate  = tonumber(ARGV[2])
local now          = tonumber(ARGV[3])
local requested    = tonumber(ARGV[4])
local ttl          = tonumber(ARGV[5])

local state  = redis.call('HMGET', key, 'tokens', 'ts')
local tokens = tonumber(state[1])
local ts     = tonumber(state[2])

-- A bucket that has expired (or never existed) starts full.
if tokens == nil or ts == nil then
  tokens = capacity
  ts     = now
end

-- Refill for elapsed time, clamped at capacity. max(0, ...) guards against a
-- clock that stepped backwards; without it a negative delta would drain tokens.
local elapsed = math.max(0, now - ts) / 1000
tokens = math.min(capacity, tokens + (elapsed * refill_rate))

local allowed     = 0
local retry_after = 0

if tokens >= requested then
  tokens  = tokens - requested
  allowed = 1
else
  -- Time until the deficit refills, so callers get a real number to wait.
  retry_after = math.ceil(((requested - tokens) / refill_rate) * 1000)
end

redis.call('HMSET', key, 'tokens', tokens, 'ts', now)
redis.call('PEXPIRE', key, ttl)

return { allowed, math.floor(tokens), retry_after }
`;

/** X API v2 app-level limit: 300 requests / 15 minutes. */
const X_API_CAPACITY = 300;
const X_API_WINDOW_MS = 15 * 60 * 1000;

/**
 * In-process token bucket used only when Redis is unreachable.
 *
 * Tradeoff, stated plainly: this is per-instance, so with N instances running
 * during a Redis outage the aggregate admitted rate can reach N × capacity.
 * That is deliberate. The alternative — refusing all traffic because the
 * bookkeeping store is down — turns a Redis outage into a full outage, and X
 * responds to genuine overage with 429s that the circuit breaker and
 * Retry-After handling already absorb. Availability wins; the accuracy loss is
 * bounded and reported via `degraded` on every response.
 */
class LocalBucket {
  constructor(capacity, refillPerSec, now) {
    this.capacity = capacity;
    this.refillPerSec = refillPerSec;
    this.now = now;
    this.buckets = new Map();
  }

  take(id, count) {
    const t = this.now();
    const state = this.buckets.get(id) || { tokens: this.capacity, ts: t };

    const elapsed = Math.max(0, t - state.ts) / 1000;
    let tokens = Math.min(this.capacity, state.tokens + elapsed * this.refillPerSec);

    let allowed = false;
    let retryAfterMs = 0;

    if (tokens >= count) {
      tokens -= count;
      allowed = true;
    } else {
      retryAfterMs = Math.ceil(((count - tokens) / this.refillPerSec) * 1000);
    }

    this.buckets.set(id, { tokens, ts: t });
    return { allowed, remaining: Math.floor(tokens), retryAfterMs };
  }

  peek(id) {
    const state = this.buckets.get(id);
    if (!state) return this.capacity;
    const elapsed = Math.max(0, this.now() - state.ts) / 1000;
    return Math.min(this.capacity, state.tokens + elapsed * this.refillPerSec);
  }
}

class TokenBucket {
  /**
   * @param {object}  opts
   * @param {import('ioredis').Redis} opts.redis
   * @param {number} [opts.capacity]      Max burst size.
   * @param {number} [opts.refillPerSec]  Steady-state rate. Defaults to capacity/window.
   * @param {string} [opts.keyPrefix]
   * @param {() => number} [opts.now]     Injectable clock, so tests don't sleep.
   */
  constructor({
    redis,
    capacity = X_API_CAPACITY,
    refillPerSec = X_API_CAPACITY / (X_API_WINDOW_MS / 1000),
    keyPrefix = 'xtrct:bucket:',
    now = () => Date.now(),
  }) {
    if (!redis) throw new Error('TokenBucket requires a redis client');
    if (capacity <= 0) throw new Error('capacity must be > 0');
    if (refillPerSec <= 0) throw new Error('refillPerSec must be > 0');

    this.redis = redis;
    this.capacity = capacity;
    this.refillPerSec = refillPerSec;
    this.keyPrefix = keyPrefix;
    this.now = now;

    this.local = new LocalBucket(capacity, refillPerSec, now);
    this.stats = { redisTakes: 0, localTakes: 0, redisErrors: 0 };

    // Idle buckets are indistinguishable from full ones, so expiring them after
    // a full refill period is free — it just bounds memory.
    this.ttlMs = Math.ceil((capacity / refillPerSec) * 1000) * 2;

    // Registered client-side, so this is safe before/without a connection.
    if (typeof this.redis.defineCommand === 'function' && !this.redis.takeTokens) {
      this.redis.defineCommand('takeTokens', { numberOfKeys: 1, lua: BUCKET_LUA });
    }
  }

  /**
   * Attempt to consume tokens.
   *
   * Falls back to the in-process bucket if Redis is unreachable — a rate limiter
   * that takes the service down when its bookkeeping store blips is worse than
   * no rate limiter at all. `degraded` tells the caller which path ran.
   *
   * @param {string} bucketId
   * @param {number} [count]
   * @returns {Promise<{allowed: boolean, remaining: number, retryAfterMs: number, degraded: boolean}>}
   */
  async take(bucketId, count = 1) {
    if (!isRedisReady(this.redis)) {
      this.stats.localTakes++;
      return { ...this.local.take(bucketId, count), degraded: true };
    }

    try {
      const [allowed, remaining, retryAfterMs] = await this.redis.takeTokens(
        this.keyPrefix + bucketId,
        this.capacity,
        this.refillPerSec,
        this.now(),
        count,
        this.ttlMs
      );

      this.stats.redisTakes++;
      return { allowed: allowed === 1, remaining, retryAfterMs, degraded: false };
    } catch (err) {
      // Redis was ready a moment ago and died mid-command.
      this.stats.redisErrors++;
      this.stats.localTakes++;
      return { ...this.local.take(bucketId, count), degraded: true };
    }
  }

  /** Inspect without consuming. Used by /health and tests. */
  async peek(bucketId) {
    if (!isRedisReady(this.redis)) return this.local.peek(bucketId);

    try {
      const state = await this.redis.hmget(this.keyPrefix + bucketId, 'tokens', 'ts');
      const tokens = state[0] === null ? this.capacity : Number(state[0]);
      const ts = state[1] === null ? this.now() : Number(state[1]);
      const elapsed = Math.max(0, this.now() - ts) / 1000;

      return Math.min(this.capacity, tokens + elapsed * this.refillPerSec);
    } catch {
      this.stats.redisErrors++;
      return this.local.peek(bucketId);
    }
  }

  /**
   * Reconcile against X's authoritative headers. Our bucket is a local model of
   * a budget the server doesn't own; if X says we have fewer requests left than
   * we think (other clients on the same app key, or a restart that lost state),
   * X wins. Only ever adjusts downward — trusting an optimistic upstream number
   * would let us over-admit.
   *
   * @param {string} bucketId
   * @param {number} remaining Value of the x-rate-limit-remaining header.
   */
  async reconcile(bucketId, remaining) {
    if (!Number.isFinite(remaining) || remaining < 0) return;

    const current = await this.peek(bucketId);
    if (remaining >= current) return;

    // Keep the local mirror correct too, so a later Redis outage inherits the
    // reconciled value rather than optimistically resetting to full.
    this.local.buckets.set(bucketId, { tokens: remaining, ts: this.now() });

    if (!isRedisReady(this.redis)) return;

    try {
      await this.redis
        .multi()
        .hmset(this.keyPrefix + bucketId, 'tokens', remaining, 'ts', this.now())
        .pexpire(this.keyPrefix + bucketId, this.ttlMs)
        .exec();
    } catch {
      this.stats.redisErrors++;
    }
  }

  async reset(bucketId) {
    this.local.buckets.delete(bucketId);
    if (!isRedisReady(this.redis)) return;
    try { await this.redis.del(this.keyPrefix + bucketId); } catch { this.stats.redisErrors++; }
  }
}

module.exports = { TokenBucket, X_API_CAPACITY, X_API_WINDOW_MS };

'use strict';

const { isRedisReady } = require('./redis');

/**
 * Two-tier cache: Redis (shared) in front of a bounded in-process LRU (local).
 *
 * Profile data is the ideal cache target — X's numbers move slowly, and the same
 * handful of handles get analyzed repeatedly — so nearly all read volume can be
 * served without spending a token from a 300/15min budget.
 *
 * The local tier is not just a speedup: it's what keeps the proxy serving when
 * Redis is unreachable. Two tiers also means two chances to answer during a
 * partial outage.
 *
 * Entries carry `expiresAt` in the payload rather than relying solely on Redis
 * TTL, so an expired-but-present entry is still readable. That's what makes
 * stale-while-error possible: when upstream is down, month-old follower counts
 * clearly labeled stale beat a 503, and both beat inventing a number.
 */

/** Minimal LRU. A Map preserves insertion order, so the first key is the oldest. */
class LruCache {
  constructor(maxEntries = 500) {
    this.maxEntries = maxEntries;
    this.map = new Map();
  }

  get(key) {
    if (!this.map.has(key)) return undefined;
    // Re-insert to mark as recently used.
    const value = this.map.get(key);
    this.map.delete(key);
    this.map.set(key, value);
    return value;
  }

  set(key, value) {
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, value);
    if (this.map.size > this.maxEntries) {
      this.map.delete(this.map.keys().next().value);
    }
  }

  delete(key) { this.map.delete(key); }
  clear() { this.map.clear(); }
  get size() { return this.map.size; }
}

class Cache {
  /**
   * @param {object} opts
   * @param {import('ioredis').Redis} [opts.redis] Omit to run local-only.
   * @param {number} [opts.ttlMs]
   * @param {number} [opts.maxLocalEntries]
   * @param {string} [opts.keyPrefix]
   * @param {() => number} [opts.now]
   */
  constructor({
    redis = null,
    ttlMs = 15 * 60 * 1000,
    maxLocalEntries = 500,
    keyPrefix = 'xtrct:cache:',
    now = () => Date.now(),
  } = {}) {
    this.redis = redis;
    this.ttlMs = ttlMs;
    this.keyPrefix = keyPrefix;
    this.now = now;
    this.local = new LruCache(maxLocalEntries);

    this.stats = { hits: 0, misses: 0, staleServed: 0, redisErrors: 0, localHits: 0 };
  }

  _key(key) { return this.keyPrefix + key; }

  /**
   * @param {string} key
   * @returns {Promise<{value: any, stale: boolean, tier: 'local'|'redis'} | null>}
   */
  async get(key) {
    const local = this.local.get(key);
    if (local) {
      const stale = this.now() > local.expiresAt;
      if (!stale) {
        this.stats.hits++;
        this.stats.localHits++;
        return { value: local.value, stale: false, tier: 'local' };
      }
    }

    if (isRedisReady(this.redis)) {
      try {
        const raw = await this.redis.get(this._key(key));
        if (raw) {
          const entry = JSON.parse(raw);
          this.local.set(key, entry);
          const stale = this.now() > entry.expiresAt;
          if (!stale) {
            this.stats.hits++;
            return { value: entry.value, stale: false, tier: 'redis' };
          }
          this.stats.misses++;
          return { value: entry.value, stale: true, tier: 'redis' };
        }
      } catch (err) {
        // Degrade, don't fail. A cache read error is not a request error.
        this.stats.redisErrors++;
      }
    }

    if (local) {
      this.stats.misses++;
      return { value: local.value, stale: true, tier: 'local' };
    }

    this.stats.misses++;
    return null;
  }

  /**
   * @param {string} key
   * @param {any} value
   * @param {number} [ttlMs]
   */
  async set(key, value, ttlMs = this.ttlMs) {
    const entry = { value, expiresAt: this.now() + ttlMs, cachedAt: this.now() };
    this.local.set(key, entry);

    if (isRedisReady(this.redis)) {
      try {
        // Redis TTL is deliberately longer than the logical TTL: the entry must
        // outlive its own freshness to remain available as a stale fallback.
        await this.redis.set(this._key(key), JSON.stringify(entry), 'PX', ttlMs * 4);
      } catch (err) {
        this.stats.redisErrors++;
      }
    }
  }

  async delete(key) {
    this.local.delete(key);
    if (isRedisReady(this.redis)) {
      try { await this.redis.del(this._key(key)); } catch { this.stats.redisErrors++; }
    }
  }

  /** Marks a stale hit as actually served, for honest hit-rate accounting. */
  recordStaleServed() { this.stats.staleServed++; }

  snapshot() {
    const total = this.stats.hits + this.stats.misses;
    return {
      ...this.stats,
      localEntries: this.local.size,
      hitRate: total === 0 ? 0 : Number((this.stats.hits / total).toFixed(4)),
    };
  }
}

module.exports = { Cache, LruCache };

'use strict';

const { withRetry } = require('./backoff');
const { CircuitBreaker, CircuitOpenError } = require('./circuitBreaker');
const { TokenBucket } = require('./tokenBucket');
const { RequestQueue } = require('./queue');
const { Cache } = require('./cache');

/**
 * X API v2 client composing the fault-tolerance layers.
 *
 * Request path, outermost first:
 *
 *   cache (fresh?) ──► return
 *        │ miss
 *        ▼
 *   queue (coalesce identical in-flight requests, bound concurrency)
 *        ▼
 *   token bucket (is there budget for an upstream call?)
 *        ▼
 *   circuit breaker (is upstream even worth calling?)
 *        ▼
 *   retry w/ exponential backoff + jitter
 *        ▼
 *   X API  ──► reconcile bucket against x-rate-limit headers, cache, return
 *
 * Every failure below the cache falls back to stale-if-available, labeled as
 * stale. The one thing this never does is invent data: `degraded` and `source`
 * always tell the caller what they actually got.
 */

class RateLimitedError extends Error {
  constructor(retryAfterMs) {
    super('Rate limit budget exhausted for the X API window');
    this.name = 'RateLimitedError';
    this.code = 'RATE_LIMITED';
    this.status = 429;
    this.retryAfterMs = retryAfterMs;
  }
}

/** 4xx other than 429 means upstream is healthy and answering — not a breaker signal. */
function isUpstreamHealthFailure(err) {
  const status = err.status ?? err.response?.status;
  if (status === undefined) return true; // transport error
  if (status === 429) return true;       // we are hurting it
  return status >= 500;
}

class XClient {
  /**
   * @param {object} opts
   * @param {import('axios').AxiosInstance} opts.http
   * @param {import('ioredis').Redis} [opts.redis]
   * @param {string} opts.bearerToken
   * @param {string} [opts.baseUrl]
   * @param {object} [opts.limits]
   * @param {(evt: string, detail?: any) => void} [opts.onEvent]
   */
  constructor({
    http,
    redis = null,
    bearerToken,
    baseUrl = 'https://api.twitter.com/2',
    limits = {},
    onEvent = () => {},
  }) {
    if (!http) throw new Error('XClient requires an http client');
    if (!bearerToken) throw new Error('XClient requires a bearerToken');

    this.http = http;
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.bearerToken = bearerToken;
    this.onEvent = onEvent;

    this.cache = new Cache({ redis, ttlMs: limits.cacheTtlMs ?? 15 * 60 * 1000 });
    this.queue = new RequestQueue({
      concurrency: limits.concurrency ?? 8,
      maxDepth: limits.maxQueueDepth ?? 1000,
    });
    this.breaker = new CircuitBreaker({
      failureThreshold: limits.failureThreshold ?? 5,
      resetTimeoutMs: limits.breakerResetMs ?? 30_000,
      isFailure: isUpstreamHealthFailure,
      name: 'x-api',
    });

    // Redis-backed when available; otherwise the bucket is skipped and we lean
    // on the breaker + queue. Losing Redis should cost accuracy, not uptime.
    this.bucket = redis ? new TokenBucket({ redis }) : null;
    this.bucketId = 'x-api-v2';
  }

  /**
   * GET an X API endpoint with the full fault-tolerance stack.
   *
   * @param {string} endpoint e.g. 'users/by/username/jack'
   * @param {object} [params]
   * @returns {Promise<{data: any, source: string, degraded: boolean, cachedAt?: number}>}
   */
  async get(endpoint, params = {}) {
    const key = this._cacheKey(endpoint, params);

    const cached = await this.cache.get(key);
    if (cached && !cached.stale) {
      return { data: cached.value, source: `cache:${cached.tier}`, degraded: false };
    }

    try {
      return await this.queue.run(key, () => this._fetchUpstream(endpoint, params, key));
    } catch (err) {
      // Degradation: a stale answer that says it's stale is more useful than an
      // error, and honest in a way that synthesized data is not.
      const stale = cached ?? (await this.cache.get(key));
      if (stale) {
        this.cache.recordStaleServed();
        this.onEvent('degraded_stale_served', { endpoint, reason: err.code || err.message });
        return {
          data: stale.value,
          source: 'cache:stale',
          degraded: true,
          reason: err.code || 'upstream_unavailable',
        };
      }
      throw err;
    }
  }

  /** Cache miss path: budget → breaker → retry → upstream. */
  async _fetchUpstream(endpoint, params, key) {
    if (this.bucket) {
      const { allowed, retryAfterMs } = await this.bucket.take(this.bucketId);
      if (!allowed) {
        this.onEvent('rate_limited', { endpoint, retryAfterMs });
        throw new RateLimitedError(retryAfterMs);
      }
    }

    const response = await this.breaker.execute(() =>
      withRetry((attempt) => this._request(endpoint, params, attempt), {
        retries: 3,
        baseMs: 250,
        maxMs: 8_000,
        onRetry: ({ attempt, delayMs, error }) =>
          this.onEvent('retry', { endpoint, attempt, delayMs, error: error.message }),
      })
    );

    await this._reconcileFromHeaders(response.headers);
    await this.cache.set(key, response.data);

    return { data: response.data, source: 'x-api-v2:live', degraded: false };
  }

  async _request(endpoint, params, attempt) {
    try {
      return await this.http.get(`${this.baseUrl}/${endpoint.replace(/^\//, '')}`, {
        params,
        headers: {
          Authorization: `Bearer ${this.bearerToken}`,
          'User-Agent': 'XtrctAI-Proxy/2.0',
        },
        timeout: 10_000,
      });
    } catch (err) {
      // Normalize axios shape into something the retry/breaker predicates read
      // without knowing they're talking to axios.
      const status = err.response?.status;
      const normalized = new Error(
        err.response?.data?.detail || err.response?.data?.title || err.message
      );
      normalized.status = status;
      normalized.code = err.code;
      normalized.attempt = attempt;
      normalized.details = err.response?.data;

      // Honor Retry-After over computed backoff.
      const retryAfter = err.response?.headers?.['retry-after'];
      if (retryAfter) normalized.retryAfterMs = Number(retryAfter) * 1000;

      // A 429 means our local model of the budget is wrong. Zero it so we stop
      // spending on requests X will reject.
      if (status === 429 && this.bucket) {
        await this.bucket.reconcile(this.bucketId, 0).catch(() => {});
      }

      throw normalized;
    }
  }

  /** X's headers are authoritative; our bucket is a model. Trust X downward. */
  async _reconcileFromHeaders(headers = {}) {
    if (!this.bucket) return;
    const remaining = Number(headers['x-rate-limit-remaining']);
    if (Number.isFinite(remaining)) {
      await this.bucket.reconcile(this.bucketId, remaining).catch(() => {});
    }
  }

  _cacheKey(endpoint, params) {
    // Sort keys so param order can't split the cache into duplicate entries.
    const sorted = Object.keys(params).sort().map((k) => `${k}=${params[k]}`).join('&');
    return sorted ? `${endpoint}?${sorted}` : endpoint;
  }

  async health() {
    return {
      breaker: this.breaker.snapshot(),
      cache: this.cache.snapshot(),
      queue: this.queue.snapshot(),
      rateLimit: this.bucket
        ? { tokensAvailable: Math.floor(await this.bucket.peek(this.bucketId)), capacity: this.bucket.capacity }
        : { enabled: false, reason: 'redis unavailable — bucket disabled' },
    };
  }
}

module.exports = { XClient, RateLimitedError, isUpstreamHealthFailure };

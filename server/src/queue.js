'use strict';

/**
 * Bounded work queue with single-flight coalescing.
 *
 * Two jobs:
 *
 * 1. Coalescing. Under concurrent load the same handle is requested many times
 *    at once. Without this, 500 concurrent requests for @jack become 500 upstream
 *    calls against a 300/15min budget — the budget is gone in one burst. With it,
 *    they become one call whose result fans out to all 500 waiters. This is the
 *    single highest-leverage thing in the request path.
 *
 * 2. Bounded concurrency + rejection. An unbounded queue under sustained overload
 *    doesn't fail — it grows, latency climbs without limit, and callers time out
 *    while the server keeps working on requests nobody is waiting for anymore.
 *    Rejecting past a depth limit converts that into an honest, immediate 503.
 */

class QueueFullError extends Error {
  constructor(depth) {
    super(`Request queue is full (depth ${depth}) — shedding load`);
    this.name = 'QueueFullError';
    this.code = 'QUEUE_FULL';
    this.status = 503;
  }
}

class RequestQueue {
  /**
   * @param {object} [opts]
   * @param {number} [opts.concurrency] Max simultaneous upstream calls.
   * @param {number} [opts.maxDepth]    Max waiting tasks before shedding.
   */
  constructor({ concurrency = 8, maxDepth = 1000 } = {}) {
    this.concurrency = concurrency;
    this.maxDepth = maxDepth;

    this.active = 0;
    this.waiting = [];
    this.inFlight = new Map(); // key -> Promise, the single-flight registry

    this.stats = { enqueued: 0, coalesced: 0, rejected: 0, completed: 0, failed: 0 };
  }

  /**
   * Run `fn` under the queue, coalescing by `key`.
   *
   * @template T
   * @param {string} key Requests sharing a key share one execution.
   * @param {() => Promise<T>} fn
   * @returns {Promise<T>}
   * @throws {QueueFullError}
   */
  async run(key, fn) {
    // Join an identical request already in flight rather than duplicating it.
    const existing = this.inFlight.get(key);
    if (existing) {
      this.stats.coalesced++;
      return existing;
    }

    if (this.waiting.length >= this.maxDepth) {
      this.stats.rejected++;
      throw new QueueFullError(this.waiting.length);
    }

    this.stats.enqueued++;

    const promise = this._schedule(fn)
      .then((result) => { this.stats.completed++; return result; })
      .catch((err) => { this.stats.failed++; throw err; })
      .finally(() => { this.inFlight.delete(key); });

    this.inFlight.set(key, promise);

    // Every waiter gets the same rejection; without this, a coalesced failure
    // would surface as an unhandled rejection for all but the first caller.
    return promise;
  }

  /** Waits for a concurrency slot, then runs. */
  _schedule(fn) {
    if (this.active < this.concurrency) return this._execute(fn);

    return new Promise((resolve, reject) => {
      this.waiting.push(() => this._execute(fn).then(resolve, reject));
    });
  }

  async _execute(fn) {
    this.active++;
    try {
      return await fn();
    } finally {
      this.active--;
      const next = this.waiting.shift();
      if (next) next();
    }
  }

  snapshot() {
    return {
      ...this.stats,
      active: this.active,
      waiting: this.waiting.length,
      inFlight: this.inFlight.size,
      concurrency: this.concurrency,
    };
  }
}

module.exports = { RequestQueue, QueueFullError };

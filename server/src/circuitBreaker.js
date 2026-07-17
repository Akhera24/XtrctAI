'use strict';

/**
 * Circuit breaker for the upstream X API.
 *
 * When X is down or rejecting us, retrying every request is actively harmful:
 * each caller waits for a timeout before failing, so latency collapses to the
 * timeout value and the queue backs up behind requests that were never going to
 * succeed. The breaker converts that slow failure into a fast one, which is what
 * makes the degraded path (serve stale cache) usable instead of just late.
 *
 * States:
 *   CLOSED    normal; count failures, trip at threshold
 *   OPEN      reject immediately; after resetTimeoutMs, allow one probe
 *   HALF_OPEN one probe in flight; success closes, failure re-opens
 */

const State = Object.freeze({
  CLOSED: 'CLOSED',
  OPEN: 'OPEN',
  HALF_OPEN: 'HALF_OPEN',
});

class CircuitOpenError extends Error {
  constructor(retryAfterMs) {
    super('Circuit breaker is OPEN — upstream is failing, request not attempted');
    this.name = 'CircuitOpenError';
    this.code = 'CIRCUIT_OPEN';
    this.retryAfterMs = retryAfterMs;
  }
}

class CircuitBreaker {
  /**
   * @param {object}   opts
   * @param {number}   [opts.failureThreshold] Consecutive failures before tripping.
   * @param {number}   [opts.successThreshold] Probe successes needed to close.
   * @param {number}   [opts.resetTimeoutMs]   How long OPEN lasts before probing.
   * @param {(err: Error) => boolean} [opts.isFailure] Which errors count. Defaults
   *        to counting everything, but callers should exclude 4xx: a 404 for a
   *        nonexistent handle means the upstream is healthy and answering.
   * @param {() => number} [opts.now] Injectable clock.
   * @param {string}   [opts.name]
   */
  constructor({
    failureThreshold = 5,
    successThreshold = 2,
    resetTimeoutMs = 30_000,
    isFailure = () => true,
    now = () => Date.now(),
    name = 'upstream',
  } = {}) {
    this.failureThreshold = failureThreshold;
    this.successThreshold = successThreshold;
    this.resetTimeoutMs = resetTimeoutMs;
    this.isFailure = isFailure;
    this.now = now;
    this.name = name;

    this.state = State.CLOSED;
    this.failures = 0;
    this.successes = 0;
    this.openedAt = 0;
    this.probeInFlight = false;

    this.stats = { trips: 0, rejected: 0, successes: 0, failures: 0 };
  }

  /** @returns {boolean} true if a request may proceed right now. */
  _canAttempt() {
    if (this.state === State.CLOSED) return true;

    if (this.state === State.OPEN) {
      if (this.now() - this.openedAt >= this.resetTimeoutMs) {
        this.state = State.HALF_OPEN;
        this.successes = 0;
        this.probeInFlight = false;
        return true;
      }
      return false;
    }

    // HALF_OPEN: admit a single probe. Letting the full load through here would
    // re-hammer an upstream that has not proven it recovered.
    return !this.probeInFlight;
  }

  /**
   * Run `fn` under the breaker.
   * @template T
   * @param {() => Promise<T>} fn
   * @returns {Promise<T>}
   * @throws {CircuitOpenError} if the circuit is open.
   */
  async execute(fn) {
    if (!this._canAttempt()) {
      this.stats.rejected++;
      const retryAfterMs = Math.max(0, this.resetTimeoutMs - (this.now() - this.openedAt));
      throw new CircuitOpenError(retryAfterMs);
    }

    if (this.state === State.HALF_OPEN) this.probeInFlight = true;

    try {
      const result = await fn();
      this._onSuccess();
      return result;
    } catch (err) {
      if (this.isFailure(err)) {
        this._onFailure();
      } else {
        // Not an upstream health signal (e.g. 404). Clear the probe slot so a
        // half-open circuit isn't wedged by a request that told us nothing.
        this._onSuccess();
      }
      throw err;
    }
  }

  _onSuccess() {
    this.stats.successes++;
    this.probeInFlight = false;

    if (this.state === State.HALF_OPEN) {
      if (++this.successes >= this.successThreshold) {
        this.state = State.CLOSED;
        this.failures = 0;
        this.successes = 0;
      }
      return;
    }

    this.failures = 0;
  }

  _onFailure() {
    this.stats.failures++;
    this.probeInFlight = false;
    this.failures++;

    // A failed probe means "still broken" — go straight back to OPEN and
    // restart the cooldown rather than burning the remaining threshold.
    if (this.state === State.HALF_OPEN || this.failures >= this.failureThreshold) {
      this._trip();
    }
  }

  _trip() {
    if (this.state !== State.OPEN) this.stats.trips++;
    this.state = State.OPEN;
    this.openedAt = this.now();
    this.successes = 0;
  }

  /** For /health and tests. */
  snapshot() {
    return {
      name: this.name,
      state: this.state,
      failures: this.failures,
      ...this.stats,
    };
  }

  reset() {
    this.state = State.CLOSED;
    this.failures = 0;
    this.successes = 0;
    this.probeInFlight = false;
  }
}

module.exports = { CircuitBreaker, CircuitOpenError, State };

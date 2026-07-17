'use strict';

/**
 * Exponential backoff with full jitter.
 *
 * Jitter is the part that matters. Without it, N requests that fail together
 * retry together, and the retry storm re-creates the outage that caused the
 * failure. Full jitter (random in [0, exponential]) spreads them across the
 * whole interval; it beats fixed and equal-jitter backoff on both contention
 * and completion time. See AWS's "Exponential Backoff and Jitter" writeup.
 */

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Delay before attempt N (0-indexed), with full jitter applied.
 *
 * @param {number} attempt
 * @param {object} [opts]
 * @param {number} [opts.baseMs]
 * @param {number} [opts.maxMs]  Ceiling, so late attempts don't wait forever.
 * @param {number} [opts.factor]
 * @param {() => number} [opts.random] Injectable RNG for deterministic tests.
 * @returns {number} milliseconds
 */
function backoffDelay(attempt, { baseMs = 250, maxMs = 8_000, factor = 2, random = Math.random } = {}) {
  const exponential = Math.min(maxMs, baseMs * Math.pow(factor, attempt));
  return Math.floor(random() * exponential);
}

/**
 * Retry `fn` with exponential backoff.
 *
 * Honors an explicit `retryAfterMs` on the error over computed backoff — when
 * X tells us exactly when to come back (429 Retry-After), guessing is strictly
 * worse than listening.
 *
 * @template T
 * @param {(attempt: number) => Promise<T>} fn
 * @param {object} [opts]
 * @param {number} [opts.retries]        Retries after the initial attempt.
 * @param {number} [opts.baseMs]
 * @param {number} [opts.maxMs]
 * @param {(err: Error) => boolean} [opts.shouldRetry] Default: never retry 4xx
 *        except 429 — a malformed request fails identically no matter how many
 *        times it is repeated.
 * @param {(info: {attempt: number, delayMs: number, error: Error}) => void} [opts.onRetry]
 * @param {(ms: number) => Promise<void>} [opts.sleepFn] Injectable, so tests don't wait.
 * @param {() => number} [opts.random]
 * @returns {Promise<T>}
 */
async function withRetry(fn, {
  retries = 3,
  baseMs = 250,
  maxMs = 8_000,
  shouldRetry = defaultShouldRetry,
  onRetry = () => {},
  sleepFn = sleep,
  random = Math.random,
} = {}) {
  let lastError;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn(attempt);
    } catch (err) {
      lastError = err;

      if (attempt === retries || !shouldRetry(err)) throw err;

      const delayMs = Number.isFinite(err.retryAfterMs)
        ? err.retryAfterMs
        : backoffDelay(attempt, { baseMs, maxMs, random });

      onRetry({ attempt, delayMs, error: err });
      await sleepFn(delayMs);
    }
  }

  throw lastError;
}

/**
 * Retry 429, 5xx, and transport errors. Never retry other 4xx.
 * @param {Error & {status?: number, code?: string}} err
 */
function defaultShouldRetry(err) {
  if (err.code === 'CIRCUIT_OPEN') return false; // Fail fast; that's the point.

  const status = err.status ?? err.response?.status;
  if (status === 429) return true;
  if (status >= 500) return true;
  if (status >= 400) return false;

  return ['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN'].includes(err.code);
}

module.exports = { backoffDelay, withRetry, defaultShouldRetry, sleep };

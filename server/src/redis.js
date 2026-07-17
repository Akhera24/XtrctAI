'use strict';

const Redis = require('ioredis');

/**
 * Redis connection factory.
 *
 * Redis here is an optimization (cache + shared rate-limit state), not a
 * dependency. If it goes down, the proxy must degrade to in-process state and
 * keep serving — a cache whose failure takes down the service it fronts is a
 * net reliability loss.
 *
 * `enableOfflineQueue: false` is the load-bearing setting: the default buffers
 * commands while disconnected and resolves them on reconnect, which under load
 * means requests pile up invisibly and then time out all at once. We want an
 * immediate error we can fall back on.
 */

/**
 * @param {object} [opts]
 * @param {string} [opts.url]
 * @param {(evt: string, detail?: any) => void} [opts.onEvent]
 * @returns {import('ioredis').Redis}
 */
function createRedisClient({ url = process.env.REDIS_URL || 'redis://127.0.0.1:6379', onEvent = () => {} } = {}) {
  const client = new Redis(url, {
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    connectTimeout: 2_000,
    lazyConnect: true,

    // Reconnect with backoff, but keep trying — a Redis restart shouldn't need
    // a proxy restart to recover.
    retryStrategy: (times) => Math.min(times * 200, 5_000),
  });

  client.on('error', (err) => onEvent('error', err.message));
  client.on('ready', () => onEvent('ready'));
  client.on('close', () => onEvent('close'));
  client.on('reconnecting', () => onEvent('reconnecting'));

  // Without a listener, ioredis emits 'error' as an unhandled exception and
  // takes the process down on a Redis blip — precisely the failure this module
  // exists to survive.
  client.on('error', () => {});

  return client;
}

/** True when the client can actually serve a command right now. */
function isRedisReady(client) {
  return Boolean(client) && client.status === 'ready';
}

module.exports = { createRedisClient, isRedisReady };

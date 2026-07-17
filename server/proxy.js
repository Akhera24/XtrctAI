'use strict';

require('dotenv').config();

const axios = require('axios');
const { createApp } = require('./src/app');
const { createRedisClient, isRedisReady } = require('./src/redis');

/**
 * Entry point: wire real dependencies and listen.
 *
 * All composition happens here so every module below stays injectable and
 * testable without a live Redis or a live X API.
 */

const PORT = Number(process.env.PORT || 3000);
const BEARER_TOKEN = process.env.X_BEARER_TOKEN || process.env.TWITTER_API_BEARER_TOKEN;

function log(evt, detail) {
  const line = { ts: new Date().toISOString(), evt, ...(detail && typeof detail === 'object' ? detail : { detail }) };
  console.log(JSON.stringify(line));
}

if (!BEARER_TOKEN) {
  console.error(
    'FATAL: X_BEARER_TOKEN is not set.\n' +
      'Copy server/.env.example to server/.env and add your token from\n' +
      'https://developer.x.com/en/portal/dashboard\n'
  );
  process.exit(1);
}

const redis = createRedisClient({ onEvent: (evt, detail) => log(`redis_${evt}`, detail) });

// Connect eagerly for a clear startup signal, but never fatally: Redis is an
// optimization, and the proxy is designed to serve without it.
redis.connect().catch((err) => {
  log('redis_unavailable_at_startup', { message: err.message, impact: 'degrading to in-process cache' });
});

const { app, client } = createApp({
  http: axios.create(),
  redis,
  bearerToken: BEARER_TOKEN,
  limits: {
    concurrency: Number(process.env.UPSTREAM_CONCURRENCY || 8),
    cacheTtlMs: Number(process.env.CACHE_TTL_MS || 15 * 60 * 1000),
  },
  onEvent: log,
});

const server = app.listen(PORT, () => {
  log('server_started', {
    port: PORT,
    env: process.env.NODE_ENV || 'development',
    redis: isRedisReady(redis) ? 'connected' : 'connecting',
  });
});

/** Drain in-flight work before exiting so a deploy doesn't 502 live requests. */
async function shutdown(signal) {
  log('shutdown_started', { signal });
  server.close(async () => {
    try { await redis.quit(); } catch { /* already gone */ }
    log('shutdown_complete');
    process.exit(0);
  });

  setTimeout(() => {
    log('shutdown_forced', { reason: 'drain timeout exceeded' });
    process.exit(1);
  }, 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

module.exports = { app, client, server };

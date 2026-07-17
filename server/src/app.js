'use strict';

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const { XClient } = require('./xClient');

/**
 * Express app factory.
 *
 * Exported separately from the listener so tests can drive the real app over an
 * ephemeral port without a running server or a live X API.
 */

/**
 * @param {object} opts
 * @param {import('axios').AxiosInstance} opts.http
 * @param {import('ioredis').Redis} [opts.redis]
 * @param {string} opts.bearerToken
 * @param {object} [opts.limits]
 * @param {(evt: string, detail?: any) => void} [opts.onEvent]
 * @returns {{app: import('express').Express, client: XClient}}
 */
function createApp({ http, redis = null, bearerToken, limits = {}, onEvent = () => {} }) {
  const app = express();
  const client = new XClient({ http, redis, bearerToken, limits, onEvent });

  app.use(helmet());
  app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
  app.use(express.json({ limit: '64kb' }));

  // Per-IP guard. Distinct from the token bucket: this protects *us* from a
  // noisy client, the bucket protects our *X API budget*. A single abusive
  // caller shouldn't be able to burn the shared upstream allowance.
  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      max: Number(process.env.IP_RATE_LIMIT || 300),
      standardHeaders: true,
      legacyHeaders: false,
      // The benchmark drives thousands of requests from one IP; the per-IP guard
      // would measure itself instead of the stack under test.
      skip: () => process.env.DISABLE_IP_RATE_LIMIT === 'true',
    })
  );

  app.get('/health', async (req, res) => {
    const health = await client.health();
    const healthy = health.breaker.state !== 'OPEN';

    // 503 when the breaker is open so a load balancer can route away, rather
    // than reporting "ok" while every request degrades to stale.
    res.status(healthy ? 200 : 503).json({
      status: healthy ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      redis: redis && redis.status === 'ready' ? 'connected' : 'unavailable',
      ...health,
    });
  });

  /**
   * POST /api/proxy  { endpoint, params }
   *
   * The extension holds no X credentials — this is the trust boundary. Only
   * read-only GETs against an allowlist are forwarded, so a compromised client
   * cannot use the proxy as a generic authenticated relay to X.
   */
  app.post('/api/proxy', async (req, res) => {
    const { endpoint, params = {} } = req.body || {};

    if (!endpoint || typeof endpoint !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid "endpoint"' });
    }
    if (!isAllowedEndpoint(endpoint)) {
      return res.status(403).json({ error: 'Endpoint not allowed', endpoint });
    }
    if (params && typeof params !== 'object') {
      return res.status(400).json({ error: '"params" must be an object' });
    }

    try {
      const result = await client.get(endpoint, params);

      if (result.degraded) res.set('X-Data-Source', 'stale-cache');
      res.set('X-Cache', result.source.startsWith('cache') ? 'HIT' : 'MISS');

      return res.status(200).json({
        data: result.data,
        meta: { source: result.source, degraded: result.degraded, reason: result.reason },
      });
    } catch (err) {
      const status = err.status || err.response?.status || 502;
      const body = { error: err.message, code: err.code || 'UPSTREAM_ERROR', status };

      if (Number.isFinite(err.retryAfterMs)) {
        res.set('Retry-After', String(Math.ceil(err.retryAfterMs / 1000)));
        body.retryAfterMs = err.retryAfterMs;
      }
      if (err.details) body.details = err.details;

      onEvent('request_failed', { endpoint, status, code: body.code });
      return res.status(status).json(body);
    }
  });

  app.use((req, res) => res.status(404).json({ error: 'Not found' }));

  // eslint-disable-next-line no-unused-vars -- Express identifies error handlers by arity.
  app.use((err, req, res, next) => {
    onEvent('unhandled_error', { message: err.message });
    res.status(500).json({ error: 'Internal server error' });
  });

  return { app, client };
}

/**
 * Allowlist of read-only X API v2 endpoints this proxy will forward.
 * Anything not matched is rejected — the proxy is not a general-purpose relay.
 */
const ALLOWED_ENDPOINTS = [
  /^users\/by\/username\/[A-Za-z0-9_]{1,15}$/,
  /^users\/\d+$/,
  /^users\/\d+\/tweets$/,
  /^tweets\/\d+$/,
  /^tweets\/search\/recent$/,
];

function isAllowedEndpoint(endpoint) {
  const clean = endpoint.replace(/^\//, '').split('?')[0];
  return ALLOWED_ENDPOINTS.some((re) => re.test(clean));
}

module.exports = { createApp, isAllowedEndpoint, ALLOWED_ENDPOINTS };

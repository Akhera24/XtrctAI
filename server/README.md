# XtrctAI proxy

Fault-tolerant proxy for X API v2. Sits between the Chrome extension and X, and is the only component that holds credentials.

Full architecture, design rationale, and benchmark numbers are in the [root README](../README.md). This file is the operational reference.

## Run

```bash
cp .env.example .env     # add X_BEARER_TOKEN
npm install
npm start                # :3000
```

Redis is optional — without it, the proxy degrades to an in-process cache and a per-instance rate limiter, and says so in `/health`.

```bash
npm test                 # 31 tests, no network needed
npm run bench            # autocannon load harness
npm run bench -- --scenario=cold --connections=100
```

## API

### `POST /api/proxy`

```json
{ "endpoint": "users/by/username/jack", "params": { "user.fields": "public_metrics" } }
```

```json
{
  "data": { "...": "verbatim X API response body" },
  "meta": { "source": "x-api-v2:live", "degraded": false }
}
```

`meta.source` is always one of:

| Value | Meaning |
|---|---|
| `x-api-v2:live` | Fetched from X just now |
| `cache:local` / `cache:redis` | Fresh cache hit, no token spent |
| `cache:stale` | **Degraded.** X was unreachable; this data is expired but real. `meta.degraded` is `true` and `X-Data-Source: stale-cache` is set. |

Only read-only endpoints on an allowlist are forwarded (`server/src/app.js`). The proxy is not a general-purpose relay — a compromised client shouldn't be able to act as your app against X.

Errors:

| Status | Code | Meaning |
|---|---|---|
| 400 | — | Missing/invalid `endpoint` |
| 403 | — | Endpoint not on the allowlist |
| 429 | `RATE_LIMITED` | Token bucket exhausted. `Retry-After` is accurate. |
| 502 | `CIRCUIT_OPEN` | Breaker open — X is failing, request not attempted |
| 503 | `QUEUE_FULL` | Shedding load rather than growing an unbounded queue |

### `GET /health`

`200` normally; **`503` when the circuit breaker is OPEN**, so a load balancer routes away instead of seeing "ok" while every request degrades to stale.

```json
{
  "status": "ok",
  "redis": "connected",
  "breaker": { "state": "CLOSED", "trips": 0 },
  "cache": { "hitRate": 0.94, "staleServed": 0 },
  "queue": { "active": 2, "waiting": 0, "coalesced": 41 },
  "rateLimit": { "tokensAvailable": 287, "capacity": 300 }
}
```

## Deploy notes

- Set `CORS_ORIGIN` to your extension ID. Leaving it `*` lets any page call your proxy on your token.
- Terminate TLS in front of this. It speaks plain HTTP.
- `SIGTERM` drains in-flight requests (10s cap) before exit, so deploys don't 502 live traffic.
- Run behind a process manager. One instance per Redis is fine; the bucket is shared across instances by design.

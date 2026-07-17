# XtrctAI

A Chrome extension that analyzes X (Twitter) profiles — follower ratios, engagement rates, an influence score — backed by a Node proxy that does the unglamorous work of staying inside X's rate limits without falling over.

The extension is the demo. The proxy is the actual engineering.

---

## The problem this solves

X's API v2 gives you **300 requests per 15 minutes** on an app-level bearer token. That's one request every three seconds, shared across every user of your app. Blow through it and you get 429s for the rest of the window.

That constraint drives every design decision here:

- **A browser extension can't hold the credentials.** Anything shipped in the bundle can be extracted by anyone who installs it and unzips the `.crx`. So the extension holds *no* X credentials at all — it talks only to the proxy, and the proxy is the trust boundary. This isn't a nice-to-have; it's the only arrangement where the token isn't public.
- **A fixed-window counter isn't good enough.** The naive approach (count requests, reset every 15 minutes) permits 600 requests across a window boundary — 300 at 14:59:59, 300 at 15:00:01. That's the exact burst pattern that gets an app throttled. This uses a token bucket instead.
- **The 300/15min budget is a hard ceiling on *new* profiles.** No amount of engineering makes it 301. What engineering *can* do is make sure repeat reads never spend a token, and that the budget is never wasted on duplicate or doomed requests. That's what most of the proxy is.

## How it works

```
Extension popup
      │  POST /api/proxy { endpoint, params }     ← no credentials, ever
      ▼
┌─────────────────────────────────────────────┐
│  Proxy (Node/Express)                       │
│                                             │
│   cache ──── fresh? ────────────────► return│
│     │ miss                                  │
│     ▼                                       │
│   queue ──── identical request in flight?   │
│     │        join it, don't duplicate       │
│     ▼                                       │
│   token bucket ── budget left? ── no ─►429  │
│     │ yes                                   │
│     ▼                                       │
│   circuit breaker ── upstream dead? ─► fail │
│     │ closed                          fast  │
│     ▼                                       │
│   retry w/ exponential backoff + jitter     │
└─────┬───────────────────────────────────────┘
      ▼
   X API v2  ──► reconcile bucket against x-rate-limit headers
```

Every layer below the cache falls back to **stale-if-available**, clearly labeled as stale. The one thing the proxy never does is invent a number: every response says where its data came from via `meta.source` and `meta.degraded`.

### The pieces worth reading

| File | What's interesting about it |
|---|---|
| [`server/src/tokenBucket.js`](server/src/tokenBucket.js) | Refill-and-take as a **Lua script**, so it's atomic inside Redis. Doing it as GET/compute/SET in Node races under concurrency and over-admits — precisely under the load it exists to survive. Falls back to an in-process bucket if Redis dies. |
| [`server/src/circuitBreaker.js`](server/src/circuitBreaker.js) | CLOSED → OPEN → HALF_OPEN, admitting exactly one probe on recovery. Deliberately does *not* count 4xx as upstream failure — a 404 for a handle that doesn't exist means X is healthy and answering. |
| [`server/src/queue.js`](server/src/queue.js) | Single-flight coalescing. 500 concurrent requests for `@jack` become **one** upstream call whose result fans out to all 500 waiters. Highest-leverage thing in the request path, by a wide margin. |
| [`server/src/cache.js`](server/src/cache.js) | Redis in front of a bounded in-process LRU. Entries carry their own `expiresAt` so an expired entry is still *readable* — that's what makes stale-while-error possible. |
| [`server/src/backoff.js`](server/src/backoff.js) | Full jitter. Without it, N requests that fail together retry together and the retry storm recreates the outage. |

## Measured behavior

Numbers from `npm run bench` (autocannon, Apple M-series, local Redis, **stubbed upstream at a fixed 80ms**). Reproduce with `cd server && npm run bench`.

**Warm path** — repeat reads of the same profile, 500 concurrent connections, 10s:

| | |
|---|---|
| Throughput | **9,851 req/sec** |
| Latency p50 | **43 ms** |
| Latency p95¹ | **65 ms** |
| Success rate | 100% (0 non-2xx, 0 errors) |
| 98,499 client requests → | **1 upstream call** |

**Cold path** — every request a unique profile, so nothing caches or coalesces:

61,676 requests flooded in. **Exactly 303 reached X**: 300 tokens of capacity, plus ~3 refilled during the 10-second run at 0.333/sec. The remaining 61,373 got a 429 with an accurate `Retry-After`. That's the whole point — under a 61k-request flood, the bucket spent exactly the budget and not one token more.

**Read those two numbers together, because either one alone is misleading:**

- The 9,851/sec figure is **proxy overhead on cached reads with a stubbed upstream**. It is not "9,851 profiles analyzed per second from X," and it never could be.
- Sustained analysis of *new* profiles is capped at **300 per 15 minutes — 0.33/sec** — by X's budget. That's a property of X's pricing, not of this code. The engineering makes the ceiling *reachable and graceful*, not higher.

## Running it

Requires Node ≥ 20, Redis, and Chrome ≥ 88.

```bash
git clone https://github.com/Akhera24/XtrctAI.git
cd XtrctAI
```

**1. Start the proxy.** It needs an X API bearer token — get one from the [X Developer Portal](https://developer.x.com/en/portal/dashboard) (your app must be attached to a Project, or v2 returns 403 `client-not-enrolled`).

```bash
cd server
cp .env.example .env        # then add your X_BEARER_TOKEN
npm install
redis-server &              # optional — the proxy degrades to in-process cache without it
npm start
```

**2. Build and load the extension.**

```bash
cd ..
npm install
npm run build             # → dist/
```

`chrome://extensions` → enable Developer mode → *Load unpacked* → select **`dist/`**.

The extension talks to `http://localhost:3000` by default.

**Pointing it at a deployed proxy takes a manifest edit, not just a setting.** `background.js` reads `proxyUrl` from `chrome.storage.local`, but two things in `manifest.json` are deliberately scoped to localhost and will block anything else:

```jsonc
"host_permissions": ["http://localhost:3000/*"],
"content_security_policy": {
  "extension_pages": "... connect-src 'self' http://localhost:3000"
}
```

Add your proxy's origin to **both** before deploying. This is scoped tight on purpose — the previous manifest requested `https://*.herokuapp.com/*`, a wildcard over every app on Heroku, which is the kind of permission that gets an extension rejected from the Web Store and deserves to be.

### Tests

```bash
cd server && npm test       # 31 tests, no network required — upstream is stubbed
```

They're mostly unhappy-path: Redis unreachable, upstream returning 500s, the breaker mid-recovery, 200 concurrent takes against a 50-token bucket, a clock stepping backwards. The happy path was never the risk.

## Project layout

```
manifest.json          MV3 manifest — 2 permissions (storage, contextMenus)
background.js          service worker — talks to the proxy, holds no credentials
content.js             overlay injected on x.com
popup/                 extension UI
scripts/               content-script helpers, icon/DOM utilities
webpack.config.js      bundles the above into dist/. No .env injection, on purpose.
server/
  proxy.js             entry point: wires real deps, listens
  src/
    app.js             Express app factory (exported for tests)
    xClient.js         composes cache → queue → bucket → breaker → backoff
    tokenBucket.js     Redis + Lua, atomic
    circuitBreaker.js  CLOSED/OPEN/HALF_OPEN
    cache.js           Redis + in-process LRU, stale-while-error
    queue.js           single-flight coalescing, bounded depth
    backoff.js         exponential backoff, full jitter
  test/                31 tests
  bench/load.js        autocannon harness
```

## License

MIT

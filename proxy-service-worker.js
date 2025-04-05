// proxy-service-worker.js
const PROXY_CONFIG = {
  TARGET_ORIGIN: 'https://143.198.111.238:3000',
  API_PATH: '/api/proxy',
  ALLOWED_METHODS: ['GET', 'POST', 'PUT', 'DELETE'],
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000,
  TIMEOUT: 10000
};

self.addEventListener('fetch', (event) => {
  if (event.request.url.includes('/api/proxy')) {
    event.respondWith(handleProxyRequest(event.request));
  }
});

async function handleProxyRequest(request) {
  let retries = 0;
  
  while (retries < PROXY_CONFIG.MAX_RETRIES) {
    try {
      const proxyUrl = new URL(request.url);
      proxyUrl.protocol = PROXY_CONFIG.TARGET_ORIGIN.split('://')[0];
      proxyUrl.host = PROXY_CONFIG.TARGET_ORIGIN.split('://')[1];
      
      const proxyRequest = new Request(proxyUrl, {
        method: request.method,
        headers: new Headers(request.headers),
        body: request.method !== 'GET' ? await request.clone().text() : undefined,
        mode: 'cors',
        credentials: 'omit'
      });

      // Add retry count to headers for debugging
      proxyRequest.headers.set('X-Retry-Count', retries.toString());

      const response = await fetch(proxyRequest);
      
      // Handle different response statuses
      if (response.ok) {
        return response;
      } else if (response.status === 429) {
        // Rate limit hit, wait and retry
        const retryAfter = parseInt(response.headers.get('Retry-After')) || PROXY_CONFIG.RETRY_DELAY;
        await new Promise(resolve => setTimeout(resolve, retryAfter));
        retries++;
        continue;
      } else {
        // Other error statuses should be handled by the client
        return response;
      }
    } catch (error) {
      if (retries >= PROXY_CONFIG.MAX_RETRIES - 1) {
        return new Response(JSON.stringify({
          error: 'Proxy request failed',
          message: error.message,
          retries: retries
        }), {
          status: 500,
          headers: {
            'Content-Type': 'application/json'
          }
        });
      }
      retries++;
      await new Promise(resolve => setTimeout(resolve, PROXY_CONFIG.RETRY_DELAY));
    }
  }
}

// Handle CORS preflight requests
self.addEventListener('options', (event) => {
  event.respondWith(handlePreflightRequest(event.request));
});

function handlePreflightRequest(request) {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': PROXY_CONFIG.ALLOWED_METHODS.join(', '),
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Proxy-Auth',
      'Access-Control-Max-Age': '86400'
    }
  });
} 
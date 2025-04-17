// proxy-service-worker.js
const PROXY_CONFIG = {
  TARGET_ORIGIN: 'https://143.198.111.238:3000',
  API_PATH: '/api/proxy',
  ALLOWED_METHODS: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000,
  TIMEOUT: 10000,
  CORS_HEADERS: {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Proxy-Auth, X-Test-Connection',
    'Access-Control-Max-Age': '86400'
  }
};

// Listen for fetch events
self.addEventListener('fetch', (event) => {
  if (shouldHandleRequest(event.request)) {
    event.respondWith(handleProxyRequest(event.request));
  }
});

// Determine if we should handle this request
function shouldHandleRequest(request) {
  // Handle requests to our proxy path
  if (request.url.includes('/api/proxy')) {
    return true;
  }
  
  // Handle OPTIONS requests for CORS preflight
  if (request.method === 'OPTIONS') {
    return true;
  }
  
  return false;
}

async function handleProxyRequest(request) {
  // Handle CORS preflight requests
  if (request.method === 'OPTIONS') {
    return handlePreflightRequest(request);
  }
  
  let retries = 0;
  
  while (retries < PROXY_CONFIG.MAX_RETRIES) {
    try {
      // Ensure proper URL construction
      const proxyUrl = new URL(PROXY_CONFIG.TARGET_ORIGIN + PROXY_CONFIG.API_PATH);
      
      // Clone request for manipulation
      const requestInit = {
        method: request.method,
        headers: new Headers(request.headers),
        body: ['GET', 'HEAD', 'OPTIONS'].includes(request.method) ? undefined : await request.clone().text(),
        mode: 'cors',
        credentials: 'omit',
        redirect: 'follow',
        cache: 'no-store',
        referrerPolicy: 'no-referrer'
      };

      // Add retry count to headers for debugging
      requestInit.headers.set('X-Retry-Count', retries.toString());
      
      // Create a new request
      const proxyRequest = new Request(proxyUrl.toString(), requestInit);

      // Set a timeout to abort the request if it takes too long
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), PROXY_CONFIG.TIMEOUT);
      
      try {
        // Make the request with the abort signal
        const response = await fetch(proxyRequest, { signal: controller.signal });
        
        // Clear the timeout
        clearTimeout(timeoutId);
        
        // Handle different response statuses
        if (response.ok) {
          // Add CORS headers to response
          const responseHeaders = new Headers(response.headers);
          
          // Add CORS headers
          Object.entries(PROXY_CONFIG.CORS_HEADERS).forEach(([key, value]) => {
            responseHeaders.set(key, value);
          });
          
          // Return the modified response
          return new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers: responseHeaders
          });
        } else if (response.status === 429) {
          // Rate limit hit, wait and retry
          const retryAfter = parseInt(response.headers.get('Retry-After')) || PROXY_CONFIG.RETRY_DELAY;
          console.log(`Rate limit hit, retrying after ${retryAfter}ms`);
          await new Promise(resolve => setTimeout(resolve, retryAfter));
          retries++;
          continue;
        } else {
          // Other error statuses should be handled by the client, but add CORS headers
          const responseHeaders = new Headers(response.headers);
          
          // Add CORS headers
          Object.entries(PROXY_CONFIG.CORS_HEADERS).forEach(([key, value]) => {
            responseHeaders.set(key, value);
          });
          
          return new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers: responseHeaders
          });
        }
      } catch (abortError) {
        clearTimeout(timeoutId);
        if (abortError.name === 'AbortError') {
          console.error('Request timed out');
          
          if (retries >= PROXY_CONFIG.MAX_RETRIES - 1) {
            return createErrorResponse('Request timed out after ' + PROXY_CONFIG.TIMEOUT + 'ms', 504);
          }
          
          retries++;
          await new Promise(resolve => setTimeout(resolve, PROXY_CONFIG.RETRY_DELAY));
          continue;
        }
        throw abortError;
      }
    } catch (error) {
      console.error('Proxy request error:', error);
      
      if (retries >= PROXY_CONFIG.MAX_RETRIES - 1) {
        return createErrorResponse(
          'Proxy request failed: ' + (error.message || 'Unknown error'),
          500
        );
      }
      
      retries++;
      await new Promise(resolve => setTimeout(resolve, PROXY_CONFIG.RETRY_DELAY));
    }
  }
  
  // If we get here, all retries failed
  return createErrorResponse('Max retries exceeded', 503);
}

// Create an error response with CORS headers
function createErrorResponse(message, status = 500) {
  const headers = new Headers();
  
  // Add CORS headers
  Object.entries(PROXY_CONFIG.CORS_HEADERS).forEach(([key, value]) => {
    headers.set(key, value);
  });
  
  // Add content type
  headers.set('Content-Type', 'application/json');
  
  return new Response(
    JSON.stringify({
      error: message,
      status: status,
      timestamp: new Date().toISOString()
    }),
    {
      status: status,
      headers: headers
    }
  );
}

// Handle CORS preflight requests
function handlePreflightRequest(request) {
  const headers = new Headers();
  
  // Add CORS headers
  Object.entries(PROXY_CONFIG.CORS_HEADERS).forEach(([key, value]) => {
    headers.set(key, value);
  });
  
  // Extract the request headers to check what's being requested
  const requestHeaders = request.headers.get('Access-Control-Request-Headers');
  if (requestHeaders) {
    headers.set('Access-Control-Allow-Headers', requestHeaders);
  }
  
  return new Response(null, {
    status: 204, // No content
    headers: headers
  });
}

// Listen for message events (for debugging)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'GET_STATUS') {
    event.ports[0].postMessage({
      status: 'active',
      config: PROXY_CONFIG
    });
  }
});

// Log any errors
self.addEventListener('error', (event) => {
  console.error('ServiceWorker error:', event.error);
});

// Handle unhandled promise rejections
self.addEventListener('unhandledrejection', (event) => {
  console.error('ServiceWorker unhandled promise rejection:', event.reason);
}); 
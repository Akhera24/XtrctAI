// Enhanced X Profile Analyzer Background Script
// Fixed version with comprehensive proxy integration and comprehensive rate limiting

console.log('🚀 X Profile Analyzer background script loading...');

// ─────────────────────────────────────────────────────────────────────────────
// Proxy configuration
//
// This extension holds ZERO API credentials. A Chrome extension is distributed
// as a plain zip archive, so anything embedded in it — including a "secret" —
// is readable by every user who installs it. All X API credentials therefore
// live server-side, on the proxy, which is the trust boundary. The extension is
// an unauthenticated client of that proxy and nothing more.
//
// Proxy contract:
//   POST {PROXY_URL}/api/proxy  body: { endpoint, method, params }
//        → 200: the X API JSON response body
//        → otherwise: { error, status, details? }
//   GET  {PROXY_URL}/health
//
// The base URL is configurable at runtime via chrome.storage.local under the
// key `proxyUrl` (e.g. set it to your deployed proxy). Default is localhost so
// that a fresh clone of this public repo points at nothing but the developer's
// own machine.
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_PROXY_URL = 'http://localhost:3000';
const PROXY_URL_STORAGE_KEY = 'proxyUrl';
const PROXY_REQUEST_PATH = '/api/proxy';
const PROXY_HEALTH_PATH = '/health';

// Honest data-source labels. Only data that actually came back from the proxy
// may be labelled live; anything else must say so plainly.
const SOURCE_LIVE = 'X API v2 (live via proxy)';
const SOURCE_CACHED = 'X API v2 (live via proxy, cached)';
const SOURCE_UNAVAILABLE = 'Unavailable (proxy unreachable)';

// Read the configured proxy base URL, falling back to the default.
async function getProxyBaseUrl() {
  try {
    const stored = await chrome.storage.local.get([PROXY_URL_STORAGE_KEY]);
    const configured = stored?.[PROXY_URL_STORAGE_KEY];

    if (typeof configured === 'string' && configured.trim()) {
      // Strip trailing slashes so path joins stay well-formed.
      return configured.trim().replace(/\/+$/, '');
    }
  } catch (error) {
    console.warn('⚠️ Could not read proxy URL from storage, using default:', error.message);
  }

  return DEFAULT_PROXY_URL;
}

// Proxy Integration System for X Profile Analyzer
// Routes every X API call through the credential-holding proxy server.

class ProxyClient {
  constructor() {
    this.baseUrl = DEFAULT_PROXY_URL;
    this.baseUrlLoaded = false;
    this.isProxyAvailable = false;
    this.lastProxyCheck = 0;
    this.lastRequestTime = 0;
    this.minRequestInterval = 1000; // Simple client-side request spacing
    this.maxRetries = 3;
    this.retryDelay = 2000;
    this.timeout = 15000;
  }

  // Resolve the configured base URL (once, unless forced to re-read).
  async ensureBaseUrl(force = false) {
    if (!this.baseUrlLoaded || force) {
      this.baseUrl = await getProxyBaseUrl();
      this.baseUrlLoaded = true;
    }
    return this.baseUrl;
  }

  get proxyEndpoint() {
    return `${this.baseUrl}${PROXY_REQUEST_PATH}`;
  }

  get healthEndpoint() {
    return `${this.baseUrl}${PROXY_HEALTH_PATH}`;
  }

  // Space out requests so we never hammer the proxy. Real rate limiting is the
  // server's job — it holds the credentials and therefore the quota.
  async throttle() {
    const elapsed = Date.now() - this.lastRequestTime;

    if (elapsed < this.minRequestInterval) {
      const delay = this.minRequestInterval - elapsed;
      console.log(`⏱️ Spacing requests, waiting ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    this.lastRequestTime = Date.now();
  }

  // Probe proxy health. Used for status display and connectivity tests; it does
  // NOT gate requests, so a stale "unavailable" flag can never wedge the client.
  async checkProxyStatus() {
    await this.ensureBaseUrl(true);
    this.lastProxyCheck = Date.now();

    try {
      console.log(`🔍 Checking proxy server at ${this.baseUrl}...`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(this.healthEndpoint, {
        method: 'GET',
        mode: 'cors',
        credentials: 'omit',
        signal: controller.signal,
        headers: { 'Accept': 'application/json' }
      });

      clearTimeout(timeoutId);

      this.isProxyAvailable = response.ok;

      if (response.ok) {
        console.log('✅ Proxy server is available');
      } else {
        console.warn(`⚠️ Proxy health check returned ${response.status}`);
      }

      return this.isProxyAvailable;
    } catch (error) {
      console.warn(`⚠️ Proxy server unreachable at ${this.baseUrl}:`, error.message);
      this.isProxyAvailable = false;
      return false;
    }
  }

  // Error surfaced when the proxy cannot be reached at all. Actionable on
  // purpose: the user needs to know the extension is not broken, the proxy is.
  unreachableError() {
    return new Error(
      `Proxy server unreachable at ${this.baseUrl}. Start the proxy server, or set a different ` +
      `URL in chrome.storage.local under "${PROXY_URL_STORAGE_KEY}". ` +
      `The extension holds no API credentials of its own and cannot fetch data without the proxy.`
    );
  }

  // Make a request through the proxy with retry logic
  async makeProxyRequest(endpoint, params = {}, method = 'GET', retryCount = 0) {
    await this.ensureBaseUrl();
    await this.throttle();

    const requestData = {
      endpoint: endpoint.replace(/^\//, ''), // Remove leading slash
      method: method.toUpperCase(),
      params: params || {},
      timestamp: Date.now()
    };

    console.log(`🌐 Making proxy request to: ${endpoint}`);
    console.log(`📋 Request data:`, requestData);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(this.proxyEndpoint, {
        method: 'POST',
        mode: 'cors',
        credentials: 'omit',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        },
        body: JSON.stringify(requestData),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      console.log(`📡 Proxy response status: ${response.status} ${response.statusText}`);

      // Handle different response statuses
      if (response.status === 429) {
        // Rate limit hit
        const retryAfter = response.headers.get('Retry-After') || 60;
        throw new Error(`Rate limit exceeded. Retry after ${retryAfter} seconds.`);
      }

      if (response.status === 502 || response.status === 503 || response.status === 504) {
        // Server errors - try backup proxy or retry
        if (retryCount < this.maxRetries) {
          console.log(`🔄 Server error ${response.status}, retrying... (${retryCount + 1}/${this.maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, this.retryDelay * (retryCount + 1)));
          return this.makeProxyRequest(endpoint, params, method, retryCount + 1);
        }
        throw new Error(`Proxy server error: ${response.status}`);
      }

      if (!response.ok) {
        // Proxy failure contract: { error, status, details? }
        let errorMessage = `HTTP ${response.status}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.message || errorMessage;

          if (errorData.details) {
            errorMessage += ` (${typeof errorData.details === 'string'
              ? errorData.details
              : JSON.stringify(errorData.details)})`;
          }
        } catch (parseError) {
          // Non-JSON error body; keep the default HTTP status message.
        }
        throw new Error(errorMessage);
      }

      // Parse successful response — this is the X API JSON body, relayed verbatim.
      const data = await response.json();
      console.log('✅ Proxy request successful');

      this.isProxyAvailable = true;

      return {
        data: data,
        headers: response.headers,
        status: response.status,
        ok: response.ok
      };

  } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error('Request timeout - proxy server took too long to respond');
      }

      // Network-level failure means the proxy could not be reached at all.
      const isNetworkError = error instanceof TypeError || error.message.includes('fetch');

      if (isNetworkError) {
        this.isProxyAvailable = false;

        if (retryCount < this.maxRetries) {
          console.log(`🔄 Network error, retrying... (${retryCount + 1}/${this.maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, this.retryDelay * (retryCount + 1)));
          return this.makeProxyRequest(endpoint, params, method, retryCount + 1);
        }

        throw this.unreachableError();
      }

      throw error;
    }
  }

  // Get proxy status for UI display
  getProxyStatus() {
    return {
      available: this.isProxyAvailable,
      url: this.baseUrl,
      lastChecked: this.lastProxyCheck
    };
  }
}

// X API Client — proxy-only.
// There is deliberately no direct-to-X code path: the extension has no
// credentials, so a direct call could only ever fail (or leak a secret if one
// were reintroduced). If the proxy is down, that is an error the user sees.
class XAPIClient {
  constructor() {
    this.proxyClient = new ProxyClient();
    this.rateLimitTracker = null; // Will be set when rateLimitTracker is available
    console.log('🔧 XAPIClient initialized (proxy-only, no client-side credentials)');
  }

  // Set rate limit tracker reference
  setRateLimitTracker(tracker) {
    this.rateLimitTracker = tracker;
  }

  // Make an API request through the proxy.
  async makeAPIRequest(endpoint, params = {}) {
    console.log(`🚀 Starting API request for: ${endpoint}`);

    try {
      const result = await this.proxyClient.makeProxyRequest(endpoint, params);

      // Record the request for local request-spacing/backoff bookkeeping.
      if (this.rateLimitTracker) {
        this.rateLimitTracker.recordRequest(result.headers);
      }

      return {
        ...result,
        source: SOURCE_LIVE,
        success: true
      };
    } catch (error) {
      console.error('❌ Proxy request failed:', error.message);

      // The proxy owns the quota; a 429 from it just means "back off".
      if (error.message.includes('Rate limit') || error.message.includes('429')) {
        if (this.rateLimitTracker) {
          this.rateLimitTracker.handleRateLimitHit();
        }
      }

      throw error;
    }
  }

  // Get connection status for UI
  getConnectionStatus() {
    return {
      proxy: this.proxyClient.getProxyStatus(),
      rateLimits: this.rateLimitTracker ? this.rateLimitTracker.getRateLimitStatus() : {}
    };
  }
}

// Client-side request budget for the proxy.
//
// This is NOT the authoritative rate limit. The proxy holds the credentials and
// therefore owns the real X API quota and enforces it. What follows is only a
// local politeness budget plus a record of whatever the server last told us
// (via x-rate-limit-* headers, when the proxy forwards them), so the UI can show
// the user why a request is being held back.
const LOCAL_BUDGET_WINDOW = 15 * 60 * 1000; // 15 minutes
const LOCAL_BUDGET_REQUESTS = 300;          // Conservative local default

class RateLimitTracker {
  constructor() {
    this.limit = this.freshBudget();
    this.serverReported = false;

    this.initializeStorage();
  }

  freshBudget() {
    return {
      used: 0,
      total: LOCAL_BUDGET_REQUESTS,
      resetTime: Date.now() + LOCAL_BUDGET_WINDOW,
      window: LOCAL_BUDGET_WINDOW,
      lastReset: Date.now()
    };
  }

  async initializeStorage() {
    try {
      const stored = await chrome.storage.local.get(['rateLimitData']);

      // Older builds stored a per-credential map (config1..config4 + proxy).
      // Those credentials are gone; keep only the proxy budget if present.
      const restored = stored.rateLimitData?.proxy;

      if (restored && typeof restored.used === 'number') {
        this.limit = { ...this.freshBudget(), ...restored };
        console.log('✅ Proxy request budget restored from storage');
      } else {
        await this.saveToStorage();
        console.log('✅ Proxy request budget initialized');
      }
    } catch (error) {
      console.error('❌ Failed to initialize request budget storage:', error);
      this.limit = this.freshBudget();
    }
  }

  async saveToStorage() {
    try {
      await chrome.storage.local.set({ rateLimitData: { proxy: this.limit } });
    } catch (error) {
      console.error('❌ Failed to save request budget:', error);
    }
  }

  // Check whether the local budget allows another request.
  canMakeRequest() {
    const now = Date.now();

    if (now >= this.limit.resetTime) {
      this.resetBudget();
      return true;
    }

    return (this.limit.total - this.limit.used) > 0;
  }

  resetBudget() {
    this.limit.used = 0;
    this.limit.resetTime = Date.now() + this.limit.window;
    this.limit.lastReset = Date.now();
    this.serverReported = false;

    console.log('🔄 Local request budget window reset');
    this.saveToStorage();
  }

  // Record a request. Prefers the server's own numbers when it reports them.
  recordRequest(responseHeaders = null) {
    if (Date.now() >= this.limit.resetTime) {
      this.resetBudget();
    }

    this.limit.used++;

    if (responseHeaders && typeof responseHeaders.get === 'function') {
      const remaining = responseHeaders.get('x-rate-limit-remaining');
      const limitHeader = responseHeaders.get('x-rate-limit-limit');
      const reset = responseHeaders.get('x-rate-limit-reset');

      const parsedLimit = parseInt(limitHeader, 10);
      if (!isNaN(parsedLimit) && parsedLimit > 0) {
        this.limit.total = parsedLimit;
        this.serverReported = true;
      }

      const parsedRemaining = parseInt(remaining, 10);
      if (!isNaN(parsedRemaining) && parsedRemaining >= 0) {
        this.limit.used = Math.max(0, this.limit.total - parsedRemaining);
        this.serverReported = true;
      }

      const resetTime = parseInt(reset, 10) * 1000; // seconds → ms
      if (!isNaN(resetTime) && resetTime > Date.now()) {
        this.limit.resetTime = resetTime;
        this.serverReported = true;
      }
    }

    console.log(`📈 Request recorded: ${this.limit.used}/${this.limit.total} used`);
    this.saveToStorage();
  }

  // Get status for UI display. Keyed by 'proxy' — the only request path there is.
  getRateLimitStatus() {
    const now = Date.now();
    const remaining = Math.max(0, this.limit.total - this.limit.used);

    return {
      proxy: {
        used: this.limit.used,
        total: this.limit.total,
        remaining,
        resetIn: Math.max(0, this.limit.resetTime - now),
        resetAt: new Date(this.limit.resetTime).toISOString(),
        percentage: Math.round((this.limit.used / this.limit.total) * 100),
        // Makes clear whether these numbers came from the server or are a local guess.
        reportedByServer: this.serverReported
      }
    };
  }

  // Back off after the server says we are rate limited.
  handleRateLimitHit(resetTime = null) {
    this.limit.used = this.limit.total; // Mark budget exhausted
    this.limit.resetTime = resetTime || (Date.now() + LOCAL_BUDGET_WINDOW);

    console.log(`🚫 Rate limited by server. Backing off until: ${new Date(this.limit.resetTime).toISOString()}`);
    this.saveToStorage();
  }

  // Clear budget data (for testing/reset)
  clearAllLimits() {
    this.limit = this.freshBudget();
    this.serverReported = false;
    this.saveToStorage();
    console.log('🗑️ Request budget cleared');
  }
}

// Initialize the rate limit tracker and API client
const rateLimitTracker = new RateLimitTracker();
const xApiClient = new XAPIClient();

// Set up the connection between tracker and API client
xApiClient.setRateLimitTracker(rateLimitTracker);

// Make global instances available
if (typeof window !== 'undefined') {
  window.rateLimitTracker = rateLimitTracker;
  window.xApiClient = xApiClient;
}

// Global state management
let extensionInitialized = false;
let apiClient = null;
let analysisCache = new Map();
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

// Field sets requested from the X API (via the proxy).
const USER_FIELDS = 'created_at,description,entities,id,location,name,profile_image_url,protected,public_metrics,url,username,verified,verified_type,withheld';
const TWEET_FIELDS = 'created_at,public_metrics,entities,context_annotations,author_id,conversation_id,referenced_tweets,reply_settings,source,lang,possibly_sensitive';

// Initialize extension
chrome.runtime.onStartup.addListener(initializeExtension);
chrome.runtime.onInstalled.addListener((details) => {
  console.log('🔧 Extension installed/updated:', details.reason);
  initializeExtension();
});

async function initializeExtension() {
  if (extensionInitialized) {
    console.log('⚠️ Extension already initialized, skipping...');
    return;
  }

  try {
    console.log('🔧 Initializing X Profile Analyzer extension...');
    
    // Clear existing context menus first to avoid duplicates
    try {
      await chrome.contextMenus.removeAll();
      console.log('🗑️ Cleared existing context menus');
    } catch (error) {
      console.warn('⚠️ Could not clear context menus:', error.message);
    }
    
    // Create context menu
    try {
      chrome.contextMenus.create({
        id: 'analyzeProfile',
        title: 'Analyze X Profile',
        contexts: ['page', 'link'],
        documentUrlPatterns: ['https://twitter.com/*', 'https://x.com/*']
      });
      console.log('✅ Context menu created');
    } catch (contextError) {
      if (!contextError.message.includes('duplicate')) {
        console.warn('⚠️ Context menu creation warning:', contextError.message);
      }
    }
    
    // Initialize API client
    apiClient = new XProfileAPI();
    await apiClient.initialize();
    
    // Clear old cache
    analysisCache.clear();
    
    extensionInitialized = true;
    console.log('✅ X Profile Analyzer extension initialization complete!');
    
  } catch (error) {
    console.error('❌ Error during extension initialization:', error);
    // Continue with limited functionality
    extensionInitialized = true;
  }
}

// Enhanced XProfileAPI class using new proxy integration system
class XProfileAPI {
  constructor() {
    this.initialized = false;
    console.log('🔌 XProfileAPI instance created with proxy integration');
  }

  async initialize() {
    try {
      console.log('🔧 Initializing XProfileAPI with enhanced proxy support...');
      
      // Check if xApiClient is available
      if (!xApiClient) {
        throw new Error('XAPIClient not available');
      }
      
      // Check proxy status and connection
      const connectionStatus = xApiClient.getConnectionStatus();
      console.log('🔍 Connection status:', connectionStatus);
      
      this.initialized = true;
      console.log('✅ XProfileAPI initialized with proxy integration');
      
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize XProfileAPI:', error);
      this.initialized = false;
      throw error;
    }
  }

  // Get user by username using the new proxy system
  async getUserByUsername(username) {
    try {
      console.log(`👤 Fetching user data for: ${username}`);
      
      if (!this.initialized) {
        await this.initialize();
      }
      
      if (!username || typeof username !== 'string') {
        throw new Error('Invalid username provided');
      }

      const cleanUsername = username.replace(/^@/, '').trim().toLowerCase();
      if (!cleanUsername) {
        throw new Error('Username cannot be empty');
      }

      // Route through the proxy — the extension has no credentials of its own.
      const endpoint = `users/by/username/${cleanUsername}`;
      const params = {
        'user.fields': USER_FIELDS
      };

      const response = await xApiClient.makeAPIRequest(endpoint, params);
      const data = response.data;

      if (data.errors && data.errors.length > 0) {
        const error = data.errors[0];
        console.error('❌ X API returned error:', error);
        
        if (error.detail && error.detail.includes('User has been suspended')) {
          throw new Error(`The account @${cleanUsername} has been suspended by X.`);
        } else if (error.detail && error.detail.includes('Not Found Error')) {
          throw new Error(`The account @${cleanUsername} was not found.`);
        } else if (error.title === 'Authorization Error') {
          throw new Error("The proxy server could not authenticate with the X API. Check the proxy's credentials.");
        } else {
          throw new Error(`X API Error: ${error.detail || error.title || 'Unknown error'}`);
        }
      }

      if (!data || !data.data) {
        throw new Error(`No user data found for username: ${cleanUsername}`);
      }

      console.log(`✅ Successfully fetched user data for: ${username} via ${response.source}`);
      return data.data;

    } catch (error) {
      console.error(`❌ Error in getUserByUsername for ${username}:`, error);
      throw error;
    }
  }

  // Enhanced user tweets fetching with comprehensive rate limiting and error handling
  async getUserTweets(userId, maxResults = 20) {
    try {
      console.log(`📝 Fetching tweets for user ID: ${userId} (max: ${maxResults})`);
      
      if (!this.initialized) {
        await this.initialize();
      }
      
      if (!userId) {
        throw new Error('User ID is required');
      }

      // Respect the local request budget before spending a proxy call.
      if (!rateLimitTracker.canMakeRequest()) {
        throw new Error('Rate limit exceeded. Please wait a few minutes and try again.');
      }

      const endpoint = `users/${userId}/tweets`;
      const params = {
        'max_results': Math.min(maxResults, 100),
        'tweet.fields': TWEET_FIELDS,
        'user.fields': 'name,username,verified,public_metrics',
        'exclude': 'retweets' // Keep replies for better analysis
      };

      console.log('📡 Making tweets API request via proxy...');
      const response = await xApiClient.makeAPIRequest(endpoint, params);

      // Enhanced response validation
      if (!response) {
        throw new Error('No response received from API');
      }

      const data = response.data || response;

      // Handle API errors
      if (data.errors && data.errors.length > 0) {
        const error = data.errors[0];
        console.error('❌ X API returned error for tweets:', error);
        
        if (error.title === 'Authorization Error' || error.code === 401) {
          throw new Error(`API authorization failed while fetching tweets: ${error.detail || error.title}`);
        } else if (error.title === 'Too Many Requests' || error.code === 429) {
          throw new Error(`Rate limit exceeded while fetching tweets: ${error.detail || error.title}`);
        } else if (error.code === 404) {
          console.log(`⚠️ User ${userId} not found or tweets are protected`);
          return [];
        } else {
          throw new Error(`X API Error: ${error.detail || error.title || 'Unknown error'}`);
        }
      }

      // Handle successful but empty responses
      if (!data || !data.data || !Array.isArray(data.data)) {
        console.log(`⚠️ No tweets found for user ID: ${userId} - user may have no tweets or protected account`);
        return [];
      }

      // Filter out potentially sensitive content for analysis
      const filteredTweets = data.data.filter(tweet => 
        tweet && 
        tweet.text && 
        !tweet.possibly_sensitive &&
        tweet.text.length > 10 // Ensure meaningful content
      );

      console.log(`✅ Successfully fetched ${filteredTweets.length}/${data.data.length} tweets for user ID: ${userId} via proxy`);

      // Note: the request is already recorded by XAPIClient.makeAPIRequest.
      return filteredTweets;

    } catch (error) {
      console.error(`❌ Error in getUserTweets for ${userId}:`, error);

      // Handle specific error types
      if (error.message.includes('rate limit') || error.message.includes('Rate limit') || error.message.includes('Too Many Requests')) {
        console.log('⏳ Rate limit encountered, backing off');
        throw new Error(`Rate limit exceeded. Please wait a few minutes and try again.`);
      } else if (error.message.includes('authorization') || error.message.includes('Authorization Error')) {
        // Credentials live on the proxy, so this is a server-side configuration problem.
        throw new Error(`The proxy server could not authenticate with the X API. Check the proxy's credentials.`);
      } else if (error.message.includes('not found') || error.message.includes('404')) {
        // User not found or protected - return empty array
        console.log(`👤 User ${userId} not found or has protected tweets`);
        return [];
      }
      
      // For other errors, log and return empty array to prevent complete failure
      console.log('🔄 Returning empty tweets array due to error, analysis will continue with available data');
      return [];
    }
  }

  // Get request budget status including proxy info
  getRateLimitStatus() {
    const trackerStatus = rateLimitTracker.getRateLimitStatus();
    const connectionStatus = xApiClient.getConnectionStatus();

    let totalRemaining = 0;
    let totalUsed = 0;
    let totalLimit = 0;

    Object.values(trackerStatus).forEach(status => {
      totalRemaining += status.remaining;
      totalUsed += status.used;
      totalLimit += status.total;
    });

    return {
      ...trackerStatus,
      summary: {
        totalRemaining,
        totalUsed,
        totalLimit,
        percentage: totalLimit > 0 ? Math.round((totalUsed / totalLimit) * 100) : 0,
        proxyAvailable: connectionStatus.proxy.available,
        proxyUrl: connectionStatus.proxy.url
      }
    };
  }
}

// Analysis Engine
// NOTE: currently unused — generateProfileAnalysis() below is what the message
// handlers call. Kept as a library; callers must pass the real data source.
class AnalysisEngine {
  static analyzeProfile(userData, tweets = [], followers = [], source = SOURCE_LIVE) {
    console.log('🔍 Starting comprehensive profile analysis...');

    const user = userData.data || userData;
    const tweetData = tweets.data || tweets;
    const followerData = followers.data || followers;

    const metrics = {
      followers: user.public_metrics?.followers_count || 0,
      following: user.public_metrics?.following_count || 0,
      tweets: user.public_metrics?.tweet_count || 0,
      listed: user.public_metrics?.listed_count || 0
    };

    const accountAge = this.calculateAccountAge(user.created_at);
    const healthScore = this.calculateHealthScore(user, metrics);
    const profileCompleteness = this.calculateProfileCompleteness(user);
    const contentAnalysis = this.analyzeContent(tweetData);
    const engagementAnalysis = this.analyzeEngagement(tweetData, metrics.followers);
    const audienceAnalysis = this.analyzeAudience(followerData, user);
    const recommendations = this.generateRecommendations(user, metrics, contentAnalysis, engagementAnalysis);

    const analysis = {
      username: user.username,
      displayName: user.name,
      profileImage: user.profile_image_url,
      bio: user.description,
      location: user.location,
      verified: user.verified || false,
      accountAge: accountAge,
      metrics: metrics,
      healthScore: healthScore,
      profileCompleteness: profileCompleteness,
      contentAnalysis: contentAnalysis,
      engagementAnalysis: engagementAnalysis,
      audienceAnalysis: audienceAnalysis,
      recommendations: recommendations,
      analysisDate: new Date().toISOString(),
      // Honest labelling: the caller states where the data came from. This must
      // never be hardcoded to "live" — that is how estimated data gets passed
      // off as real API results.
      dataSource: source,
      tweetsAnalyzed: tweetData.length,
      followersAnalyzed: followerData.length,
      isRealData: source === SOURCE_LIVE
    };

    console.log('✅ Profile analysis completed');
    return analysis;
  }

  static calculateAccountAge(createdAt) {
    if (!createdAt) return { days: 0, years: 0, description: 'Unknown' };
    
    const created = new Date(createdAt);
    const now = new Date();
    const diffTime = Math.abs(now - created);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const diffYears = (diffDays / 365).toFixed(1);
    
    return {
      days: diffDays,
      years: parseFloat(diffYears),
      description: `${diffYears} years (${diffDays.toLocaleString()} days)`
    };
  }

  static calculateHealthScore(user, metrics) {
    let score = 0;

    // Profile completeness (30 points)
    if (user.name) score += 5;
    if (user.description) score += 10;
    if (user.location) score += 5;
    if (user.profile_image_url && !user.profile_image_url.includes('default')) score += 10;

    // Activity level (25 points)
    const tweetsPerDay = metrics.tweets / Math.max(this.calculateAccountAge(user.created_at).days, 1);
    if (tweetsPerDay > 1) score += 25;
    else if (tweetsPerDay > 0.5) score += 20;
    else if (tweetsPerDay > 0.1) score += 15;
    else score += 5;

    // Follower-to-following ratio (20 points)
    const ratio = metrics.following > 0 ? metrics.followers / metrics.following : metrics.followers;
    if (ratio > 10) score += 20;
    else if (ratio > 2) score += 15;
    else if (ratio > 0.5) score += 10;
    else score += 5;

    // Verification and credibility (15 points)
    if (user.verified) score += 15;
    else if (metrics.listed > 10) score += 10;
    else if (metrics.listed > 0) score += 5;

    // Follower count tier (10 points)
    if (metrics.followers > 10000) score += 10;
    else if (metrics.followers > 1000) score += 8;
    else if (metrics.followers > 100) score += 6;
    else if (metrics.followers > 10) score += 4;
    else score += 2;

    return {
      score: Math.min(score, 100),
      percentage: Math.round((Math.min(score, 100) / 100) * 100),
      tier: score >= 80 ? 'Excellent' : score >= 60 ? 'Good' : score >= 40 ? 'Average' : 'Needs Improvement'
    };
  }

  static calculateProfileCompleteness(user) {
    const fields = [
      { field: 'name', weight: 15, present: !!user.name },
      { field: 'description', weight: 25, present: !!user.description },
      { field: 'location', weight: 15, present: !!user.location },
      { field: 'url', weight: 10, present: !!user.url },
      { field: 'profile_image', weight: 20, present: user.profile_image_url && !user.profile_image_url.includes('default') },
      { field: 'verified', weight: 15, present: !!user.verified }
    ];

    const completedWeight = fields.filter(f => f.present).reduce((sum, f) => sum + f.weight, 0);
    const totalWeight = fields.reduce((sum, f) => sum + f.weight, 0);
    
    return {
      percentage: Math.round((completedWeight / totalWeight) * 100),
      completedFields: fields.filter(f => f.present).map(f => f.field),
      missingFields: fields.filter(f => !f.present).map(f => f.field)
    };
  }

  static analyzeContent(tweets) {
    if (!tweets || tweets.length === 0) {
      return {
        totalTweets: 0,
        themes: [],
        avgLength: 0,
        postingPattern: 'No recent activity'
      };
    }

    const themes = this.detectContentThemes(tweets);
    const avgLength = tweets.reduce((sum, tweet) => sum + (tweet.text?.length || 0), 0) / tweets.length;
    const postingPattern = this.analyzePostingPattern(tweets);

    return {
      totalTweets: tweets.length,
      themes: themes,
      avgLength: Math.round(avgLength),
      postingPattern: postingPattern
    };
  }

  static detectContentThemes(tweets) {
    const themeKeywords = {
      'Technology': ['tech', 'ai', 'software', 'coding', 'development', 'programming'],
      'Business': ['business', 'startup', 'entrepreneur', 'marketing', 'sales'],
      'Personal Development': ['growth', 'learning', 'motivation', 'success', 'goals'],
      'News & Politics': ['news', 'politics', 'government', 'policy', 'election'],
      'Entertainment': ['movie', 'music', 'game', 'fun', 'entertainment'],
      'Sports': ['sport', 'football', 'basketball', 'soccer', 'game', 'team']
    };

    const themeScores = {};
    const tweetTexts = tweets.map(t => t.text?.toLowerCase() || '').join(' ');

    Object.entries(themeKeywords).forEach(([theme, keywords]) => {
      const matches = keywords.filter(keyword => tweetTexts.includes(keyword)).length;
      if (matches > 0) {
        themeScores[theme] = matches;
      }
    });

    return Object.entries(themeScores)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([theme, score]) => ({ theme, relevance: Math.min(score * 10, 100) }));
  }

  static analyzePostingPattern(tweets) {
    if (tweets.length === 0) return 'No activity';

    const dates = tweets.map(t => new Date(t.created_at)).sort((a, b) => b - a);
    const daysDiff = (dates[0] - dates[dates.length - 1]) / (1000 * 60 * 60 * 24);
    const tweetsPerDay = tweets.length / Math.max(daysDiff, 1);

    if (tweetsPerDay >= 5) return 'Very Active (5+ tweets/day)';
    if (tweetsPerDay >= 2) return 'Active (2-5 tweets/day)';
    if (tweetsPerDay >= 1) return 'Regular (1-2 tweets/day)';
    if (tweetsPerDay >= 0.3) return 'Moderate (2-3 tweets/week)';
    return 'Infrequent (less than weekly)';
  }

  static analyzeEngagement(tweets, followerCount) {
    if (!tweets || tweets.length === 0) {
      return {
        avgLikes: 0,
        avgRetweets: 0,
        avgReplies: 0,
        engagementRate: 0
      };
    }

    const totalLikes = tweets.reduce((sum, t) => sum + (t.public_metrics?.like_count || 0), 0);
    const totalRetweets = tweets.reduce((sum, t) => sum + (t.public_metrics?.retweet_count || 0), 0);
    const totalReplies = tweets.reduce((sum, t) => sum + (t.public_metrics?.reply_count || 0), 0);

    const avgLikes = Math.round(totalLikes / tweets.length);
    const avgRetweets = Math.round(totalRetweets / tweets.length);
    const avgReplies = Math.round(totalReplies / tweets.length);

    const totalEngagements = totalLikes + totalRetweets + totalReplies;
    const engagementRate = followerCount > 0 ? 
      ((totalEngagements / tweets.length) / followerCount) * 100 : 0;

    return {
      avgLikes,
      avgRetweets,
      avgReplies,
      engagementRate: Math.round(engagementRate * 100) / 100
    };
  }

  static analyzeAudience(followers, user) {
    if (!followers || followers.length === 0) {
      return {
        sampleSize: 0,
        avgFollowers: 0,
        verifiedCount: 0,
        audienceType: 'Unknown'
      };
    }

    const avgFollowers = Math.round(
      followers.reduce((sum, f) => sum + (f.public_metrics?.followers_count || 0), 0) / followers.length
    );

    const verifiedCount = followers.filter(f => f.verified).length;
    
    let audienceType = 'General';
    if (avgFollowers > 10000) audienceType = 'Influencer Network';
    else if (verifiedCount > followers.length * 0.1) audienceType = 'High-Value Audience';
    else if (avgFollowers > 1000) audienceType = 'Engaged Community';

    return {
      sampleSize: followers.length,
      avgFollowers,
      verifiedCount,
      verifiedPercentage: Math.round((verifiedCount / followers.length) * 100),
      audienceType
    };
  }

  static generateRecommendations(user, metrics, contentAnalysis, engagementAnalysis) {
    const recommendations = [];

    if (!user.description) {
      recommendations.push({
        type: 'Profile',
        priority: 'High',
        title: 'Add Bio Description',
        description: 'Complete your profile with a compelling bio to increase follower conversion'
      });
    }

    if (!user.location) {
      recommendations.push({
        type: 'Profile',
        priority: 'Medium',
        title: 'Add Location',
        description: 'Adding your location helps with local discovery and networking'
      });
    }

    if (contentAnalysis.avgLength < 50) {
      recommendations.push({
        type: 'Content',
        priority: 'Medium',
        title: 'Increase Tweet Length',
        description: 'Longer tweets tend to generate more engagement. Aim for 100-200 characters.'
      });
    }

    if (engagementAnalysis.engagementRate < 2) {
      recommendations.push({
        type: 'Engagement',
        priority: 'High',
        title: 'Improve Engagement Rate',
        description: 'Focus on creating content that encourages likes, retweets, and replies'
      });
    }

    const followerRatio = metrics.following > 0 ? metrics.followers / metrics.following : metrics.followers;
    if (followerRatio < 0.5 && metrics.followers < 1000) {
      recommendations.push({
        type: 'Growth',
        priority: 'Medium',
        title: 'Curate Following List',
        description: 'Consider unfollowing inactive accounts to improve your follower-to-following ratio'
      });
    }

    return recommendations;
  }
}

// Message handlers
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('📨 Background received message:', request.action);

  // Handle async responses
  if (request.action === 'analyze') {
    handleAnalyzeProfile(request, sendResponse);
    return true; // Keep message channel open for async response
  } else if (request.action === 'testApi') {
    handleTestApi(request, sendResponse);
    return true;
  } else if (request.action === 'getRateLimitStatus') {
    handleGetRateLimitStatus(request, sendResponse);
    return true;
  } else if (request.action === 'clearRateLimits') {
    handleClearRateLimits(request, sendResponse);
    return true;
  }

  return false;
});

// Enhanced analyze profile handler with comprehensive rate limiting
async function handleAnalyzeProfile(request, sendResponse) {
  try {
    const { username, postUrl } = request;
    console.log(`🔍 Starting analysis for: ${username}`);

    if (!username) {
      throw new Error('Username is required for analysis');
    }

    // Check cache first
      const cacheKey = `profile_${username.toLowerCase()}`;
      const cached = analysisCache.get(cacheKey);
      
      if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
        console.log('📦 Returning cached analysis');
        sendResponse({
          success: true,
        data: cached.data,
        cached: true,
        rateLimitStatus: apiClient ? apiClient.getRateLimitStatus() : null,
        // Live data, but served from cache — say so rather than implying a fresh call.
        source: SOURCE_CACHED
        });
        return;
    }

    // Initialize API client if needed
    if (!apiClient) {
      apiClient = new XProfileAPI();
      await apiClient.initialize();
    }

    console.log('📡 Fetching fresh profile data...');
    
    // Fetch user data
    const userData = await apiClient.getUserByUsername(username);
    
    if (!userData) {
      throw new Error(`No user data found for @${username}`);
    }

    console.log('📝 Fetching user tweets...');
    
    // Fetch recent tweets. A failure here is not fatal — the profile data is
    // still live — but it must be reported, not silently treated as "no engagement".
    let tweets = [];
    let tweetsError = null;
    try {
      tweets = await apiClient.getUserTweets(userData.id, 20);
    } catch (tweetError) {
      console.warn('⚠️ Could not fetch tweets:', tweetError.message);
      tweets = [];
      tweetsError = tweetError.message;
    }

    // Generate comprehensive analysis
    const analysis = await generateProfileAnalysis(userData, tweets, { tweetsError });

    // Cache the result
    analysisCache.set(cacheKey, {
      data: analysis,
      timestamp: Date.now()
    });

    // Get current rate limit status
    const rateLimitStatus = apiClient.getRateLimitStatus();

    console.log('✅ Analysis completed successfully');
    
    sendResponse({
      success: true,
      data: analysis,
      cached: false,
      rateLimitStatus,
      // Reflects what the data actually is, including the degraded case.
      source: analysis.dataSource
    });

  } catch (error) {
    console.error('❌ Analysis failed:', error);

    // Get rate limit status even on error
    let rateLimitStatus = null;
    try {
      rateLimitStatus = apiClient ? apiClient.getRateLimitStatus() : null;
    } catch (statusError) {
      console.warn('⚠️ Could not get rate limit status:', statusError.message);
    }

    // No data is returned on failure. The extension cannot reach X without the
    // proxy, and inventing plausible numbers to fill the gap would be a lie.
    sendResponse({
      success: false,
      error: error.message,
      source: SOURCE_UNAVAILABLE,
      rateLimitStatus,
      requiresAction: error.message.includes('Rate limit') ? 'wait' : 'retry'
    });
  }
}

// Test API handler with rate limit integration
async function handleTestApi(request, sendResponse) {
  try {
    console.log('🔬 Testing API connectivity...');
    
    if (!apiClient) {
      apiClient = new XProfileAPI();
      await apiClient.initialize();
    }

    // Confirm the proxy itself is up before spending a request on it.
    await xApiClient.proxyClient.checkProxyStatus();

    // Test with Elon Musk profile (known to exist and be public)
    const testResponse = await apiClient.getUserByUsername('elonmusk');

    const rateLimitStatus = apiClient.getRateLimitStatus();

    sendResponse({
      success: true,
      message: '✅ Proxy connection successful',
      data: {
        testUser: testResponse.username,
        followers: testResponse.public_metrics?.followers_count || 0,
        verified: testResponse.verified || false
      },
      rateLimitStatus,
      source: SOURCE_LIVE,
      proxyStatus: {
        available: rateLimitStatus.summary?.proxyAvailable || false,
        url: rateLimitStatus.summary?.proxyUrl || 'Unknown'
      }
    });

  } catch (error) {
    console.error('❌ API test failed:', error);
    
    let rateLimitStatus = null;
    try {
      rateLimitStatus = apiClient ? apiClient.getRateLimitStatus() : null;
    } catch (statusError) {
      console.warn('⚠️ Could not get rate limit status:', statusError.message);
    }
    
    sendResponse({
      success: false,
      error: error.message,
      source: SOURCE_UNAVAILABLE,
      rateLimitStatus,
      diagnostic: {
        apiInitialized: !!apiClient,
        proxyUrl: xApiClient.proxyClient.baseUrl,
        proxyAvailable: rateLimitStatus?.summary?.proxyAvailable || false,
        // Credentials are the proxy's responsibility, never the extension's.
        credentialsHeldByExtension: false
      }
    });
  }
}

// Get rate limit status handler
async function handleGetRateLimitStatus(request, sendResponse) {
  try {
    let rateLimitStatus = null;
    
    if (apiClient) {
      rateLimitStatus = apiClient.getRateLimitStatus();
    } else {
      // Return tracker status even without API client
      rateLimitStatus = rateLimitTracker.getRateLimitStatus();
    }
    
    sendResponse({
      success: true,
      rateLimitStatus
    });
    
  } catch (error) {
    console.error('❌ Failed to get rate limit status:', error);
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

// Clear rate limits handler (for testing/reset)
async function handleClearRateLimits(request, sendResponse) {
  try {
    console.log('🗑️ Clearing all rate limit data...');
    
    rateLimitTracker.clearAllLimits();
    
    // Clear analysis cache as well
    analysisCache.clear();
    
    sendResponse({
      success: true,
      message: '✅ Rate limits cleared successfully'
    });
    
  } catch (error) {
    console.error('❌ Failed to clear rate limits:', error);
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

// Context menu handler
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'analyzeProfile') {
    console.log('🖱️ Context menu clicked');
    
    let username = '';
    
    // Extract username from URL or selected text
    if (info.pageUrl) {
      const urlMatch = info.pageUrl.match(/(?:twitter\.com|x\.com)\/([^\/\s]+)/);
      if (urlMatch && urlMatch[1]) {
        username = urlMatch[1];
      }
    }
    
    if (info.selectionText) {
      const selectionMatch = info.selectionText.match(/@?([a-zA-Z0-9_]+)/);
      if (selectionMatch && selectionMatch[1]) {
        username = selectionMatch[1];
      }
    }
    
    if (username) {
      console.log(`🔍 Analyzing profile from context menu: ${username}`);
      chrome.action.openPopup();
      
      // Store the username for the popup to use
      chrome.storage.local.set({ contextMenuUsername: username });
    } else {
      console.warn('⚠️ Could not extract username from context');
    }
  }
});

// Profile analysis built strictly from data the proxy actually returned.
//
// Honesty rule: every number below is derived from a live X API response or it
// is omitted. Nothing here invents, estimates, or randomises a metric. When the
// recent-posts request fails, engagement is reported as unavailable rather than
// as zero — zero is a measurement, "unavailable" is the truth.
async function generateProfileAnalysis(userData, tweets, meta = {}) {
  console.log('🧠 Generating comprehensive profile analysis...');

  const { tweetsError = null } = meta;

  // Engagement is only measurable if the tweets request actually succeeded.
  const engagementMeasured = !tweetsError && Array.isArray(tweets) && tweets.length > 0;

  const metrics = userData.public_metrics || {};
  const accountAge = userData.created_at ?
    Math.floor((Date.now() - new Date(userData.created_at).getTime()) / (1000 * 60 * 60 * 24)) : 0;

  // Analyze engagement patterns from tweets
  let avgEngagement = 0;
  let totalEngagement = 0;
  let tweetAnalysis = {
    totalTweets: tweets.length,
    avgLikes: 0,
    avgRetweets: 0,
    avgReplies: 0,
    mostEngagedTweet: null,
    recentActivity: 'Unknown'
  };

  if (tweets && tweets.length > 0) {
    tweets.forEach(tweet => {
      if (tweet.public_metrics) {
        const engagement = tweet.public_metrics.like_count + 
                         tweet.public_metrics.retweet_count + 
                         tweet.public_metrics.reply_count;
        totalEngagement += engagement;
        
        if (!tweetAnalysis.mostEngagedTweet || engagement > 
            (tweetAnalysis.mostEngagedTweet.public_metrics?.like_count || 0) +
            (tweetAnalysis.mostEngagedTweet.public_metrics?.retweet_count || 0) +
            (tweetAnalysis.mostEngagedTweet.public_metrics?.reply_count || 0)) {
          tweetAnalysis.mostEngagedTweet = tweet;
    }
  }
});

    avgEngagement = tweets.length > 0 ? totalEngagement / tweets.length : 0;
    tweetAnalysis.avgLikes = tweets.reduce((sum, t) => sum + (t.public_metrics?.like_count || 0), 0) / tweets.length;
    tweetAnalysis.avgRetweets = tweets.reduce((sum, t) => sum + (t.public_metrics?.retweet_count || 0), 0) / tweets.length;
    tweetAnalysis.avgReplies = tweets.reduce((sum, t) => sum + (t.public_metrics?.reply_count || 0), 0) / tweets.length;
    
    // Determine activity level
    const latestTweet = tweets[0];
    if (latestTweet && latestTweet.created_at) {
      const daysSinceLastTweet = Math.floor((Date.now() - new Date(latestTweet.created_at).getTime()) / (1000 * 60 * 60 * 24));
      if (daysSinceLastTweet === 0) tweetAnalysis.recentActivity = 'Very Active (Today)';
      else if (daysSinceLastTweet <= 3) tweetAnalysis.recentActivity = 'Active (This Week)';
      else if (daysSinceLastTweet <= 7) tweetAnalysis.recentActivity = 'Moderate (Past Week)';
      else if (daysSinceLastTweet <= 30) tweetAnalysis.recentActivity = 'Low (Past Month)';
      else tweetAnalysis.recentActivity = 'Inactive (Over a Month)';
    }
  }
  
  // Calculate influence score.
  // Engagement rate is null (not 0) when we could not measure it — 0 would be a
  // claim that this account gets no engagement, which we do not know.
  const followerRatio = metrics.following_count > 0 ? metrics.followers_count / metrics.following_count : 0;
  const engagementRate = engagementMeasured && metrics.followers_count > 0
    ? (avgEngagement / metrics.followers_count) * 100
    : null;

  const influenceScore = Math.min(100, Math.round(
    (Math.log10((metrics.followers_count || 0) + 1) * 10) +
    (followerRatio > 10 ? 20 : followerRatio > 5 ? 15 : followerRatio > 2 ? 10 : 5) +
    ((engagementRate || 0) * 2) +
    (userData.verified ? 15 : 0) +
    (accountAge > 365 ? 10 : accountAge > 180 ? 5 : 0)
  ));

  // Generate insights
  const insights = [];

  if (userData.verified) {
    insights.push('✓ Verified account with authentic credibility');
  }

  if (metrics.followers_count > 1000000) {
    insights.push('🌟 Mega-influencer with massive reach');
  } else if (metrics.followers_count > 100000) {
    insights.push('📈 Major influencer with significant impact');
  } else if (metrics.followers_count > 10000) {
    insights.push('💪 Established presence with strong following');
  }

  if (followerRatio > 10) {
    insights.push('👑 High-value account with excellent follower ratio');
  } else if (followerRatio < 0.1) {
    insights.push('👥 Follows many accounts, likely for networking');
  }

  // Only draw engagement conclusions when engagement was actually measured.
  // Previously an unavailable tweets request left engagementRate at 0, which
  // silently produced a "Low engagement" verdict from data we never had.
  if (engagementMeasured) {
    if (engagementRate > 5) {
      insights.push('🔥 Exceptional engagement rate');
    } else if (engagementRate > 2) {
      insights.push('💬 Good audience engagement');
    } else if (engagementRate < 0.5) {
      insights.push('📊 Low engagement relative to follower count');
    }
  } else {
    insights.push('ℹ️ Recent posts were unavailable, so engagement could not be measured');
  }

  if (accountAge > 365 * 5) {
    insights.push('🏛️ Veteran user with long-standing presence');
  } else if (accountAge < 30) {
    insights.push('🆕 New account, building presence');
  }

  // Label the source by what we actually got back, never by what we hoped for.
  const source = engagementMeasured
    ? SOURCE_LIVE
    : `${SOURCE_LIVE} — profile only, engagement unavailable`;

  return {
    profile: {
      username: userData.username,
      displayName: userData.name,
      bio: userData.description || 'No bio available',
      location: userData.location || 'Location not specified',
      profileImageUrl: userData.profile_image_url,
      verified: userData.verified || false,
      protected: userData.protected || false,
      accountAge: accountAge,
      joinDate: userData.created_at
    },
    metrics: {
      followers: metrics.followers_count || 0,
      following: metrics.following_count || 0,
      tweets: metrics.tweet_count || 0,
      listed: metrics.listed_count || 0,
      followerRatio: Math.round(followerRatio * 100) / 100,
      engagementRate: engagementRate === null ? null : Math.round(engagementRate * 100) / 100
    },
    // Surfaced at the top level so the popup's existing warning banner fires.
    isFallbackData: false,
    dataSource: source,
    warning: engagementMeasured ? null : (
      tweetsError
        ? `Recent posts could not be fetched (${tweetsError}). Profile figures are live; engagement was not measured.`
        : 'No recent posts were available, so engagement could not be measured.'
    ),
    analysis: {
      influenceScore,
      category: influenceScore > 80 ? 'Elite Influencer' :
                influenceScore > 60 ? 'Major Influencer' :
                influenceScore > 40 ? 'Established User' :
                influenceScore > 20 ? 'Active User' : 'Casual User',
      insights,
      // Omitted entirely when unmeasured: the popup hides the section rather
      // than rendering zeros that look like real measurements.
      tweetAnalysis: engagementMeasured ? tweetAnalysis : null,
      engagementMeasured,
      lastAnalyzed: new Date().toISOString(),
      source
    }
  };
}

console.log('✅ Background script loaded (proxy-only, zero client-side credentials)');

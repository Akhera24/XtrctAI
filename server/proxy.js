// X API Proxy Server
// A secure server-side proxy for X API calls to avoid CORS issues and protect API credentials

require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const { createProxyMiddleware } = require('http-proxy-middleware');
const proxyConfig = require('./config/proxy');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['chrome-extension://*', 'https://x-analyzer.web.app'] 
    : '*'
}));
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// API credentials
const twitterApi = {
  bearerToken: process.env.TWITTER_API_BEARER_TOKEN,
  apiKey: process.env.TWITTER_API_KEY,
  apiKeySecret: process.env.TWITTER_API_KEY_SECRET,
  baseUrl: 'https://api.twitter.com/2'
};

// DigitalOcean proxy configuration
const doProxyConfig = proxyConfig.loadProxyConfig();
const proxyValidation = proxyConfig.validateProxyConfig(doProxyConfig);

// Log proxy configuration status
console.log('DigitalOcean proxy status:', doProxyConfig.enabled ? 'Enabled' : 'Disabled');
if (doProxyConfig.enabled) {
  console.log(`Proxy host: ${proxyConfig.formatProxyUrl(doProxyConfig)}`);
  
  // Log any warnings
  if (proxyValidation.warnings.length > 0) {
    console.warn('Proxy configuration warnings:');
    proxyValidation.warnings.forEach(warning => {
      console.warn(`- ${warning}`);
    });
  }
}

// Validate environment variables
function validateConfig() {
  if (!twitterApi.bearerToken) {
    console.error('ERROR: Missing TWITTER_API_BEARER_TOKEN environment variable');
    return false;
  }
  
  console.log('API configuration loaded successfully');
  return true;
}

// Configuration endpoint to securely retrieve proxy settings
app.get('/config', (req, res) => {
  res.json({
    proxy: {
      enabled: doProxyConfig.enabled,
      host: doProxyConfig.host,
      port: doProxyConfig.port,
      // Never expose auth credentials
      requiresAuth: !!(doProxyConfig.auth.username && doProxyConfig.auth.password)
    },
    environment: process.env.NODE_ENV || 'development'
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    proxy: {
      enabled: doProxyConfig.enabled,
      operational: true
    },
    environment: process.env.NODE_ENV || 'development'
  });
});

// Proxy authentication middleware
function validateProxyAuth(req, res, next) {
  // Only check auth if proxy is enabled and has credentials
  if (doProxyConfig.enabled && doProxyConfig.auth.username && doProxyConfig.auth.password) {
    const authHeader = req.headers['proxy-authorization'] || '';
    if (!authHeader.startsWith('Basic ')) {
      return res.status(401).json({ error: 'Proxy authentication required' });
    }

    const base64Credentials = authHeader.split(' ')[1];
    const credentials = Buffer.from(base64Credentials, 'base64').toString('utf8');
    const [username, password] = credentials.split(':');

    if (username !== doProxyConfig.auth.username || password !== doProxyConfig.auth.password) {
      return res.status(401).json({ error: 'Invalid proxy credentials' });
    }
  }
  next();
}

// Main proxy endpoint
app.post('/api/proxy', validateProxyAuth, async (req, res) => {
  try {
    // Extract request details
    const { endpoint, method = 'GET', params = {} } = req.body;
    
    if (!endpoint) {
      return res.status(400).json({ error: 'Missing endpoint parameter' });
    }
    
    console.log(`Proxying request: ${method} ${endpoint}`);
    
    // Construct URL
    const url = endpoint.startsWith('http') 
      ? endpoint 
      : `${twitterApi.baseUrl}/${endpoint.replace(/^\//, '')}`;
    
    // Make API request
    const response = await makeTwitterApiRequest(url, method, params);
    
    // Forward the API response
    res.status(200).json(response.data);
    
  } catch (error) {
    console.error('Proxy error:', error.message);
    
    // Determine appropriate status code
    const statusCode = error.response?.status || 500;
    
    // Extract error details
    let errorResponse = {
      error: error.message,
      status: statusCode
    };
    
    if (error.response?.data) {
      errorResponse.details = error.response.data;
    }
    
    res.status(statusCode).json(errorResponse);
  }
});

/**
 * Makes a request to the Twitter API with authentication
 */
async function makeTwitterApiRequest(url, method, params) {
  const requestConfig = {
    method: method,
    url: url,
    headers: {
      'Authorization': `Bearer ${twitterApi.bearerToken}`,
      'Content-Type': 'application/json'
    }
  };
  
  // Add parameters based on request method
  if (method === 'GET') {
    requestConfig.params = params;
  } else {
    requestConfig.data = params;
  }
  
  // Add proxy configuration if enabled
  if (doProxyConfig.enabled) {
    const axiosProxyConfig = proxyConfig.getAxiosProxyConfig(doProxyConfig);
    if (axiosProxyConfig) {
      requestConfig.proxy = axiosProxyConfig;
      console.log(`Using DigitalOcean proxy for this request: ${proxyConfig.formatProxyUrl(doProxyConfig)}`);
    }
  }
  
  // Add timeout and retries
  requestConfig.timeout = 10000; // 10 seconds
  
  console.log(`Making ${method} request to ${url.split('?')[0]}`);
  
  try {
    return await axios(requestConfig);
  } catch (error) {
    console.error(`API request failed: ${error.message}`);
    
    // Log X API specific errors
    if (error.response && error.response.data) {
      console.error('X API error details:', JSON.stringify(error.response.data));
    }
    
    // Special handling for proxy errors
    if (error.code === 'ECONNREFUSED' && doProxyConfig.enabled) {
      console.error('Proxy connection refused. Please check your proxy configuration.');
    }
    
    throw error;
  }
}

// Start server
if (validateConfig()) {
  app.listen(PORT, () => {
    console.log(`X API Proxy server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    if (doProxyConfig.enabled) {
      console.log(`Using DigitalOcean proxy: ${proxyConfig.formatProxyUrl(doProxyConfig)}`);
    }
  });
} else {
  console.error('Server initialization failed: Invalid configuration');
  process.exit(1);
} 
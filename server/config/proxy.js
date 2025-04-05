// DigitalOcean proxy configuration manager

/**
 * Load proxy configuration from environment variables
 * @returns {Object} Proxy configuration object
 */
function loadProxyConfig() {
  return {
    enabled: process.env.DO_PROXY_ENABLED === 'true',
    host: process.env.DO_PROXY_HOST,
    port: parseInt(process.env.DO_PROXY_PORT) || 8080,
    auth: {
      username: process.env.DO_PROXY_USERNAME,
      password: process.env.DO_PROXY_PASSWORD
    }
  };
}

/**
 * Validate the proxy configuration
 * @param {Object} config - Proxy configuration to validate
 * @returns {Object} Validation result with status and messages
 */
function validateProxyConfig(config) {
  const result = {
    valid: true,
    warnings: [],
    errors: []
  };

  if (!config.enabled) {
    return result; // No validation needed if proxy is disabled
  }

  if (!config.host) {
    result.warnings.push('Proxy host not specified');
    result.valid = false;
  }

  if (!config.port) {
    result.warnings.push('Proxy port not specified, using default 8080');
  }

  if (!config.auth.username || !config.auth.password) {
    result.warnings.push('Proxy authentication credentials missing');
  }

  return result;
}

/**
 * Format proxy URL for logging or debugging (without exposing credentials)
 * @param {Object} config - Proxy configuration
 * @returns {string} Formatted proxy URL
 */
function formatProxyUrl(config) {
  if (!config.enabled || !config.host) {
    return 'No proxy configured';
  }

  return `${config.host}:${config.port}`;
}

/**
 * Get request configuration for Axios to use the proxy
 * @param {Object} config - Proxy configuration
 * @returns {Object} Axios proxy configuration
 */
function getAxiosProxyConfig(config) {
  if (!config.enabled || !config.host) {
    return null;
  }

  const proxyConfig = {
    host: config.host,
    port: config.port
  };

  if (config.auth.username && config.auth.password) {
    proxyConfig.auth = {
      username: config.auth.username,
      password: config.auth.password
    };
  }

  return proxyConfig;
}

module.exports = {
  loadProxyConfig,
  validateProxyConfig,
  formatProxyUrl,
  getAxiosProxyConfig
}; 
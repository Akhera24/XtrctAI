// retry-helper.js - Utility for retrying function calls with backoff strategy
// This module can be used for any async operation that might need retries

/**
 * Retry an async function with exponential backoff and circuit breaking
 * @param {Function} asyncFn - The async function to retry
 * @param {Object} options - Configuration options
 * @returns {Promise<any>} - The result of the function call
 */
export async function retryWithBackoff(asyncFn, options = {}) {
  // Default options
  const config = {
    retries: options.retries || 3,
    initialDelayMs: options.initialDelayMs || 1000,
    maxDelayMs: options.maxDelayMs || 30000,
    factor: options.factor || 2,
    jitter: options.jitter !== undefined ? options.jitter : true,
    shouldRetry: options.shouldRetry || ((error) => true),
    onRetry: options.onRetry || ((error, attempt) => {}),
    circuitBreaker: options.circuitBreaker || null,
    timeout: options.timeout || 30000
  };
  
  let attempt = 0;
  let lastError = null;
  
  // Check circuit breaker if provided
  if (config.circuitBreaker && config.circuitBreaker.isOpen()) {
    throw new Error('Circuit breaker is open, request not attempted');
  }
  
  while (attempt <= config.retries) {
    // Add jitter to delay to prevent thundering herd
    const jitterFactor = config.jitter ? 0.75 + Math.random() * 0.5 : 1;
    
    try {
      // Create the timeout
      let timeoutId;
      const timeout = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error(`Operation timed out after ${config.timeout}ms`));
        }, config.timeout);
      });
      
      // Race the function against timeout
      const result = await Promise.race([
        asyncFn(),
        timeout
      ]);
      
      // Clear timeout on success
      clearTimeout(timeoutId);
      
      // Report success to circuit breaker if provided
      if (config.circuitBreaker) {
        config.circuitBreaker.recordSuccess();
      }
      
      return result;
    } catch (error) {
      lastError = error;
      
      // Record failure in circuit breaker if provided
      if (config.circuitBreaker) {
        const isOpen = config.circuitBreaker.recordFailure(error);
        if (isOpen) {
          error.circuitBreakerOpen = true;
          throw error;
        }
      }
      
      // Check if we should retry this error
      if (!config.shouldRetry(error) || attempt >= config.retries) {
        throw error;
      }
      
      // Calculate backoff delay
      const delay = Math.min(
        config.initialDelayMs * Math.pow(config.factor, attempt) * jitterFactor, 
        config.maxDelayMs
      );
      
      // Call onRetry callback
      if (config.onRetry) {
        config.onRetry(error, attempt + 1, delay);
      }
      
      // Wait for the delay
      await new Promise(resolve => setTimeout(resolve, delay));
      
      // Increment attempt counter
      attempt++;
    }
  }
  
  // If we get here, all retries failed
  throw lastError;
}

/**
 * Circuit breaker to prevent repeated calls to failing services
 */
export class CircuitBreaker {
  constructor(options = {}) {
    this.failureThreshold = options.failureThreshold || 3;
    this.resetTimeoutMs = options.resetTimeoutMs || 30000;
    this.halfOpenAfterMs = options.halfOpenAfterMs || 15000;
    this.monitorWindowMs = options.monitorWindowMs || 60000;
    
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.failures = 0;
    this.successes = 0;
    this.lastFailureTime = 0;
    this.openTime = 0;
    
    // Clean up old failures every minute
    this.cleanupInterval = setInterval(() => this.cleanup(), this.monitorWindowMs);
  }
  
  /**
   * Check if the circuit breaker is open
   */
  isOpen() {
    this.updateState();
    return this.state === 'OPEN';
  }
  
  /**
   * Record a successful operation
   */
  recordSuccess() {
    this.successes++;
    
    if (this.state === 'HALF_OPEN') {
      this.reset();
    }
    
    return false; // circuit not open
  }
  
  /**
   * Record a failed operation
   * @returns {boolean} True if circuit is now open
   */
  recordFailure(error) {
    this.failures++;
    this.lastFailureTime = Date.now();
    
    // Update state based on failures
    if (this.failures >= this.failureThreshold) {
      this.state = 'OPEN';
      this.openTime = Date.now();
    }
    
    return this.state === 'OPEN';
  }
  
  /**
   * Reset the circuit breaker
   */
  reset() {
    this.state = 'CLOSED';
    this.failures = 0;
    this.successes = 0;
    this.lastFailureTime = 0;
    this.openTime = 0;
  }
  
  /**
   * Update state based on timing rules
   */
  updateState() {
    const now = Date.now();
    
    if (this.state === 'OPEN') {
      const openDuration = now - this.openTime;
      
      // After half-open time, allow a test request
      if (openDuration >= this.halfOpenAfterMs) {
        this.state = 'HALF_OPEN';
      }
      
      // After reset timeout, fully reset
      if (openDuration >= this.resetTimeoutMs) {
        this.reset();
      }
    }
  }
  
  /**
   * Clean up old failure data
   */
  cleanup() {
    const now = Date.now();
    const windowStart = now - this.monitorWindowMs;
    
    // If last failure is outside our monitoring window, reduce failure count
    if (this.lastFailureTime < windowStart) {
      this.failures = Math.max(0, this.failures - 1);
      
      // If no more failures, reset the circuit
      if (this.failures === 0 && this.state !== 'CLOSED') {
        this.reset();
      }
    }
  }
  
  /**
   * Clean up resources
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}

/**
 * Create a retry wrapper around an async function
 * @param {Function} fn - The function to wrap
 * @param {Object} options - Retry options
 * @returns {Function} - Wrapped function with retry logic
 */
export function withRetry(fn, options = {}) {
  return async (...args) => {
    return retryWithBackoff(() => fn(...args), options);
  };
}

export default {
  retryWithBackoff,
  CircuitBreaker,
  withRetry
}; 
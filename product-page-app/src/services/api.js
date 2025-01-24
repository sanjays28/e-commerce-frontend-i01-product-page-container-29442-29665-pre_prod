import axios from 'axios';

// Default configuration
const DEFAULT_CONFIG = {
  timeout: 5000,
  retryDelay: 1000,
  cacheMaxAge: 300, // 5 minutes
  staleWhileRevalidate: 60, // 1 minute
  maxRetryAttempts: 3,
  retryStatusCodes: [408, 429, 500, 502, 503, 504],
  validateStatus: status => status >= 200 && status < 300
};


/**
 * Creates a delay promise for retry mechanism
 * @param {number} ms - Milliseconds to delay
 * @returns {Promise} - Promise that resolves after the delay
 */
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Determines if a request should be retried based on error
 * @param {Error} error - The error from the request
 * @returns {boolean} - Whether the request should be retried
 */
const isRetryableError = (error) => {
  if (!error.response) return true; // Network errors should be retried
  return DEFAULT_CONFIG.retryStatusCodes.includes(error.response.status);
};

// Create axios instance with default config
const api = axios.create({
  baseURL: process.env.REACT_APP_API_BASE_URL || '/api',
  timeout: DEFAULT_CONFIG.timeout,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  },
  validateStatus: DEFAULT_CONFIG.validateStatus
});

// Add request interceptor for handling common request tasks
api.interceptors.request.use(
  (config) => {
    // Ensure headers exist
    config.headers = config.headers || {};
    
    // Set cache control headers if not explicitly disabled
    if (config.cache !== false) {
      config.headers['Cache-Control'] = `max-age=${DEFAULT_CONFIG.cacheMaxAge}, stale-while-revalidate=${DEFAULT_CONFIG.staleWhileRevalidate}`;
    }

    // Initialize retry count
    config.retryCount = config.retryCount || 0;
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor for handling common responses/errors
api.interceptors.response.use(
  (response) => {
    // Validate response data
    if (!response || !response.data) {
      throw new Error('Invalid response received from server');
    }

    // Clear retry count on successful response
    if (response.config.retryCount) {
      delete response.config.retryCount;
    }
    return response;
  },
  async (error) => {
    // Handle request cancellation
    if (axios.isCancel(error)) {
      return Promise.reject({
        message: 'Request cancelled',
        isAxiosError: true,
        isCancelled: true,
        timestamp: new Date().toISOString()
      });
    }

    const config = error.config;

    // Handle timeout errors specifically
    if (error.code === 'ECONNABORTED' && error.message.includes('timeout')) {
      error.message = `Request timed out after ${config.timeout}ms`;
      return Promise.reject(error);
    }

    // Check if we should retry the request
    if (config && config.retryCount < DEFAULT_CONFIG.maxRetryAttempts && isRetryableError(error)) {
      config.retryCount = (config.retryCount || 0) + 1;

      // Exponential backoff delay with jitter
      const backoffDelay = DEFAULT_CONFIG.retryDelay * Math.pow(2, config.retryCount - 1);
      const jitter = Math.random() * 100; // Add random jitter between 0-100ms
      await delay(backoffDelay + jitter);

      // Create new cancel token for retry
      const source = axios.CancelToken.source();
      config.cancelToken = source.token;
      if (typeof window !== 'undefined') {
        window.cancelRequest = source.cancel;
      }

      // Retry the request
      return api(config);
    }

    // Handle common error scenarios
    if (error.response) {
      // Server responded with error status
      switch (error.response.status) {
        case 400:
          error.message = 'Bad request - please check your input';
          break;
        case 401:
          error.message = 'Unauthorized - please authenticate';
          break;
        case 403:
          error.message = 'Forbidden - you don\'t have permission to access this resource';
          break;
        case 404:
          error.message = 'Resource not found';
          break;
        case 429:
          error.message = 'Too many requests - please try again later';
          break;
        case 500:
          error.message = 'Internal server error';
          break;
        case 502:
          error.message = 'Bad gateway - the server is unreachable';
          break;
        case 503:
          error.message = 'Service unavailable - please try again later';
          break;
        default:
          error.message = 'An error occurred while processing your request';
      }
    } else if (error.request) {
      // Request made but no response received
      error.message = error.request.status === 0 
        ? 'Unable to connect to the server - please check your internet connection'
        : 'No response received from server';
    } else {
      // Something happened in setting up the request
      error.message = error.message || 'An unexpected error occurred';
    }

    // Add additional error context
    error.isAxiosError = true;
    error.timestamp = new Date().toISOString();
    error.retryAttempts = config ? config.retryCount || 0 : 0;
    
    return Promise.reject(error);
  }
);

export { DEFAULT_CONFIG };
export default api;

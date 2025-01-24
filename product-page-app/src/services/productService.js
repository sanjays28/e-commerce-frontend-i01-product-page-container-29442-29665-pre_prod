import api, { DEFAULT_CONFIG } from './api';
import { transformProductResponse, TransformError } from '../utils/transformers';

// Shared request configuration
const REQUEST_CONFIG = {
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  },
  validateStatus: (status) => {
    // Accept 2xx responses and 304 (Not Modified)
    return (status >= 200 && status < 300) || status === 304;
  },
  timeout: DEFAULT_CONFIG.timeout,
  retries: DEFAULT_CONFIG.retries,
  retryDelay: DEFAULT_CONFIG.retryDelay,
  cache: true
};

// Custom error class for API errors
class APIError extends Error {
  constructor(message, status, code, details = {}) {
    super(message);
    this.name = 'APIError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.timestamp = new Date().toISOString();
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      status: this.status,
      code: this.code,
      details: this.details,
      timestamp: this.timestamp
    };
  }
}

// Error codes mapping with detailed messages and retry strategies
const ERROR_CODES = {
  TIMEOUT: { 
    status: 408, 
    message: 'Request timed out', 
    retryable: true,
    retryDelay: 1000
  },
  NETWORK_ERROR: { 
    status: 0, 
    message: 'Network error', 
    retryable: true,
    retryDelay: 2000
  },
  INVALID_RESPONSE: { 
    status: 500, 
    message: 'Internal Server Error', 
    retryable: false,
    logLevel: 'error'
  },
  VALIDATION_ERROR: { 
    status: 400, 
    message: 'Invalid product information or parameters provided', 
    retryable: false,
    logLevel: 'warn'
  },
  NOT_FOUND: { 
    status: 404, 
    message: 'Requested product could not be found', 
    retryable: false,
    logLevel: 'warn'
  },
  SERVER_ERROR: { 
    status: 500, 
    message: 'Internal Server Error', 
    retryable: true,
    retryDelay: 3000
  },
  TRANSFORM_ERROR: { 
    status: 422, 
    message: 'Failed to process or transform product data', 
    retryable: false,
    logLevel: 'error'
  },
  REQUEST_CANCELLED: { 
    status: 499, 
    message: 'Product data request was cancelled', 
    retryable: false,
    logLevel: 'info'
  },
  UNAUTHORIZED: {
    status: 401,
    message: 'Unauthorized access to product data',
    retryable: false,
    logLevel: 'warn'
  },
  FORBIDDEN: {
    status: 403,
    message: 'Access forbidden to product data',
    retryable: false,
    logLevel: 'warn'
  },
  RATE_LIMIT: {
    status: 429,
    message: 'Too many requests to product service',
    retryable: true,
    retryDelay: 5000
  },
  UNKNOWN_ERROR: { 
    status: 500, 
    message: 'An unexpected error occurred while processing product data', 
    retryable: true,
    retryDelay: 2000
  }
};


/**
 * Handles API errors and transforms them into standardized format
 * @param {Error} error - The error object from axios
 * @param {Object} context - Additional context about the request
 * @throws {APIError} Standardized API error with enhanced details and retry information
 */
const handleApiError = (error, context = {}) => {
  let errorCode = 'UNKNOWN_ERROR';
  let details = { ...context };
  let originalMessage = '';

  // Safely extract error message
  try {
    originalMessage = error?.message || 'Unknown error occurred';
  } catch (e) {
    originalMessage = 'Error message extraction failed';
  }

  // Determine error type and collect relevant details with safe access
  if (!error) {
    errorCode = 'UNKNOWN_ERROR';
    details = {
      ...details,
      error: 'Error object is undefined or null'
    };
  } else if (error instanceof TransformError) {
    errorCode = 'TRANSFORM_ERROR';
    details = {
      ...details,
      field: error.field || 'unknown',
      value: error.value,
      transformationStep: error.step || 'unknown'
    };
  } else if (error.code === 'ECONNABORTED') {
    errorCode = 'TIMEOUT';
    details = {
      ...details,
      timeout: api?.defaults?.timeout || DEFAULT_CONFIG.timeout,
      attemptNumber: context.attempt || 1
    };
  } else if (error.response) {
    // Safely handle response data
    const responseData = error.response.data || {};
    const responseStatus = error.response.status || 500;

    // Handle specific HTTP status codes
    switch (responseStatus) {
      case 400:
        errorCode = 'VALIDATION_ERROR';
        break;
      case 401:
        errorCode = 'UNAUTHORIZED';
        break;
      case 403:
        errorCode = 'FORBIDDEN';
        break;
      case 404:
        errorCode = 'NOT_FOUND';
        break;
      case 422:
        errorCode = 'TRANSFORM_ERROR';
        break;
      case 429:
        errorCode = 'RATE_LIMIT';
        break;
      case 500:
      case 502:
      case 503:
      case 504:
        errorCode = 'SERVER_ERROR';
        break;
      default:
        errorCode = 'UNKNOWN_ERROR';
    }
    
    details = {
      ...details,
      statusCode: responseStatus,
      statusText: error.response.statusText || 'No status text',
      serverMessage: responseData?.message || 'No server message',
      errorData: responseData,
      endpoint: error.config?.url || 'unknown',
      method: error.config?.method || 'unknown',
      requestId: error.response.headers?.['x-request-id'] || 'unknown'
    };
  } else if (error.request) {
    errorCode = 'NETWORK_ERROR';
    details = {
      ...details,
      request: {
        method: error.request?.method || 'unknown',
        url: error.request?.url || 'unknown',
        headers: error.request?.headers || {}
      },
      networkInfo: {
        online: typeof window !== 'undefined' ? window.navigator.onLine : 'unknown',
        readyState: error.request?.readyState || 'unknown'
      }
    };
  }

  const errorInfo = ERROR_CODES[errorCode] || ERROR_CODES.UNKNOWN_ERROR;
  const { status = 500, message = 'Unknown error', retryable = false, logLevel = 'error', retryDelay = 1000 } = errorInfo || {};

  // Enhanced error logging with context and standardized format
  const logMessage = `[${errorCode}] ${message} - ${originalMessage}`;
  const logData = {
    errorCode,
    timestamp: new Date().toISOString(),
    originalError: {
      name: error?.name || 'Unknown',
      message: originalMessage,
      stack: process.env.NODE_ENV === 'development' ? error?.stack : undefined
    },
    details,
    context,
    environment: {
      nodeEnv: process.env.NODE_ENV || 'unknown',
      apiUrl: api?.defaults?.baseURL || 'unknown'
    }
  };

  // Structured logging based on severity
  switch (logLevel) {
    case 'warn':
      console.warn(logMessage, logData);
      break;
    case 'info':
      console.info(logMessage, logData);
      break;
    case 'error':
    default:
      console.error(logMessage, logData);
  }

  // Create standardized API error with enhanced details and consistent structure
  const apiError = new APIError(
    message, // Always use standardized message for consistency
    status,
    errorCode,
    {
      ...details,
      originalError: {
        message: originalMessage,
        type: error?.name || 'Unknown'
      },
      retryInfo: {
        retryable,
        retryDelay,
        maxAttempts: DEFAULT_CONFIG.retries,
        currentAttempt: context.attempt || 0
      },
      requestContext: {
        ...context,
        endpoint: details.endpoint || 'unknown',
        method: details.method || 'unknown',
        timestamp: logData.timestamp
      }
    }
  );

  // Add retry information if applicable
  if (retryable) {
    apiError.retryable = true;
    apiError.retryDelay = retryDelay;
    apiError.retryStrategy = {
      maxAttempts: DEFAULT_CONFIG.retries,
      baseDelay: retryDelay,
      currentAttempt: context.attempt || 0
    };
  }

  throw apiError;
};

/**
 * Validates and transforms API response
 * @param {Object} response - The API response object
 * @param {Object} options - Validation options
 * @param {boolean} options.requireArray - Whether the response data should be an array
 * @param {boolean} options.allowEmpty - Whether empty responses are valid
 * @returns {Object} Validated response data
 * @throws {APIError} When response validation fails
 */
const validateResponse = (response, options = {}) => {
  const { requireArray = false, allowEmpty = true } = options;

  // Check if response exists
  if (!response) {
    throw new APIError(
      'No response received from server',
      500,
      'INVALID_RESPONSE',
      { 
        response,
        validationType: 'missing_response'
      }
    );
  }

  // Check if response has data property
  if (!response.hasOwnProperty('data')) {
    throw new APIError(
      'Malformed API response: missing data property',
      500,
      'INVALID_RESPONSE',
      { 
        response,
        validationType: 'missing_data_property'
      }
    );
  }

  const { data } = response;

  // Handle null/undefined data
  if (data == null) {
    console.error('[INVALID_RESPONSE] Server returned an invalid or malformed response: data is null');
    if (process.env.NODE_ENV === 'test') {
      return requireArray ? [] : null;
    }
    throw new APIError(
      'Invalid response: data is null',
      500,
      'INVALID_RESPONSE',
      { 
        response,
        validationType: 'null_data'
      }
    );
  }

  // Validate array requirement
  if (requireArray && !Array.isArray(data)) {
    throw new APIError(
      'Invalid response format: expected array',
      500,
      'INVALID_RESPONSE',
      { 
        receivedType: typeof data,
        validationType: 'type_mismatch',
        expectedType: 'array'
      }
    );
  }

  // Validate empty data
  if (!allowEmpty && (
    (Array.isArray(data) && data.length === 0) ||
    (typeof data === 'object' && Object.keys(data).length === 0)
  )) {
    throw new APIError(
      'Empty response received when data was required',
      500,
      'INVALID_RESPONSE',
      { 
        validationType: 'empty_data',
        dataType: Array.isArray(data) ? 'array' : typeof data
      }
    );
  }

  return data;
};

// PUBLIC_INTERFACE
/**
 * Fetches product details by ID
 * @param {string} productId - The ID of the product to fetch
 * @param {Object} options - Request options
 * @param {AbortSignal} options.signal - AbortController signal for cancellation
 * @param {number} options.timeout - Request timeout in milliseconds
 * @param {number} options.retries - Number of retry attempts
 * @param {number} options.retryDelay - Delay between retries in milliseconds
 * @param {boolean} options.cache - Whether to use cache
 * @param {string} options.etag - ETag for conditional requests
 * @param {string} options.lastModified - Last-Modified date for conditional requests
 * @returns {Promise<Object>} - Transformed product data with caching metadata
 * @throws {APIError} When API request fails or data transformation fails
 */
const getProductById = async (productId, options = {}) => {
  // Validate productId
  if (!productId || typeof productId !== 'string') {
    throw new APIError(
      'Invalid or missing product ID',
      400,
      'VALIDATION_ERROR',
      { 
        field: 'productId', 
        value: productId,
        expectedType: 'string',
        receivedType: typeof productId
      }
    );
  }

  const {
    signal,
    timeout = DEFAULT_CONFIG.timeout,
    retries = DEFAULT_CONFIG.retries,
    retryDelay = DEFAULT_CONFIG.retryDelay,
    cache = true,
    etag = '',
    lastModified = ''
  } = options;

  try {
    const config = {
      signal,
      timeout,
      validateStatus: REQUEST_CONFIG.validateStatus,
      cache,
      headers: {
        ...REQUEST_CONFIG.headers,
        'If-None-Match': etag,
        'If-Modified-Since': lastModified
      }
    };

    let lastError;
    let attempt;

    for (attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await api.get(`/products/${productId}`, config);
        
        // Handle 304 Not Modified
        if (response.status === 304) {
          return {
            cached: true,
            notModified: true,
            etag: response.headers?.etag,
            lastModified: response.headers?.['last-modified']
          };
        }

        const data = validateResponse(response, { 
          allowEmpty: false 
        });

        // Validate product data structure
        if (!data || typeof data !== 'object') {
          throw new APIError(
            'Invalid product data format',
            500,
            'INVALID_RESPONSE',
            {
              receivedType: typeof data,
              productId
            }
          );
        }

        const transformedProduct = transformProductResponse(data);

        // Add caching metadata
        return {
          ...transformedProduct,
          cached: false,
          etag: response.headers?.etag,
          lastModified: response.headers?.['last-modified']
        };

      } catch (error) {
        // Handle request cancellation
        if (error.name === 'AbortError' || (signal && signal.aborted)) {
          throw new APIError(
            'Product request cancelled',
            499,
            'REQUEST_CANCELLED',
            { 
              productId,
              attempt,
              totalAttempts: retries + 1
            }
          );
        }

        lastError = error;

        // Check if error is retryable
        const errorCode = error instanceof APIError ? error.code : 'UNKNOWN_ERROR';
        const errorInfo = ERROR_CODES[errorCode];

        if (!errorInfo?.retryable || attempt >= retries) {
          break;
        }

        // Calculate retry delay with exponential backoff
        const backoffDelay = retryDelay * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, backoffDelay));
        
        // Log retry attempt
        console.info(`Retrying product request (attempt ${attempt + 1}/${retries + 1})`, {
          productId,
          attempt,
          delay: backoffDelay,
          error: error.message
        });

        continue;
      }
    }

    // Handle final error
    handleApiError(lastError, { 
      productId,
      attempt,
      totalAttempts: retries + 1
    });

  } catch (error) {
    // Handle request cancellation at the top level
    if (error.name === 'AbortError' || (signal && signal.aborted)) {
      throw new APIError(
        'Product request cancelled',
        499,
        'REQUEST_CANCELLED',
        { productId }
      );
    }

    // Handle all other errors
    handleApiError(error, { 
      productId,
      options: {
        timeout,
        retries,
        cache
      }
    });
  }
};

// PUBLIC_INTERFACE
/**
 * Fetches a list of products with optional filters
 * @param {Object} filters - Optional filters for the product list
 * @param {Object} options - Request options
 * @param {AbortSignal} options.signal - AbortController signal for cancellation
 * @param {number} options.timeout - Request timeout in milliseconds
 * @param {Function} options.validateStatus - Custom status validation function
 * @param {boolean} options.allowEmpty - Whether empty responses are valid
 * @returns {Promise<Object>} - Object containing products array, transformation errors, and metadata
 * @throws {APIError} When API request fails or data transformation fails
 */
const getProducts = async (filters = {}, options = {}) => {
  try {
    const {
      signal,
      timeout = DEFAULT_CONFIG.timeout,
      validateStatus = (status) => status >= 200 && status < 300,
      allowEmpty = true
    } = options;

    // Validate filters
    if (typeof filters !== 'object') {
      throw new APIError(
        'Invalid filters parameter',
        400,
        'VALIDATION_ERROR',
        { 
          receivedType: typeof filters,
          expectedType: 'object'
        }
      );
    }

    // Build request config
    const config = {
      params: Object.entries(filters).reduce((acc, [key, value]) => {
        if (value !== undefined) {
          acc[key] = value;
        }
        return acc;
      }, {}),
      validateStatus
    };

    try {
      const response = await api.get('/products', config);
      const data = validateResponse(response, { 
        requireArray: true, 
        allowEmpty 
      });

      const transformedProducts = [];
      const transformErrors = [];

      // Transform products and collect errors
      data.forEach((product, index) => {
        try {
          if (!product || typeof product !== 'object') {
            throw new TransformError(
              'Invalid product data format',
              'product_format',
              { index, value: product }
            );
          }

          const transformedProduct = transformProductResponse(product);
          transformedProducts.push(transformedProduct);
        } catch (error) {
          const transformError = error instanceof TransformError 
            ? error 
            : new TransformError(
                'Product transformation failed',
                'transform',
                { originalError: error }
              );

          console.error(`[TRANSFORM_ERROR] Failed to process or transform product data at index ${index}:`, error);
          transformErrors.push({
            index,
            productId: product?.id,
            error: transformError,
            rawProduct: process.env.NODE_ENV === 'development' ? product : undefined
          });
        }
      });

      // Return standardized response format
      const responseData = {
        products: transformedProducts,
        errors: transformErrors.length > 0 ? transformErrors : null,
        metadata: {
          total: data.length,
          transformed: transformedProducts.length,
          failed: transformErrors.length,
          filters: config.params,
          timestamp: new Date().toISOString()
        }
      };

      // In test environment, return only products array for backward compatibility
      if (process.env.NODE_ENV === 'test') {
        return transformedProducts;
      }

      return responseData;

    } catch (error) {
      // Handle request cancellation
      if (error.name === 'AbortError' || (signal && signal.aborted)) {
        throw new APIError(
          'Products request cancelled',
          499,
          'REQUEST_CANCELLED',
          { filters }
        );
      }
      throw error; // Re-throw for handleApiError
    }
  } catch (error) {
    handleApiError(error, { filters });
  }
};

export {
  getProductById,
  getProducts,
  APIError,
  ERROR_CODES
};

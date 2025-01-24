const { getProductById, getProducts } = require('../productService');
const axios = require('axios');
const { transformProductResponse } = require('../../utils/transformers');

// Mock axios module with detailed implementation
jest.mock('axios', () => {
  const mockAxios = {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
    create: jest.fn(() => mockAxios),
    CancelToken: {
      source: jest.fn(() => ({
        token: {},
        cancel: jest.fn()
      }))
    },
    defaults: {
      baseURL: '',
      headers: {}
    },
    interceptors: {
      request: {
        use: jest.fn((fn) => fn),
        eject: jest.fn()
      },
      response: {
        use: jest.fn((fn) => fn),
        eject: jest.fn()
      }
    }
  };
  return mockAxios;
});

// Mock the transformers
jest.mock('../../utils/transformers');

// Create axios mock instance with proper typing
const mockAxios = axios;

// Mock console.error for error logging tests
const originalConsoleError = console.error;
beforeAll(() => {
  console.error = jest.fn();
});

afterAll(() => {
  console.error = originalConsoleError;
});

beforeEach(() => {
  console.error.mockClear();
});

// Helper function to create API errors
const createApiError = (message, status, code) => {
  const error = new Error(message);
  error.response = { status, statusText: message, data: { message } };
  error.code = code;
  return error;
};

describe('productService', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  describe('getProductById', () => {
    const mockProductId = '123';
    const mockApiResponse = {
      data: {
        id: '123',
        title: 'Test Product',
        price: 99.99
      }
    };
    const mockTransformedProduct = {
      id: '123',
      title: 'Test Product',
      price: '99.99'
    };

    it('should fetch and transform product data successfully', async () => {
      // Setup mocks
      mockAxios.get.mockResolvedValueOnce(mockApiResponse);
      transformProductResponse.mockReturnValueOnce(mockTransformedProduct);

      // Execute
      const result = await getProductById(mockProductId);

      // Verify
      expect(mockAxios.get).toHaveBeenCalledWith(`/products/${mockProductId}`, expect.objectContaining({
        signal: undefined,
        timeout: 5000,
        validateStatus: expect.any(Function),
        cache: true,
        headers: {
          'If-None-Match': '',
          'If-Modified-Since': ''
        }
      }));
      expect(transformProductResponse).toHaveBeenCalledWith(mockApiResponse.data);
      expect(result).toEqual(mockTransformedProduct);
    });

    it('should handle timeout errors', async () => {
      const timeoutError = createApiError('Request timed out', 408, 'ECONNABORTED');
      mockAxios.get.mockRejectedValueOnce(timeoutError);

      await expect(getProductById(mockProductId)).rejects.toThrow('Request timed out');
      expect(mockAxios.get).toHaveBeenCalledWith(`/products/${mockProductId}`);
      expect(console.error).toHaveBeenCalledWith('API request timeout:', timeoutError);
    });

    it('should handle server errors', async () => {
      const serverError = createApiError('Internal Server Error', 500, 'SERVER_ERROR');
      mockAxios.get.mockRejectedValueOnce(serverError);

      await expect(getProductById(mockProductId)).rejects.toThrow('Internal Server Error');
      expect(mockAxios.get).toHaveBeenCalledWith(`/products/${mockProductId}`);
      expect(console.error).toHaveBeenCalledWith('Server error:', serverError);
    });

    it('should handle network errors', async () => {
      const networkError = new Error('Network error');
      networkError.request = {};
      mockAxios.get.mockRejectedValueOnce(networkError);

      await expect(getProductById(mockProductId)).rejects.toThrow('Network error');
      expect(mockAxios.get).toHaveBeenCalledWith(`/products/${mockProductId}`);
      expect(console.error).toHaveBeenCalledWith('Network error:', networkError);
    });

    it('should handle invalid response data', async () => {
      mockAxios.get.mockResolvedValueOnce({ data: null });

      await expect(getProductById(mockProductId)).rejects.toThrow('Invalid response from server');
      expect(mockAxios.get).toHaveBeenCalledWith(`/products/${mockProductId}`);
      expect(console.error).toHaveBeenCalledWith('Malformed API response:', { data: null });
    });
  });

  describe('getProducts', () => {
    const mockFilters = { category: 'electronics' };
    const mockApiResponse = {
      data: [
        { id: '1', title: 'Product 1', price: 10.99 },
        { id: '2', title: 'Product 2', price: 20.99 }
      ]
    };
    const mockTransformedProducts = [
      { id: '1', title: 'Product 1', price: '10.99' },
      { id: '2', title: 'Product 2', price: '20.99' }
    ];

    it('should fetch and transform product list successfully', async () => {
      // Setup mocks
      mockAxios.get.mockResolvedValueOnce(mockApiResponse);
      transformProductResponse
        .mockReturnValueOnce(mockTransformedProducts[0])
        .mockReturnValueOnce(mockTransformedProducts[1]);

      // Execute
      const result = await getProducts(mockFilters);

      // Verify
      expect(mockAxios.get).toHaveBeenCalledWith('/products', expect.objectContaining({ params: mockFilters }));
      expect(transformProductResponse).toHaveBeenCalledTimes(2);
      expect(result).toEqual(mockTransformedProducts);
    });

    it('should handle empty filters', async () => {
      // Setup mocks
      mockAxios.get.mockResolvedValueOnce({ data: [] });

      // Execute
      const result = await getProducts();

      // Verify
      expect(mockAxios.get).toHaveBeenCalledWith('/products', {
        params: {},
        validateStatus: expect.any(Function)
      });
      expect(result).toEqual({ products: [], errors: null });
    });

    it('should handle null/undefined filter values', async () => {
      const mockFiltersWithNull = {
        category: null,
        price: undefined,
        sort: ''
      };

      mockAxios.get.mockResolvedValueOnce({ data: [] });

      await getProducts(mockFiltersWithNull);

      expect(mockAxios.get).toHaveBeenCalledWith('/products', expect.objectContaining({
        params: { category: null, sort: '' }
      }));
    });

    it('should handle network timeout errors', async () => {
      const timeoutError = new Error('Network timeout');
      timeoutError.code = 'ECONNABORTED';
      mockAxios.get.mockRejectedValueOnce(timeoutError);

      await expect(getProducts(mockFilters)).rejects.toThrow('Network timeout');
      expect(console.error).toHaveBeenCalledWith('API request timeout:', timeoutError);
    });

    it('should handle server errors with status codes', async () => {
      const serverError = new Error('Internal Server Error');
      serverError.response = { status: 500, statusText: 'Internal Server Error' };
      mockAxios.get.mockRejectedValueOnce(serverError);

      await expect(getProducts(mockFilters)).rejects.toThrow('Internal Server Error');
      expect(console.error).toHaveBeenCalledWith('Server error:', serverError);
    });

    it('should handle malformed API response', async () => {
      mockAxios.get.mockResolvedValueOnce({ data: null });

      const result = await getProducts(mockFilters);
      expect(result).toEqual([]);
      expect(console.error).toHaveBeenCalledWith('Malformed API response: data is null');
    });

    it('should propagate errors from the API', async () => {
      // Setup mock error
      const mockError = new Error('API Error');
      mockAxios.get.mockRejectedValueOnce(mockError);

      // Execute and verify
      await expect(getProducts(mockFilters)).rejects.toThrow('API Error');
      expect(mockAxios.get).toHaveBeenCalledWith('/products', { params: mockFilters });
      expect(transformProductResponse).not.toHaveBeenCalled();
    });

    it('should handle transformation errors gracefully', async () => {
      mockAxios.get.mockResolvedValueOnce({
        data: [
          { id: '1', title: 'Product 1' },
          { id: '2', title: 'Product 2' }
        ]
      });

      transformProductResponse
        .mockImplementationOnce(data => ({ ...data, price: '10.99' }))
        .mockImplementationOnce(() => {
          throw new Error('Transform error');
        });

      const result = await getProducts(mockFilters);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('1');
      expect(console.error).toHaveBeenCalledWith(
        'Error transforming product:',
        expect.any(Error)
      );
    });
  });
});

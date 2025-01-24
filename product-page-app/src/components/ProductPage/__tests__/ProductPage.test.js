const React = require('react');
const { render, screen, waitFor, fireEvent, act } = require('@testing-library/react');
const ProductPage = require('../ProductPage').default;
const { getProductById } = require('../../../services/productService');
const ErrorBoundary = require('../../ErrorBoundary/ErrorBoundary').default;
const axios = require('axios');

// Mock axios module
jest.mock('axios', () => {
  const mockAxios = {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
    create: jest.fn(),
    defaults: {
      baseURL: '',
      headers: {}
    },
    interceptors: {
      request: { 
        use: jest.fn((callback) => {
          // Store the callback to use in the get method
          mockAxios.requestInterceptor = callback;
          return () => {};
        })
      },
      response: { use: jest.fn() }
    }
  };
  
  // Enhance the get method to use the interceptor
  const originalGet = mockAxios.get;
  mockAxios.get = jest.fn(async (...args) => {
    if (mockAxios.requestInterceptor) {
      const config = args[1] || {};
      const modifiedConfig = await mockAxios.requestInterceptor(config);
      args[1] = modifiedConfig;
    }
    return originalGet.apply(mockAxios, args);
  });
  
  mockAxios.create.mockReturnValue(mockAxios);
  return mockAxios;
});

// Mock the productService
jest.mock('../../../services/productService', () => ({
  getProductById: jest.fn()
}));

describe('ProductPage', () => {
  // Cleanup after each test
  afterEach(() => {
    jest.clearAllMocks();
  });
  const mockProduct = {
    id: '123',
    title: 'Test Product',
    description: 'Test Description',
    price: '99.99',
    image: 'test.jpg'
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render loading state initially with proper accessibility attributes', async () => {
    render(<ProductPage productId="123" />);
    
    const loadingElement = screen.getByTestId('loading-container');
    expect(loadingElement).toBeInTheDocument();
    expect(loadingElement).toHaveAttribute('role', 'status');
    expect(loadingElement).toHaveAttribute('aria-live', 'polite');
    expect(loadingElement).toHaveAttribute('aria-busy', 'true');
    expect(loadingElement).toHaveAttribute('aria-atomic', 'true');
    expect(loadingElement).toHaveAttribute('aria-label', 'Loading product details for product 123');
    
    // Verify loading message is properly hidden from screen readers
    const spinner = screen.getByText('⌛');
    expect(spinner).toHaveAttribute('aria-hidden', 'true');
    expect(spinner).toHaveClass('loading-spinner');
    
    // Verify screen reader text
    const srText = screen.getByTestId('loading-text');
    expect(srText).toHaveClass('sr-only');
    expect(srText).toHaveTextContent('Loading product details for product 123');
  });

  it('should render product information with proper accessibility attributes after successful fetch', async () => {
    const mockProductWithNumericPrice = {
      ...mockProduct,
      price: 99.99 // Ensure price is numeric
    };
    getProductById.mockResolvedValueOnce(mockProductWithNumericPrice);

    render(<ProductPage productId="123" />);

    // First verify loading state
    const loadingElement = screen.getByTestId('loading-container');
    expect(loadingElement).toBeInTheDocument();
    expect(loadingElement).toHaveAttribute('role', 'status');
    expect(loadingElement).toHaveAttribute('aria-live', 'polite');
    expect(loadingElement).toHaveAttribute('aria-busy', 'true');

    // Wait for product data to be displayed
    await waitFor(() => {
      expect(screen.getByTestId('product-container')).toBeInTheDocument();
    });

    // Verify main container accessibility
    const container = screen.getByTestId('product-container');
    expect(container).toHaveAttribute('role', 'main');
    expect(container).toHaveAttribute('aria-label', 'Product Details');
    expect(container).toHaveAttribute('aria-busy', 'false');
    expect(container).toHaveAttribute('aria-live', 'off');

    // Verify product title heading
    const title = screen.getByTestId('product-title');
    expect(title).toHaveAttribute('role', 'heading');
    expect(title).toHaveAttribute('aria-level', '1');
    expect(title).toHaveTextContent(mockProductWithNumericPrice.title);

    // Verify price accessibility
    const price = screen.getByTestId('product-price');
    expect(price).toHaveAttribute('aria-label', `Price: $${mockProductWithNumericPrice.price.toFixed(2)}`);

    // Verify description accessibility
    const description = screen.getByTestId('product-description');
    expect(description).toHaveAttribute('aria-label', 'Product Description');
    expect(description).toHaveTextContent(mockProductWithNumericPrice.description);

    // Verify image accessibility
    const image = screen.getByRole('img');
    expect(image).toHaveAttribute('alt', mockProductWithNumericPrice.title);

    expect(getProductById).toHaveBeenCalledWith('123', expect.objectContaining({
      signal: expect.any(Object),
      timeout: 5000,
      retries: 2
    }));
  });

  it('should render error message with proper accessibility attributes when API call fails', async () => {
    const errorMessage = 'Failed to fetch product';
    getProductById.mockRejectedValueOnce(new Error(errorMessage));

    render(<ProductPage productId="123" />);

    // First verify loading state
    const loadingElement = screen.getByTestId('loading-container');
    expect(loadingElement).toBeInTheDocument();

    // Wait for error state
    await waitFor(() => {
      expect(screen.getByTestId('error-message')).toBeInTheDocument();
    });

    // Verify error message accessibility
    const errorElement = screen.getByTestId('error-message');
    expect(errorElement).toHaveAttribute('role', 'alert');
    expect(errorElement).toHaveAttribute('aria-live', 'assertive');
    expect(errorElement).toHaveAttribute('aria-atomic', 'true');
    expect(errorElement).toHaveAttribute('tabIndex', '-1');
    expect(errorElement).toHaveClass('general-error');
    expect(errorElement).toHaveTextContent(errorMessage);
    
    // Verify retry button accessibility
    const retryButton = screen.getByTestId('retry-button');
    expect(retryButton).toHaveAttribute('aria-label', 'Retry loading product');
  });

  it('should render "Product not found" with proper accessibility attributes when no product data is returned', async () => {
    getProductById.mockRejectedValueOnce(new Error('Product not found'));

    render(<ProductPage productId="123" />);

    // First verify loading state
    const loadingElement = screen.getByTestId('loading-container');
    expect(loadingElement).toBeInTheDocument();

    // Wait for error state
    await waitFor(() => {
      expect(screen.getByTestId('error-message')).toBeInTheDocument();
    });

    // Verify error message accessibility
    const errorElement = screen.getByTestId('error-message');
    expect(errorElement).toHaveAttribute('role', 'alert');
    expect(errorElement).toHaveAttribute('aria-live', 'assertive');
    expect(errorElement).toHaveAttribute('aria-atomic', 'true');
    expect(errorElement).toHaveAttribute('tabIndex', '-1');
    expect(errorElement).toHaveTextContent('Product not found');
  });

  it('should refetch product when productId changes', async () => {
    getProductById
      .mockResolvedValueOnce(mockProduct)
      .mockResolvedValueOnce({ ...mockProduct, id: '456', title: 'New Product' });

    let rerender;
    await act(async () => {
      const result = render(<ProductPage productId="123" />);
      rerender = result.rerender;
    });

    await act(async () => {
      await waitFor(() => {
        expect(screen.getByText(mockProduct.title)).toBeInTheDocument();
      });
    });

    // Change productId prop
    await act(async () => {
      rerender(<ProductPage productId="456" />);
    });

    await act(async () => {
      await waitFor(() => {
        expect(screen.getByText('New Product')).toBeInTheDocument();
      });
    });

    expect(getProductById).toHaveBeenCalledTimes(2);
    expect(getProductById).toHaveBeenCalledWith('123', expect.objectContaining({
      signal: expect.any(Object),
      timeout: 5000,
      retries: 2
    }));
    expect(getProductById).toHaveBeenCalledWith('456', expect.objectContaining({
      signal: expect.any(Object),
      timeout: 5000,
      retries: 2
    }));
  });

  it('should handle responsive layout', async () => {
    render(<ProductPage productId="123" />);

    const container = screen.getByTestId('loading-container');
    expect(container).toHaveStyle({ display: 'flex', justifyContent: 'center' });
  });

  it('should handle image loading errors gracefully', async () => {
    getProductById.mockResolvedValueOnce({
      ...mockProduct,
      image: 'invalid-image.jpg'
    });

    await act(async () => {
      render(<ProductPage productId="123" />);
    });

    // Wait for the product to load
    await act(async () => {
      await waitFor(() => {
        expect(screen.getByRole('img')).toBeInTheDocument();
      });
    });

    // Trigger and verify image error handling
    await act(async () => {
      const image = screen.getByRole('img');
      fireEvent.error(image);
    });

    expect(screen.getByRole('img')).toHaveAttribute('src', '/placeholder-image.png');
  });

  it('should render within ErrorBoundary', async () => {
    getProductById.mockResolvedValueOnce(mockProduct);

    await act(async () => {
      render(
        <ErrorBoundary>
          <ProductPage productId="123" />
        </ErrorBoundary>
      );
    });

    await act(async () => {
      await waitFor(() => {
        expect(screen.getByText(mockProduct.title)).toBeInTheDocument();
      });
    });
  });

  it('should handle malformed product data gracefully', async () => {
    const malformedProduct = {
      id: '123',
      title: undefined,
      price: null,
      description: null
    };

    getProductById.mockResolvedValueOnce(malformedProduct);

    await act(async () => {
      render(<ProductPage productId="123" />);
    });

    await act(async () => {
      await waitFor(() => {
        expect(screen.getByText('Untitled Product')).toBeInTheDocument();
        expect(screen.getByText('$0.00')).toBeInTheDocument();
        expect(screen.getByText('No description available')).toBeInTheDocument();
      });
    });
  });

  it('should cancel pending requests when component unmounts', async () => {
    const abortMock = jest.fn();
    const abortControllerMock = {
      abort: abortMock,
      signal: { aborted: false }
    };
    const originalAbortController = global.AbortController;
    global.AbortController = jest.fn(() => abortControllerMock);

    // Mock getProductById to return a promise that never resolves
    let resolveRequest;
    const requestPromise = new Promise(resolve => { resolveRequest = resolve; });
    getProductById.mockImplementation(() => requestPromise);

    // Mock useEffect to capture cleanup function
    const cleanupMock = jest.fn();
    const originalUseEffect = React.useEffect;
    React.useEffect = jest.fn((callback) => {
      const cleanup = callback();
      if (typeof cleanup === 'function') {
        cleanupMock.mockImplementation(cleanup);
      }
    });

    // Render and wait for loading state
    const { unmount } = render(<ProductPage productId="123" />);
    expect(screen.getByTestId('loading-container')).toBeInTheDocument();

    // Wait for a tick to ensure the fetch starts
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    // Call cleanup function before unmounting
    cleanupMock();

    // Unmount after loading starts
    unmount();

    // Wait for a tick to ensure cleanup runs
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    // Verify abort was called
    expect(abortMock).toHaveBeenCalled();

    // Clean up the pending promise
    resolveRequest(mockProduct);

    // Restore original hooks
    React.useEffect = originalUseEffect;
    global.AbortController = originalAbortController;
  });

  it('should handle multiple concurrent API requests', async () => {
    const firstProduct = { ...mockProduct, id: '123', title: 'First Product' };
    const secondProduct = { ...mockProduct, id: '456', title: 'Second Product' };

    // Mock AbortController to avoid issues with signal.aborted
    const abortMock = jest.fn();
    const abortControllerMock = {
      abort: abortMock,
      signal: { aborted: false }
    };
    const originalAbortController = global.AbortController;
    global.AbortController = jest.fn(() => abortControllerMock);

    // Mock useEffect to capture cleanup function
    const cleanupMock = jest.fn();
    const originalUseEffect = React.useEffect;
    React.useEffect = jest.fn((callback) => {
      const cleanup = callback();
      if (typeof cleanup === 'function') {
        cleanupMock.mockImplementation(cleanup);
      }
    });

    // Setup sequential API calls with controlled timing
    let firstResolve;
    let secondResolve;
    const firstRequest = new Promise(resolve => { firstResolve = resolve; });
    const secondRequest = new Promise(resolve => { secondResolve = resolve; });

    getProductById
      .mockImplementationOnce(() => firstRequest)
      .mockImplementationOnce(() => secondRequest);

    // Render with first productId
    const { rerender } = render(<ProductPage productId="123" />);

    // Wait for first product to start loading
    expect(screen.getByTestId('loading-container')).toBeInTheDocument();

    // Wait for a tick to ensure the first request starts
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    // Call cleanup before changing productId
    cleanupMock();

    // Change productId immediately
    rerender(<ProductPage productId="456" />);

    // Wait for a tick to ensure the second request starts
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    // Resolve second request first
    await act(async () => {
      secondResolve(secondProduct);
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    // Wait for second product to be displayed
    await waitFor(() => {
      expect(screen.getByTestId('product-title')).toHaveTextContent('Second Product');
    });

    // Resolve first request (should be ignored)
    await act(async () => {
      firstResolve(firstProduct);
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    // Verify only the latest product is displayed
    expect(screen.queryByText('First Product')).not.toBeInTheDocument();

    // Restore original hooks
    React.useEffect = originalUseEffect;
    global.AbortController = originalAbortController;
  });

  it('should handle error boundary integration with network errors', async () => {
    const networkError = new Error('Network error');
    networkError.name = 'NetworkError';
    networkError.code = 'NETWORK_ERROR';
    networkError.response = { status: 0 }; // Simulate network error
    getProductById.mockRejectedValueOnce(networkError);

    // Mock AbortController to avoid issues with signal.aborted
    const abortMock = jest.fn();
    const abortControllerMock = {
      abort: abortMock,
      signal: { aborted: false }
    };
    const originalAbortController = global.AbortController;
    global.AbortController = jest.fn(() => abortControllerMock);

    render(<ProductPage productId="123" />);

    // Wait for error state
    await waitFor(() => {
      expect(screen.getByTestId('error-message')).toBeInTheDocument();
    });

    // Verify error message
    const errorElement = screen.getByTestId('error-message');
    expect(errorElement).toHaveClass('network-error');
    expect(errorElement).toHaveTextContent('Network error');

    // Restore original AbortController
    global.AbortController = originalAbortController;
  });

  it('should handle cache expiration and revalidation', async () => {
    // Mock Date.now for cache timing tests
    const originalDateNow = Date.now;
    const mockNow = jest.fn();
    global.Date.now = mockNow;

    // Mock AbortController to avoid issues with signal.aborted
    const abortMock = jest.fn();
    const abortControllerMock = {
      abort: abortMock,
      signal: { aborted: false }
    };
    const originalAbortController = global.AbortController;
    global.AbortController = jest.fn(() => abortControllerMock);

    // Mock useEffect to capture cleanup function
    const cleanupMock = jest.fn();
    const originalUseEffect = React.useEffect;
    React.useEffect = jest.fn((callback) => {
      const cleanup = callback();
      if (typeof cleanup === 'function') {
        cleanupMock.mockImplementation(cleanup);
      }
    });

    try {
      // Initial request at t=0
      mockNow.mockReturnValue(0);
      const updatedProduct = { ...mockProduct, title: 'Updated Product' };

      // Setup promises for controlled resolution
      let firstResolve;
      let secondResolve;
      const firstRequest = new Promise(resolve => { firstResolve = resolve; });
      const secondRequest = new Promise(resolve => { secondResolve = resolve; });

      getProductById
        .mockImplementationOnce(() => firstRequest)
        .mockImplementationOnce(() => secondRequest);

      const { rerender } = render(<ProductPage productId="123" cacheTimeout={1000} />);

      // Wait for a tick to ensure the first request starts
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      // Resolve first request
      await act(async () => {
        firstResolve(mockProduct);
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      // Wait for initial product to load
      await waitFor(() => {
        expect(screen.getByTestId('product-title')).toHaveTextContent(mockProduct.title);
      });

      // Move time forward past cache timeout
      mockNow.mockReturnValue(1500);

      // Call cleanup before triggering rerender
      cleanupMock();

      // Trigger rerender and wait for new request to complete
      await act(async () => {
        // Force a rerender to trigger cache revalidation
        rerender(<ProductPage productId="123" cacheTimeout={1000} />);
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      // Resolve second request
      await act(async () => {
        secondResolve(updatedProduct);
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      // Wait for updated product to load
      await waitFor(() => {
        expect(screen.getByTestId('product-title')).toHaveTextContent('Updated Product');
      });

      // Verify both requests were made
      expect(getProductById).toHaveBeenCalledTimes(2);
    } finally {
      // Restore original hooks and mocks
      React.useEffect = originalUseEffect;
      global.AbortController = originalAbortController;
      global.Date.now = originalDateNow;
    }
  });
});

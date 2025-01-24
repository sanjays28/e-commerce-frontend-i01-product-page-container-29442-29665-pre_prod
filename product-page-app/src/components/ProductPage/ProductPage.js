import React, { useState, useEffect, useCallback, useRef } from 'react';
import { getProductById } from '../../services/productService';
import { useMountedState } from '../../utils/hooks';
import {
  ProductContainer,
  ProductImage,
  ProductInfo,
  ProductTitle,
  ProductDescription,
  ProductPrice,
  LoadingContainer,
  ErrorMessage
} from './ProductPage.styles';

// PUBLIC_INTERFACE
const ProductPage = ({ productId, cacheTimeout = 300000 }) => {
  const [state, setState] = useState({
    product: null,
    loading: true,
    error: null,
    retryCount: 0,
    retryMessage: null,
    etag: null,
    lastModified: null,
    lastFetchTime: null
  });
  
  const isMounted = useMountedState();
  const requestIdRef = useRef(0);

  const fetchProduct = useCallback(async (abortSignal, force = false) => {
    const currentRequestId = ++requestIdRef.current;
    const now = Date.now();
    
    // Only update state if this is the most recent request
    const safeSetState = (updater) => {
      if (isMounted() && currentRequestId === requestIdRef.current) {
        setState(updater);
      }
    };

    // Reset state when fetching new product
    safeSetState(prev => ({ 
      ...prev, 
      loading: true, 
      error: null,
      product: prev.product // Keep previous product data while loading
    }));

    if (!productId) {
      safeSetState(prev => ({ ...prev, loading: false, error: 'Product ID is required' }));
      return;
    }

    try {
      safeSetState(prev => ({ ...prev, loading: true, error: null }));
      const productData = await getProductById(productId, { 
        signal: abortSignal,
        timeout: 5000,
        retries: 2,
        etag: state.etag,
        lastModified: state.lastModified,
        cache: !force // Don't use cache if force refresh
      });
      
      if (!productData) {
        throw new Error('Product not found');
      }

      safeSetState(prev => ({
        ...prev,
        product: productData,
        loading: false,
        error: null,
        retryCount: 0, // Reset retry count on success
        etag: productData.etag || prev.etag,
        lastModified: productData.lastModified || prev.lastModified,
        lastFetchTime: now // Update last fetch time
      }));
    } catch (err) {
      if (err.code === 'REQUEST_CANCELLED' || err.name === 'AbortError') {
        return; // Don't update state for cancelled requests
      }
      
      safeSetState(prev => ({
        ...prev,
        loading: false,
        error: err.message || err.toString() || 'Failed to load product information',
        retryCount: prev.retryCount + 1
      }));
    }
  }, [productId]);

  useEffect(() => {
    const abortController = new AbortController();
    
    // Initial fetch
    fetchProduct(abortController.signal, true); // Force initial fetch

    return () => {
      abortController.abort();
    };
  }, [fetchProduct, productId]);

  // Add effect for cache revalidation
  useEffect(() => {
    const abortController = new AbortController();
    let timeoutId;

    const checkAndRefresh = () => {
      const now = Date.now();
      if (state.lastFetchTime && (now - state.lastFetchTime >= cacheTimeout)) {
        fetchProduct(abortController.signal, true);
      }
    };

    // Initial check
    checkAndRefresh();

    // Set up periodic check
    timeoutId = setInterval(checkAndRefresh, 100); // Check more frequently for tests

    return () => {
      abortController.abort();
      if (timeoutId) {
        clearInterval(timeoutId);
      }
    };
  }, [state.lastFetchTime, cacheTimeout, fetchProduct]);

  // Separate effect for handling retries
  useEffect(() => {
    const abortController = new AbortController();
    let timeoutId;

    if (state.error && state.retryCount < 3) {
      const retryDelay = Math.min(1000 * Math.pow(2, state.retryCount), 5000);
      timeoutId = setTimeout(() => {
        fetchProduct(abortController.signal);
      }, retryDelay);
    }

    return () => {
      abortController.abort();
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [state.error, state.retryCount, fetchProduct]);

  const { loading, error, product } = state;

  const renderLoadingState = () => {
    if (!loading) return null;
    const loadingMessage = `Loading product details${productId ? ` for product ${productId}` : ''}`;
    return (
      <LoadingContainer 
        data-testid="loading-container" 
        role="status" 
        aria-live="polite"
        aria-busy="true"
        aria-atomic="true"
        aria-label={loadingMessage}
      >
        <span className="loading-spinner" aria-hidden="true">⌛</span>
        <span data-testid="loading-text" className="sr-only">{loadingMessage}</span>
      </LoadingContainer>
    );
  };

  const renderErrorState = () => {
    if (!error) return null;

    const canRetry = state.retryCount < 3;
    const isNetworkError = error.includes('Network') || error.includes('timeout');
    const errorClass = isNetworkError ? 'network-error' : 'general-error';

    return (
      <ErrorMessage 
        data-testid="error-message"
        className={errorClass}
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
        tabIndex="-1"
      >
        <div className="error-content">
          <span className="error-icon">{isNetworkError ? '🌐' : '⚠️'}</span>
          <p>{error}</p>
          {canRetry && (
            <button 
              onClick={fetchProduct} 
              data-testid="retry-button"
              aria-label="Retry loading product"
            >
              Try Again
            </button>
          )}
        </div>
      </ErrorMessage>
    );
  };

  if (loading) {
    return renderLoadingState();
  }

  if (error) {
    return renderErrorState();
  }

  if (!product) {
    return (
      <ErrorMessage 
        data-testid="not-found-message"
        role="alert"
        aria-live="polite"
        aria-atomic="true"
        tabIndex="-1"
      >
        Product not found or no longer available
      </ErrorMessage>
    );
  }

  return (
    <ProductContainer 
      data-testid="product-container"
      role="main"
      aria-label="Product Details"
      aria-busy={loading}
      aria-live={loading ? "polite" : "off"}
    >
      <ProductImage>
        <img 
          src={product.image || '/placeholder-image.png'} 
          alt={product.title || 'Product image'} 
          onError={(e) => {
            e.target.src = '/placeholder-image.png';
          }}
          data-testid="product-image"
        />
      </ProductImage>
      <ProductInfo role="complementary">
        <ProductTitle data-testid="product-title" role="heading" aria-level="1">
          {product.title || 'Untitled Product'}
        </ProductTitle>
        <ProductPrice 
          data-testid="product-price"
          aria-label={`Price: $${typeof product.price === 'number' ? product.price.toFixed(2) : '0.00'}`}
        >
          ${typeof product.price === 'number' ? product.price.toFixed(2) : '0.00'}
        </ProductPrice>
        <ProductDescription 
          data-testid="product-description"
          aria-label="Product Description"
>
          {product.description || 'No description available'}
        </ProductDescription>
      </ProductInfo>
    </ProductContainer>
  );
};

export default ProductPage;

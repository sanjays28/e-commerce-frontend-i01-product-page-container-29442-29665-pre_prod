// Custom error class for data transformation errors
class TransformError extends Error {
  constructor(message, field, value) {
    super(message);
    this.name = 'TransformError';
    this.field = field;
    this.value = value;
  }
}

/**
 * Transforms raw product data from the API into the format expected by the UI
 * @param {Object} data - Raw product data from the API
 * @returns {Object} - Transformed product data
 * @throws {TransformError} - If data validation or transformation fails
 */
export const transformProductResponse = (data) => {
  // Validate input data
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new TransformError('No product data provided', 'data', data);
  }

  // Handle price transformation with enhanced validation
  const transformPrice = (price) => {
    // Handle empty object case
    if (price === null || price === undefined || (typeof price === 'object' && Object.keys(price).length === 0)) {
      return '0.00';
    }

    // Handle string inputs
    if (typeof price === 'string') {
      // Remove currency symbols, commas and whitespace
      const cleanPrice = price.replace(/[$\u00a3\u20ac,\s]/g, '').trim();
      if (!/^\d*\.?\d+$/.test(cleanPrice)) {
        return '0.00';
      }
      price = parseFloat(cleanPrice);
    }
    
    if (typeof price !== 'number' || isNaN(price)) {
      return '0.00';
    }

    // Handle precision and rounding
    const roundedPrice = Math.round(Math.max(0, price) * 100) / 100;
    
    // Always return with exactly 2 decimal places
    return roundedPrice.toFixed(2);
  };


  try {
    // Create base object with required fields
    const transformed = {
      id: data.id ?? '',
      title: data.title ?? 'Untitled Product',
      description: data.description ?? 'No description available',
      price: transformPrice(data.price),
      image: data.image ?? null,
      category: data.category ?? 'Uncategorized',
    };

    // Preserve all additional fields from the input data
    for (const [key, value] of Object.entries(data)) {
      if (!transformed.hasOwnProperty(key)) {
        transformed[key] = value;
      }
    }

    return transformed;
  } catch (error) {
    if (error instanceof TransformError) {
      throw error;
    }
    throw new TransformError('Failed to transform product data', 'unknown', error.message);
  }
};

// Export error class for use in other modules
export { TransformError };

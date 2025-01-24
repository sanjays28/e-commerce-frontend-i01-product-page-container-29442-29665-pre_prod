import { transformProductResponse } from '../transformers';

describe('transformers', () => {
  describe('input validation', () => {
    it('should handle empty object input', () => {
      const result = transformProductResponse({});
      expect(result).toEqual({
        id: '',
        title: 'Untitled Product',
        description: 'No description available',
        price: '0.00',
        image: null,
        category: 'Uncategorized'
      });
    });

    it('should preserve empty string values', () => {
      const mockData = {
        id: '123',
        title: '',
        description: '',
        price: 99.99,
        category: ''
      };

      const result = transformProductResponse(mockData);
      expect(result.title).toBe('');
      expect(result.description).toBe('');
      expect(result.category).toBe('');
    });
  });
  describe('transformProductResponse', () => {
    it('should transform valid product data correctly', () => {
      const mockData = {
        id: '123',
        title: 'Test Product',
        description: 'Test Description',
        price: 99.99,
        image: 'test.jpg',
        category: 'Electronics'
      };

      const result = transformProductResponse(mockData);

      expect(result).toEqual({
        id: '123',
        title: 'Test Product',
        description: 'Test Description',
        price: '99.99',
        image: 'test.jpg',
        category: 'Electronics'
      });
    });

    it('should handle missing optional fields', () => {
      const mockData = {
        id: '123',
        price: 99.99
      };

      const result = transformProductResponse(mockData);

      expect(result).toEqual({
        id: '123',
        title: 'Untitled Product',
        description: 'No description available',
        price: '99.99',
        image: null,
        category: 'Uncategorized'
      });
    });

    it('should handle invalid price data', () => {
      const testCases = [
        { price: 'invalid', expected: '0.00' },
        { price: NaN, expected: '0.00' },
        { price: '', expected: '0.00' },
        { price: true, expected: '0.00' },
        { price: [], expected: '0.00' },
        { price: {}, expected: '0.00' }
      ];

      testCases.forEach(({ price, expected }) => {
        const mockData = {
          id: '123',
          title: 'Test Product',
          price
        };

        const result = transformProductResponse(mockData);
        expect(result.price).toBe(expected);
      });
    });

    it('should handle decimal prices correctly', () => {
      const testCases = [
        { price: 99.999, expected: '100.00' },
        { price: 99.001, expected: '99.00' },
        { price: 0.5, expected: '0.50' },
        { price: 1000, expected: '1000.00' }
      ];

      testCases.forEach(({ price, expected }) => {
        const mockData = {
          id: '123',
          title: 'Test Product',
          price
        };

        const result = transformProductResponse(mockData);
        expect(result.price).toBe(expected);
      });
    });

    it('should throw error when no data is provided', () => {
      const invalidInputs = [null, undefined, '', false, 0, []];
      invalidInputs.forEach(input => {
        expect(() => transformProductResponse(input)).toThrow('No product data provided');
      });
    });

    it('should handle special characters in text fields', () => {
      const mockData = {
        id: '123',
        title: 'Product & Special < > " \' Characters',
        description: 'Description with & < > " \' symbols',
        price: 99.99,
        category: 'Category & Test'
      };

      const result = transformProductResponse(mockData);
      expect(result.title).toBe(mockData.title);
      expect(result.description).toBe(mockData.description);
      expect(result.category).toBe(mockData.category);
    });

    it('should handle extremely large price values', () => {
      const testCases = [
        { price: 999999999.99, expected: '999999999.99' },
        { price: 1e10, expected: '10000000000.00' },
        { price: Number.MAX_SAFE_INTEGER, expected: '9007199254740991.00' }
      ];

      testCases.forEach(({ price, expected }) => {
        const mockData = {
          id: '123',
          title: 'Test Product',
          price
        };

        const result = transformProductResponse(mockData);
        expect(result.price).toBe(expected);
      });
    });

    it('should handle very small price values', () => {
      const testCases = [
        { price: 0.001, expected: '0.00' },
        { price: 0.009, expected: '0.01' },
        { price: 0.0000001, expected: '0.00' }
      ];

      testCases.forEach(({ price, expected }) => {
        const mockData = {
          id: '123',
          title: 'Test Product',
          price
        };

        const result = transformProductResponse(mockData);
        expect(result.price).toBe(expected);
      });
    });

    it('should handle nested product data structures', () => {
      const mockData = {
        id: '123',
        title: 'Test Product',
        price: 99.99,
        details: {
          specifications: {
            color: 'red',
            size: 'large'
          },
          shipping: {
            weight: '2kg'
          }
        },
        variants: [
          { id: 1, color: 'red' },
          { id: 2, color: 'blue' }
        ]
      };

      const result = transformProductResponse(mockData);
      expect(result.id).toBe('123');
      expect(result.title).toBe('Test Product');
      expect(result.price).toBe('99.99');
      // Verify that non-standard fields are preserved
      expect(result.details).toEqual(mockData.details);
      expect(result.variants).toEqual(mockData.variants);
    });

    it('should handle unicode characters in text fields', () => {
      const mockData = {
        id: '123',
        title: '产品名称',
        description: '描述 🎉 emoji ⭐',
        price: 99.99,
        category: 'カテゴリー'
      };

      const result = transformProductResponse(mockData);
      expect(result.title).toBe(mockData.title);
      expect(result.description).toBe(mockData.description);
      expect(result.category).toBe(mockData.category);
    });
  });
});

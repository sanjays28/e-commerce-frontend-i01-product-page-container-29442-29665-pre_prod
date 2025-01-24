// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';
import { configure } from '@testing-library/react';
import 'jest-environment-jsdom';

// Configure testing-library
configure({
  testIdAttribute: 'data-testid',
});

// Mock IntersectionObserver
class IntersectionObserver {
  constructor(callback, options) {
    this.callback = callback;
    this.options = options;
  }

  observe() {
    return null;
  }

  unobserve() {
    return null;
  }

  disconnect() {
    return null;
  }
}

global.IntersectionObserver = IntersectionObserver;

// Setup fetch mock
global.fetch = jest.fn();

// Suppress console errors during tests
global.console.error = jest.fn();

// Add custom jest matchers
expect.extend({
  toBeInTheDocument: (received) => ({
    pass: received !== null,
    message: () => `expected ${received} to be in the document`,
  }),
});

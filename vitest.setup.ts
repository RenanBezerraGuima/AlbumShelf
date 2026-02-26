import '@testing-library/jest-dom';

// Mock ResizeObserver for Vitest/jsdom environment
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

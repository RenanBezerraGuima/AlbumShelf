import '@testing-library/jest-dom';
import React from 'react';
import { vi } from 'vitest';

// Mock TooltipProvider for tests as it's required by shadcn Tooltip components
vi.mock('@/components/ui/tooltip', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/components/ui/tooltip')>();
  return {
    ...actual,
    TooltipProvider: ({ children }: { children: React.ReactNode }) => children,
    Tooltip: ({ children }: { children: React.ReactNode }) => children,
    TooltipTrigger: ({ children }: { children: React.ReactNode }) => children,
    TooltipContent: ({ children }: { children: React.ReactNode }) => children,
  };
});

// Mock ResizeObserver for Vitest/jsdom environment
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

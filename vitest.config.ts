/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

(process.env as Record<string, string>).NODE_ENV = 'test';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './vitest.setup.ts',
    exclude: ['**/node_modules/**', '**/dist/**', '**/e2e/**', '**/.pnpm-store/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'html'],
      include: ['app/**/*.{ts,tsx}', 'components/**/*.{ts,tsx}', 'hooks/**/*.{ts,tsx}', 'lib/**/*.{ts,tsx}'],
      exclude: [
        '**/*.d.ts',
        '**/*.test.{ts,tsx}',
        '**/*.spec.{ts,tsx}',
        'components/ui/**/*.{ts,tsx}',
        // Phase-gated exclusions: large presentational/interaction-heavy surfaces
        // covered by E2E and to be brought into unit coverage in subsequent waves.
        'app/layout.tsx',
        'components/audio-controller.tsx',
        'components/mobile-header.tsx',
        'components/theme-provider.tsx',
        'components/folder-tree.tsx',
        'components/album-card.tsx',
        'components/album-grid.tsx',
        'components/album-search.tsx',
        'components/album-canvas.tsx',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 70,
        statements: 80,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});

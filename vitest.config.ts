import { defineConfig } from 'vitest/config';
import path from 'path';

const __dirname = import.meta.dirname;

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
      '@/app': path.resolve(__dirname, './app'),
      '@/lib': path.resolve(__dirname, './lib'),
      '@/db': path.resolve(__dirname, './db'),
      '@/services': path.resolve(__dirname, './services'),
    },
  },
  test: {
    environment: 'node',
    globals: true,
    include: ['**/*.test.ts', '**/*.spec.ts'],
    exclude: [
      'node_modules',
      'dist',
      '.idea',
      '.git',
      '.cache',
      'tests/integration.database.test.ts',
      'tests/security.phase3.test.ts',
    ],
    passWithNoTests: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
    // Increased timeout for database integration tests
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});

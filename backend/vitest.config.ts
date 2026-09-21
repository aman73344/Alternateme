import { defineConfig } from 'vitest/config';
import path from 'path';
import { pathToFileURL } from 'url';

// Compute srcDir with forward slashes to avoid issues with spaces in paths
const srcDir = path.resolve(__dirname, 'src').replace(/\\/g, '/');

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    root: '.',
    include: ['src/**/*.test.ts', 'src/**/*.spec.ts'],
    exclude: ['node_modules', 'dist', 'coverage'],
    env: {
      EMBEDDING_PROVIDER: 'deterministic',
    },
    setupFiles: ['./src/tests/setup.ts'],
    testTimeout: 180000,
    hookTimeout: 180000,
    teardownTimeout: 10000,
    sequence: {
      shuffle: false,
    },
    reporters: ['default'],
  },
  resolve: {
    alias: {
      '@/': `${srcDir}/`,
      '@': `${srcDir}/`,
    },
  },
});

import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    root: 'src',
    include: ['**/*.test.ts', '**/*.spec.ts'],
    exclude: ['node_modules', 'dist'],
    env: {
      // Tests must never call the real OpenAI API: the deterministic provider
      // derives stable local vectors so the full pipeline (extract → clean →
      // chunk → embed → pgvector) is verified hermetically. Production runs
      // outside vitest and uses EMBEDDING_PROVIDER=openai from .env.
      EMBEDDING_PROVIDER: 'deterministic',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.test.ts',
        '**/*.spec.ts',
        '**/tests/**',
      ],
      thresholds: {
        statements: 80,
        branches: 75,
        functions: 80,
        lines: 80,
      },
    },
    setupFiles: ['./src/tests/setup.ts'],
    // Integration suites run the full pipeline against remote PostgreSQL
    // (Neon). Each Prisma round trip can cost ~250-500ms and one ingestion
    // issues dozens of queries, so per-test budgets must be generous.
    testTimeout: 180000,
    hookTimeout: 180000,
    teardownTimeout: 10000,
    sequence: {
      // Integration suites share sequential state (auth token → alternateId),
      // so randomized order breaks them. Keep deterministic ordering.
      shuffle: false,
    },
    reporters: ['default', 'json'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
});

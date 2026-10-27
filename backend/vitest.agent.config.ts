/**
 * Phase 6 — agent unit-test configuration.
 *
 * WHY A SEPARATE CONFIG: the default `vitest.config.ts` runs
 * `src/tests/setup.ts` for EVERY test file, and that setup performs
 * `prisma.$queryRaw`SELECT 1`` in `beforeAll`. When the database is
 * unreachable, every suite aborts before a single assertion runs.
 *
 * The Phase 6 agent logic (registry, validation, policy, authorization,
 * sanitization, retry, idempotency, limits) is pure application logic and is
 * fully testable with `@/database` mocked. This config runs exactly those
 * suites with no setup file and no database.
 *
 * It does NOT weaken the existing suite: `pnpm test` still uses vitest.config.ts
 * and still runs the integration tests against a real database.
 */

import { defineConfig } from 'vitest/config';
import path from 'path';

const srcDir = path.resolve(__dirname, 'src').replace(/\\/g, '/');

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    root: '.',
    include: ['src/tests/agent/**/*.test.ts'],
    exclude: ['node_modules', 'dist', 'coverage'],
    env: {
      NODE_ENV: 'test',
      LOG_LEVEL: 'silent',
      EMBEDDING_PROVIDER: 'deterministic',
      QUEUE_ENABLED: 'false',
      // Never connect: a syntactically valid URL so PrismaClient can be
      // constructed, but no test in this project issues a real query.
      DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
      REDIS_URL: 'redis://localhost:6379',
      JWT_ACCESS_SECRET: 'test-access-secret-minimum-32-chars!!',
      JWT_REFRESH_SECRET: 'test-refresh-secret-minimum-32-chars!!',
      ENCRYPTION_KEY: 'test-encryption-key-32-characters-minimum!!',
      // Phase 6 policy under test
      AGENT_ENABLED: 'true',
      AGENT_SAMPLE_ACTION_TOOL_ENABLED: 'true',
      AGENT_APPROVAL_LOW: 'false',
      AGENT_APPROVAL_MEDIUM: 'false',
    },
    testTimeout: 20000,
    hookTimeout: 20000,
    sequence: { shuffle: false },
    reporters: ['default'],
  },
  resolve: {
    alias: {
      '@/': `${srcDir}/`,
      '@': `${srcDir}/`,
    },
  },
});

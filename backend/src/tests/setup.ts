// Use process.env directly with a cast — NODE_ENV is readonly on the global object
// in newer @types/node declarations
(process.env as Record<string, string>).NODE_ENV = 'test';
(process.env as Record<string, string>).LOG_LEVEL = 'silent';
(process.env as Record<string, string>).JWT_ACCESS_SECRET = 'test-access-secret-minimum-32-chars!!';
(process.env as Record<string, string>).JWT_REFRESH_SECRET = 'test-refresh-secret-minimum-32-chars!!';
(process.env as Record<string, string>).DATABASE_URL = 'postgresql://altme:altme_test@localhost:5432/altme_test';
(process.env as Record<string, string>).REDIS_URL = 'redis://localhost:6379';
(process.env as Record<string, string>).ENCRYPTION_KEY = 'test-encryption-key-32-characters-minimum!!';

import { beforeAll, afterAll } from 'vitest';

beforeAll(async () => {
  // Initialize test environment
});

afterAll(async () => {
  // Cleanup test environment
});
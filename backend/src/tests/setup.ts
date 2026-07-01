import { config } from '@/config';

process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'silent';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-minimum-32-chars!!';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-minimum-32-chars!!';
process.env.DATABASE_URL = 'postgresql://altme:altme_test@localhost:5432/altme_test';
process.env.REDIS_URL = 'redis://localhost:6379';

import { beforeAll, afterAll } from 'vitest';

beforeAll(async () => {
  // Initialize test environment
});

afterAll(async () => {
  // Cleanup test environment
});

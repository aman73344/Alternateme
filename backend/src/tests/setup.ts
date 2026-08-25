// Test setup — uses the real DATABASE_URL from .env for integration testing
// NODE_ENV is readonly on the global object in newer @types/node declarations
(process.env as Record<string, string>).NODE_ENV = 'test';
(process.env as Record<string, string>).LOG_LEVEL = 'silent';

// Load .env for DATABASE_URL, DIRECT_URL, JWT secrets, etc.
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Ensure required test env vars exist (fall back to test values if not in .env)
if (!process.env.JWT_ACCESS_SECRET) {
  (process.env as Record<string, string>).JWT_ACCESS_SECRET = 'test-access-secret-minimum-32-chars!!';
}
if (!process.env.JWT_REFRESH_SECRET) {
  (process.env as Record<string, string>).JWT_REFRESH_SECRET = 'test-refresh-secret-minimum-32-chars!!';
}
if (!process.env.ENCRYPTION_KEY) {
  (process.env as Record<string, string>).ENCRYPTION_KEY = 'test-encryption-key-32-characters-minimum!!';
}
if (!process.env.REDIS_URL) {
  (process.env as Record<string, string>).REDIS_URL = 'redis://localhost:6379';
}

import { beforeAll, afterAll } from 'vitest';
import { prisma } from '@/database';

beforeAll(async () => {
  // Verify database connectivity
  await prisma.$queryRaw`SELECT 1`;
});

afterAll(async () => {
  await prisma.$disconnect();
});
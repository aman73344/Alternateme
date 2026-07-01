export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 10,
  MAX_LIMIT: 100,
};

export const AI = {
  MAX_RETRIES: 3,
  TIMEOUT_MS: 60000,
  MAX_TOKENS: 4096,
  TEMPERATURE: 0.7,
};

export const RATE_LIMIT = {
  FREE_TIER: { windowMs: 60000, max: 20 },
  PRO_TIER: { windowMs: 60000, max: 100 },
  ENTERPRISE_TIER: { windowMs: 60000, max: 1000 },
};

export const FILE = {
  MAX_UPLOAD_SIZE: 50 * 1024 * 1024,
  ALLOWED_MIME_TYPES: [
    'application/pdf',
    'text/plain',
    'text/csv',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/markdown',
    'text/html',
    'application/json',
  ],
  CHUNK_SIZE: 512,
  CHUNK_OVERLAP: 64,
};

export const STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  PENDING: 'pending',
  DELETED: 'deleted',
  DRAFT: 'draft',
  PUBLISHED: 'published',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const;

export const SUBSCRIPTION_TIERS = {
  FREE: 'free',
  PRO: 'pro',
  ENTERPRISE: 'enterprise',
} as const;

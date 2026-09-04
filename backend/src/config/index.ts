import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

interface Config {
  app: {
    nodeEnv: string;
    port: number;
    apiPrefix: string;
    apiVersion: string;
    name: string;
    url: string;
    clientUrl: string;
    corsOrigins: string[];
  };
  database: {
    url: string;
    poolMin: number;
    poolMax: number;
  };
  redis: {
    url: string;
    prefix: string;
    /** Queues/Redis can be explicitly disabled (e.g. hermetic test runs). */
    enabled: boolean;
  };
  jwt: {
    accessSecret: string;
    refreshSecret: string;
    accessExpiry: string;
    refreshExpiry: string;
    issuer?: string;
    audience?: string;
  };
  ai: {
    openai: { apiKey: string; model: string; embeddingModel: string };
    anthropic: { apiKey: string; model: string };
    gemini: { apiKey: string; model: string };
  };
  oauth: {
    google: { clientId: string; clientSecret: string; redirectUri: string };
    github: { clientId: string; clientSecret: string; redirectUri: string };
  };
  voice: {
    elevenlabs: { apiKey: string; model: string };
    cartesia: { apiKey: string };
  };
  telephony: {
    twilio: { accountSid: string; authToken: string; phoneNumber: string };
  };
  email: {
    resend: { apiKey: string };
    smtp: { host: string; port: number; user: string; pass: string; from: string };
  };
  storage: {
    provider: string;
    accessKeyId: string;
    secretAccessKey: string;
    region: string;
    bucket: string;
    endpoint: string;
    publicUrl: string;
    localDir: string;
  };
  billing: {
    stripe: { secretKey: string; webhookSecret: string };
  };
  logging: {
    level: string;
    pretty: boolean;
  };
  queue: {
    concurrency: number;
  };
  rateLimit: {
    windowMs: number;
    max: number;
  };
  features: {
    voiceCloning: boolean;
    telephony: boolean;
    emailAgent: boolean;
    byok: boolean;
  };
  analytics: {
    enabled: boolean;
    posthogApiKey: string;
  };
  encryption: {
    key: string;
  };
  knowledge: {
    embedding: {
      provider: string;
      model: string;
      dimensions: number;
      batchSize: number;
      timeoutMs: number;
    };
    chunking: {
      chunkSize: number;
      overlap: number;
      maxChunkSize: number;
      minChunkSize: number;
    };
    url: {
      timeoutMs: number;
      maxRedirects: number;
      maxResponseSize: number;
      userAgent: string;
    };
    file: {
      maxFileSize: number;
      maxDocumentSize: number;
      allowedMimeTypes: string[];
    };
    retry: {
      maxAttempts: number;
    };
  };
}

const config: Config = {
  app: {
    nodeEnv: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '4000', 10),
    apiPrefix: process.env.API_PREFIX || '/api/v1',
    apiVersion: process.env.API_VERSION || '1.0.0',
    name: process.env.APP_NAME || 'Alternate Me API',
    url: process.env.APP_URL || 'http://localhost:4000',
    clientUrl: process.env.CLIENT_URL || 'http://localhost:3000',
    corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:3000').split(','),
  },
  database: {
    url: process.env.DATABASE_URL || '',
    poolMin: parseInt(process.env.DATABASE_POOL_MIN || '2', 10),
    poolMax: parseInt(process.env.DATABASE_POOL_MAX || '10', 10),
  },
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    prefix: process.env.REDIS_PREFIX || 'altme',
    // QUEUE_ENABLED=false (or no REDIS_URL) disables all BullMQ queues; callers
    // receive null and must degrade gracefully (jobs stay QUEUED in the DB).
    enabled: process.env.QUEUE_ENABLED !== 'false' && !!process.env.REDIS_URL,
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET || '',
    refreshSecret: process.env.JWT_REFRESH_SECRET || '',
    accessExpiry: process.env.JWT_ACCESS_EXPIRY || '15m',
    refreshExpiry: process.env.JWT_REFRESH_EXPIRY || '7d',
    issuer: process.env.JWT_ISSUER || 'alterneme-api',
    audience: process.env.JWT_AUDIENCE || 'alterneme-client',
  },
  ai: {
    openai: {
      apiKey: process.env.OPENAI_API_KEY || '',
      model: process.env.OPENAI_MODEL || 'gpt-4o',
      embeddingModel: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small',
    },
    anthropic: {
      apiKey: process.env.ANTHROPIC_API_KEY || '',
      model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514',
    },
    gemini: {
      apiKey: process.env.GEMINI_API_KEY || '',
      model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    },
  },
  voice: {
    elevenlabs: {
      apiKey: process.env.ELEVENLABS_API_KEY || '',
      model: process.env.ELEVENLABS_MODEL || 'eleven_turbo_v2_5',
    },
    cartesia: {
      apiKey: process.env.CARTESIA_API_KEY || '',
    },
  },
  telephony: {
    twilio: {
      accountSid: process.env.TWILIO_ACCOUNT_SID || '',
      authToken: process.env.TWILIO_AUTH_TOKEN || '',
      phoneNumber: process.env.TWILIO_PHONE_NUMBER || '',
    },
  },
  email: {
    resend: {
      apiKey: process.env.RESEND_API_KEY || '',
    },
    smtp: {
      host: process.env.SMTP_HOST || '',
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASS || '',
      from: process.env.SMTP_FROM || 'noreply@alterneme.com',
    },
  },
  storage: {
    provider: process.env.STORAGE_PROVIDER || 'auto',
    accessKeyId: process.env.STORAGE_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.STORAGE_SECRET_ACCESS_KEY || '',
    region: process.env.STORAGE_REGION || 'us-east-1',
    bucket: process.env.STORAGE_BUCKET || 'alterneme-uploads',
    endpoint: process.env.STORAGE_ENDPOINT || '',
    publicUrl: process.env.STORAGE_PUBLIC_URL || '',
    localDir: process.env.LOCAL_STORAGE_DIR || 'uploads',
  },
  billing: {
    stripe: {
      secretKey: process.env.STRIPE_SECRET_KEY || '',
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
    },
  },
  oauth: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      redirectUri: process.env.GOOGLE_REDIRECT_URI || `${process.env.APP_URL || 'http://localhost:4000'}/api/v1/auth/google/callback`,
    },
    github: {
      clientId: process.env.GITHUB_CLIENT_ID || '',
      clientSecret: process.env.GITHUB_CLIENT_SECRET || '',
      redirectUri: process.env.GITHUB_REDIRECT_URI || `${process.env.APP_URL || 'http://localhost:4000'}/api/v1/auth/github/callback`,
    },
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    pretty: process.env.LOG_PRETTY === 'true',
  },
  queue: {
    concurrency: parseInt(process.env.QUEUE_CONCURRENCY || '5', 10),
  },
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
    max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
  },
  features: {
    voiceCloning: process.env.FEATURE_VOICE_CLONING === 'true',
    telephony: process.env.FEATURE_TELEPHONY === 'true',
    emailAgent: process.env.FEATURE_EMAIL_AGENT === 'true',
    byok: process.env.FEATURE_BYOK === 'true',
  },
  analytics: {
    enabled: process.env.ANALYTICS_ENABLED === 'true',
    posthogApiKey: process.env.POSTHOG_API_KEY || '',
  },
  encryption: {
    key: process.env.ENCRYPTION_KEY || '',
  },
  knowledge: {
    embedding: {
      provider: process.env.EMBEDDING_PROVIDER || 'openai',
      model: process.env.EMBEDDING_MODEL || 'text-embedding-3-small',
      dimensions: parseInt(process.env.EMBEDDING_DIMENSIONS || '1536', 10),
      batchSize: parseInt(process.env.EMBEDDING_BATCH_SIZE || '64', 10),
      timeoutMs: parseInt(process.env.EMBEDDING_TIMEOUT_MS || '30000', 10),
    },
    chunking: {
      chunkSize: parseInt(process.env.CHUNK_SIZE || '1000', 10),
      overlap: parseInt(process.env.CHUNK_OVERLAP || '150', 10),
      maxChunkSize: parseInt(process.env.MAX_CHUNK_SIZE || '2048', 10),
      minChunkSize: parseInt(process.env.MIN_CHUNK_SIZE || '64', 10),
    },
    url: {
      timeoutMs: parseInt(process.env.INGESTION_TIMEOUT || '15000', 10),
      maxRedirects: parseInt(process.env.MAX_URL_REDIRECTS || '5', 10),
      maxResponseSize: parseInt(process.env.MAX_URL_RESPONSE_SIZE || String(5 * 1024 * 1024), 10),
      userAgent: process.env.INGESTION_USER_AGENT || 'AlternateMeBot/1.0 (+https://alterneme.com)',
    },
    file: {
      maxFileSize:
        parseInt(process.env.MAX_FILE_SIZE || String(25 * 1024 * 1024), 10),
      maxDocumentSize:
        parseInt(process.env.MAX_DOCUMENT_SIZE || String(15 * 1024 * 1024), 10),
      allowedMimeTypes: (process.env.ALLOWED_FILE_TYPES || 'application/pdf,text/plain,text/markdown,application/vnd.openxmlformats-officedocument.wordprocessingml.document')
        .split(','),
    },
    retry: {
      maxAttempts: parseInt(process.env.INGESTION_MAX_RETRIES || '3', 10),
    },
  },
};

export { config };
export type { Config };

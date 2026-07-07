# Alternate Me — Backend Architecture

## Table of Contents

1. [Overall Architecture](#1-overall-architecture)
2. [Folder Structure](#2-folder-structure)
3. [Configuration System](#3-configuration-system)
4. [Express Initialization](#4-express-initialization)
5. [Middleware Architecture](#5-middleware-architecture)
6. [Error Handling](#6-error-handling)
7. [Logging](#7-logging)
8. [API Response Standard](#8-api-response-standard)
9. [Validation Strategy](#9-validation-strategy)
10. [Utility Modules](#10-utility-modules)
11. [Queue System](#11-queue-system)
12. [Event Architecture](#12-event-architecture)
13. [Redis Strategy](#13-redis-strategy)
14. [Security Foundation](#14-security-foundation)
15. [Docker](#15-docker)
16. [CI/CD](#16-cicd)
17. [Monitoring](#17-monitoring)
18. [Coding Standards](#18-coding-standards)
19. [Development Workflow](#19-development-workflow)
20. [Pre-Phase 1 Recommendations](#20-pre-phase-1-recommendations)

---

## 1. Overall Architecture

### Layered Architecture

```
┌──────────────────────────────────────────────────────┐
│                    LAYER                             │
├──────────────────────────────────────────────────────┤
│  Controllers     (HTTP Layer)                         │
├──────────────────────────────────────────────────────┤
│  Services        (Business Logic)                     │
├──────────────────────────────────────────────────────┤
│  Repositories    (Data Access)                        │
├──────────────────────────────────────────────────────┤
│  Database        (PostgreSQL via Prisma)              │
└──────────────────────────────────────────────────────┘
```

### Layer Responsibilities

**Controller Layer**

- Parse HTTP requests (params, query, body)
- Call appropriate service methods
- Return standardized responses via `apiResponse`
- Never contains business logic

**Service Layer**

- All business logic and orchestration
- Calls repositories for data access
- Emits events via event bus
- Enqueues jobs via BullMQ
- Handles cross-cutting concerns (auth, permissions)

**Repository Layer**

- Direct database access via Prisma
- Transaction management
- Query building
- No business logic

**Middleware Layer**

- Request pipeline processing
- Authentication, logging, rate limiting, validation
- Tenant resolution

**Utility Layer**

- Shared helpers (encryption, pagination, retry)
- Error classes
- Response formatters

**Configuration Layer**

- Environment-based config with validation
- Zod schema for env validation on startup

### Why Layered Architecture?

- **Separation of concerns**: Each layer has a single responsibility
- **Testability**: Each layer can be mocked independently
- **Maintainability**: Business logic changes don't affect HTTP layer
- **Scalability**: Services can be extracted to microservices later

### Service Communication

- Synchronous: Direct method calls within process
- Asynchronous: BullMQ queues for heavy tasks
- Event-driven: Internal EventEmitter for cross-service events

---

## 2. Folder Structure

```
backend/
├── src/
│   ├── index.ts                 # Entry point
│   ├── app.ts                   # Express app setup
│   │
│   ├── config/                  # Configuration
│   │   ├── index.ts             # Config object from env
│   │   ├── env.validation.ts    # Zod env schema
│   │   └── swagger.ts           # OpenAPI docs config
│   │
│   ├── controllers/             # HTTP handlers
│   │   └── health.controller.ts # Example controller
│   │
│   ├── services/                # Business logic
│   │   └── (service files)
│   │
│   ├── repositories/            # Data access
│   │   └── (repository files)
│   │
│   ├── middlewares/             # Express middleware
│   │   ├── index.ts             # Barrel export
│   │   ├── errorHandler.ts      # Global error handler
│   │   ├── notFound.ts          # 404 handler
│   │   ├── requestId.ts         # X-Request-Id
│   │   ├── requestLogger.ts     # Request logging
│   │   ├── rateLimiter.ts       # Rate limiting
│   │   ├── validate.ts          # Zod validation
│   │   └── tenant.ts            # Multi-tenant resolver
│   │
│   ├── routes/                  # Route definitions
│   │   ├── index.ts             # Main router
│   │   └── health.ts            # Health check routes
│   │
│   ├── validators/              # Zod validation schemas
│   │   └── (validation files)
│   │
│   ├── schemas/                 # Response/DB schemas
│   │   └── (schema files)
│   │
│   ├── interfaces/              # TypeScript interfaces
│   │   └── index.ts
│   │
│   ├── types/                   # TypeScript types
│   │   └── index.ts
│   │
│   ├── utils/                   # Core utilities
│   │   ├── index.ts
│   │   ├── logger.ts            # Pino logger
│   │   ├── errors.ts            # Error classes
│   │   ├── response.ts          # Response helpers
│   │   └── helpers.ts           # UUID, crypto, pagination
│   │
│   ├── constants/               # App constants
│   │   └── index.ts             # All constants
│   │
│   ├── helpers/                 # Business helpers
│   │   └── index.ts
│   │
│   ├── workers/                 # BullMQ workers
│   │   └── index.ts
│   │
│   ├── queues/                  # BullMQ queue definitions
│   │   └── index.ts
│   │
│   ├── events/                  # Event system
│   │   └── index.ts             # EventEmitter + event names
│   │
│   ├── database/                # Database connection
│   │   ├── index.ts
│   │   └── prisma.ts            # Prisma client
│   │
│   ├── storage/                 # File storage
│   │   └── index.ts             # S3 / Local adapter
│   │
│   ├── shared/                  # Shared services
│   │   ├── index.ts
│   │   ├── cache.ts             # Redis cache manager
│   │   ├── redis.ts             # Redis connection
│   │   ├── rateLimiter.ts       # Distributed rate limiter
│   │   └── monitoring.ts        # Metrics collector
│   │
│   ├── emails/                  # Email templates
│   │   └── (email templates)
│   │
│   ├── telephony/               # Twilio integration
│   │   └── (telephony files)
│   │
│   ├── voice/                   # Voice synthesis
│   │   └── (voice files)
│   │
│   ├── rag/                     # RAG pipeline
│   │   └── (RAG files)
│   │
│   ├── ai/                      # AI orchestration
│   │   ├── providers/           # OpenAI, Anthropic, Gemini
│   │   └── templates/           # Prompt templates
│   │
│   ├── chat/                    # Chat logic
│   │
│   ├── analytics/               # Analytics service
│   │
│   ├── billing/                 # Stripe integration
│   │
│   ├── admin/                   # Admin operations
│   │
│   ├── tests/
│   │   ├── setup.ts             # Test bootstrap
│   │   ├── unit/                # Unit tests
│   │   ├── integration/         # Integration tests
│   │   └── fixtures/            # Test fixtures
│   │
│   └── (future domains)         # Auth, alt, etc.
│
├── prisma/
│   ├── schema.prisma            # Database schema
│   └── seed.ts                  # Seed script
│
├── docker/
│   └── (Docker support files)
│
├── .github/workflows/
│   └── ci.yml                   # CI/CD pipeline
│
├── Dockerfile
├── docker-compose.yml
├── .env.example
├── .gitignore
├── .eslintrc.json
├── .prettierrc
├── tsconfig.json
├── vitest.config.ts
├── package.json
└── ARCHITECTURE.md
```

### Folder Purpose Summary

| Folder          | Purpose                                        |
| --------------- | ---------------------------------------------- |
| `config/`       | Env loading, validation, swagger setup         |
| `controllers/`  | HTTP request handlers                          |
| `services/`     | Business logic layer                           |
| `repositories/` | Data access layer                              |
| `middlewares/`  | Express middleware stack                       |
| `routes/`       | Route definitions                              |
| `validators/`   | Zod validation schemas                         |
| `utils/`        | Core reusable utilities                        |
| `constants/`    | Application constants                          |
| `helpers/`      | Business-specific helpers                      |
| `shared/`       | Cross-cutting services (cache, redis, metrics) |
| `queues/`       | BullMQ queue definitions                       |
| `workers/`      | BullMQ job processors                          |
| `events/`       | Event bus                                      |
| `database/`     | Prisma client setup                            |
| `storage/`      | File storage abstraction                       |
| `emails/`       | Email templates                                |
| `telephony/`    | Twilio integration                             |
| `voice/`        | ElevenLabs/Cartesia integration                |
| `rag/`          | RAG pipeline                                   |
| `ai/`           | AI orchestration                               |
| `chat/`         | Chat logic                                     |
| `analytics/`    | Analytics service                              |
| `billing/`      | Stripe integration                             |
| `admin/`        | Admin operations                               |
| `tests/`        | Test files                                     |

---

## 3. Configuration System

### Architecture

- **dotenv** loads `.env` file
- **config/index.ts** exports a typed `config` object
- **config/env.validation.ts** uses Zod to validate env vars on startup
- Different `.env` files per environment (`.env.development`, `.env.production`)

### Why This Design

- **Type safety**: Full TypeScript types for all config values
- **Validation fails fast**: App crashes on missing critical vars
- **Centralized**: Single source of truth for app config
- **Secrets redaction**: Logger redacts sensitive fields

### Configuration Categories

1. **App**: Port, name, URLs, CORS
2. **Database**: Connection string, pool settings
3. **Redis**: Connection, key prefix
4. **JWT**: Secrets, token expiry
5. **AI Providers**: API keys, model names
6. **Voice**: ElevenLabs, Cartesia
7. **Telephony**: Twilio credentials
8. **Email**: SMTP and Resend
9. **Storage**: S3 credentials
10. **Billing**: Stripe keys
11. **Logging**: Level, formatting
12. **Features**: Feature flags
13. **Rate Limiting**: Window, max requests
14. **Analytics**: PostHog config

### Best Practices

- Default values for development only
- Production requires explicit values
- Feature flags disable non-MVP features
- Encryption key must be 32+ bytes

---

## 4. Express Initialization

### Flow

```
1. Import config, validate env
2. Create Express instance
3. Set trust proxy, etag
4. Apply helmet (security headers)
5. Apply cors (configured origins)
6. Apply compression (gzip)
7. Parse JSON/URL-encoded bodies (10mb limit)
8. Attach request ID
9. Attach request logger
10. Attach global rate limiter
11. Attach tenant resolver
12. Mount Swagger UI at /docs
13. Mount API routes at /api/v1
14. Attach 404 handler
15. Attach global error handler (last)
16. Start server on configured port
17. Register graceful shutdown handlers
```

### Why This Order

- Security middleware first (helmet, cors)
- Parsing middleware before logging
- Rate limiting before business logic
- Error handler must be last
- Routes between middleware and error handler

### Graceful Shutdown

- SIGTERM/SIGINT handlers
- Close HTTP server (stop accepting)
- Close BullMQ queues
- Disconnect Prisma
- 10s forced shutdown timeout

---

## 5. Middleware Architecture

### Execution Order

```
Request
  │
  ├── helmet              (Security headers)
  ├── cors                (Cross-origin)
  ├── compression         (Response compression)
  ├── json/urlencoded     (Body parsing)
  ├── requestId           (Request tracing)
  ├── requestLogger       (Structured logging)
  ├── rateLimiter         (Global rate limit)
  ├── tenantResolver      (Multi-tenant context)
  │
  ├── [Route Middleware]   (Auth, validation per route)
  │
  ├── Controller          (Business logic)
  │
  ├── Response            (Standardized response)
  │
  ├── 404 Handler         (If no route matched)
  └── Error Handler       (If error thrown)
```

### Middleware Responsibilities

| Middleware          | Purpose                                           |
| ------------------- | ------------------------------------------------- |
| **helmet**          | Sets 15+ security HTTP headers                    |
| **cors**            | Configures allowed origins, methods, headers      |
| **compression**     | Gzip compress responses                           |
| **json/urlencoded** | Parse request bodies                              |
| **requestId**       | Generates/reads request ID for tracing            |
| **requestLogger**   | Logs every request/response                       |
| **rateLimiter**     | Global rate limiting                              |
| **tenantResolver**  | Extracts tenant/user IDs from headers             |
| **validate**        | Zod schema validation (per-route)                 |
| **errorHandler**    | Catches all errors, returns standardized response |

---

## 6. Error Handling

### Error Class Hierarchy

```
BaseError
├── ValidationError      (400)
├── AuthenticationError  (401)
├── AuthorizationError   (403)
├── NotFoundError        (404)
├── ConflictError        (409)
├── BusinessError        (422)
├── DatabaseError        (500)
├── ProviderError        (502)
├── AIError              (502)
├── StorageError         (500)
└── RateLimitError       (429)
```

### Standard API Response Format

```json
// Success
{
  "success": true,
  "data": { ... },
  "meta": { "page": 1, "limit": 10, "total": 100 }
}

// Error
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [{ "path": "email", "message": "Invalid email" }]
  }
}
```

### Error Handling Strategy

1. **Operational errors** (known, expected): Return structured error with code
2. **Programmer errors** (bugs): Log full stack, return generic 500
3. **Provider errors** (external API failures): Return 502 with provider context
4. **Validation errors**: Return 400 with field-level details

### Global Error Handler

- Catches all errors from controllers/middleware
- Logs with appropriate level (warn for operational, error for unexpected)
- Returns consistent JSON error response
- Strips sensitive details in production

---

## 7. Logging

### Architecture

- **Pino** logger (fastest Node.js logger)
- Structured JSON logging
- Request-scoped logging with request ID
- Redacted sensitive fields (passwords, tokens, API keys)

### Log Levels

| Level   | Usage                                               |
| ------- | --------------------------------------------------- |
| `fatal` | Unrecoverable errors, process exit                  |
| `error` | Unexpected errors, provider failures                |
| `warn`  | Validation errors, rate limiting, deprecated routes |
| `info`  | Server start, request completion, job lifecycle     |
| `debug` | Prisma queries, detailed flow (dev only)            |
| `trace` | Full request/response bodies                        |

### Log Categories

| Category | Key Fields                         | Example                             |
| -------- | ---------------------------------- | ----------------------------------- |
| Request  | method, url, ip, duration          | `GET /api/v1/health 12ms`           |
| Database | query, duration                    | `SELECT * FROM users 3ms`           |
| Queue    | jobId, queue, status               | `Job abc123 completed (embedding)`  |
| AI       | model, tokens, latency             | `gpt-4o 512 tokens 1.2s`            |
| Security | action, userId, ip                 | `Failed login attempt from 1.2.3.4` |
| Audit    | entity, action, oldValue, newValue | `User.role updated: USER -> ADMIN`  |

---

## 8. API Response Standard

### Functions

```typescript
apiResponse.success(res, data, statusCode?, meta?)
apiResponse.error(res, statusCode, code, message, details?)
apiResponse.paginated(res, data, total, page, limit)
apiResponse.created(res, data)
apiResponse.noContent(res)
apiResponse.accepted(res, data?)
```

### Paginated Response

```json
{
  "success": true,
  "data": [...],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 87,
    "totalPages": 9,
    "hasNext": true,
    "hasPrevious": false
  }
}
```

### Streaming Response

Future streaming (for AI responses) will use SSE (Server-Sent Events):

```
GET /api/v1/chat/:id/stream
Headers: Accept: text/event-stream
```

---

## 9. Validation Strategy

### Zod Usage

| Scope        | Where                      | How                                      |
| ------------ | -------------------------- | ---------------------------------------- |
| Environment  | `config/env.validation.ts` | Zod schema on startup                    |
| Request Body | `middlewares/validate.ts`  | Middleware: `validate(schema, 'body')`   |
| Query Params | `middlewares/validate.ts`  | Middleware: `validate(schema, 'query')`  |
| Path Params  | `middlewares/validate.ts`  | Middleware: `validate(schema, 'params')` |
| Response     | Schemas (future)           | Type inference from Zod                  |

### Validation Middleware

```typescript
router.post('/alternates', validate(createAlternateSchema), alternateController.create);
```

### Reusable Schemas

- Common validators (email, UUID, pagination) in `validators/`
- DTO schemas co-located with feature modules
- Auto-generated OpenAPI types from Zod schemas

---

## 10. Utility Modules

| Module                   | Exports                                                     | Purpose                           |
| ------------------------ | ----------------------------------------------------------- | --------------------------------- |
| `id`                     | `generate()`, `isValid()`, `short()`                        | UUID v4 generation and validation |
| `date`                   | `now()`, `addDays()`, `addHours()`, `diffInMs()`, `toISO()` | Date manipulation                 |
| `encryption`             | `encrypt()`, `decrypt()`                                    | AES-256-GCM encryption            |
| `hash`                   | `sha256()`, `md5()`                                         | Hashing utilities                 |
| `pagination`             | `parse()`                                                   | Parse page/limit from query       |
| `retry`                  | `execute()`                                                 | Exponential backoff retry         |
| `logger`                 | logger                                                      | Pino logger instance              |
| `apiResponse`            | success, error, paginated, etc.                             | Response helpers                  |
| `BaseError` + subclasses | Error classes                                               | Typed error hierarchy             |

---

## 11. Queue System

### Queue Definitions

| Queue       | Jobs                           | Consumer         |
| ----------- | ------------------------------ | ---------------- |
| `embedding` | Generate embeddings for chunks | Embedding worker |
| `training`  | Process training sources       | Training worker  |
| `email`     | Send outgoing emails           | Email worker     |
| `voice`     | Generate voice synthesis       | Voice worker     |
| `analytics` | Record analytics events        | Analytics worker |
| `cleanup`   | Periodic cleanup tasks         | Cleanup worker   |
| `retry`     | Retry failed jobs              | Retry worker     |

### Job Configuration

- **Attempts**: 3 retries per job
- **Backoff**: Exponential (2s, 4s, 8s)
- **TTL**: 1h for completed, 24h for failed
- **Concurrency**: Configurable via `QUEUE_CONCURRENCY`

### Why BullMQ

- Redis-based (shared infrastructure)
- Job scheduling and delays
- Rate limiting per queue
- Job progress tracking
- Event hooks (completed, failed, progress)

---

## 12. Event Architecture

### Naming Convention

```
{entity}.{action}
```

### Event Catalog

| Event                  | Payload                  | Trigger          | Consumers                 |
| ---------------------- | ------------------------ | ---------------- | ------------------------- |
| `user.created`         | { userId, email }        | Registration     | Analytics, Billing, Email |
| `alternate.created`    | { alternateId, userId }  | Create twin      | Training                  |
| `alternate.updated`    | { alternateId, changes } | Update twin      | Re-indexing               |
| `training.started`     | { sourceId, type }       | Source added     | Embedding queue           |
| `training.completed`   | { alternateId }          | All sources done | Notification              |
| `conversation.started` | { conversationId }       | New chat         | Analytics                 |
| `message.sent`         | { messageId, tokens }    | AI response      | Usage tracking            |
| `email.received`       | { threadId, from }       | Inbound email    | Email agent               |
| `subscription.updated` | { userId, tier }         | Plan change      | Feature flags             |
| `apikey.created`       | { keyId, userId }        | API key created  | Audit                     |

### Implementation

- Node.js `EventEmitter` for in-process events
- Future: Redis pub/sub for cross-service events
- All events logged for debugging

---

## 13. Redis Strategy

### Usage Categories

| Category          | Pattern                          | TTL    | Purpose                            |
| ----------------- | -------------------------------- | ------ | ---------------------------------- |
| **Cache**         | `altme:cache:{key}`              | 1h-24h | API response caching               |
| **Sessions**      | `altme:sess:{sid}`               | 7d     | JWT refresh token store            |
| **Rate Limiting** | `altme:ratelimit:{key}:{window}` | Window | Distributed rate limiting          |
| **Queue Backend** | `bull:{queue}:*`                 | Var    | BullMQ job storage                 |
| **AI Context**    | `altme:ctx:{convId}`             | 1h     | Temporary conversation context     |
| **Locks**         | `altme:lock:{resource}`          | 30s    | Distributed locks for critical ops |
| **Idempotency**   | `altme:idemp:{key}`              | 24h    | Idempotency keys                   |

### Cache Strategy

- Cache-first for read-heavy endpoints
- Cache invalidation on writes
- Pattern-based cache clearing (e.g., `altme:cache:alternate:*`)
- Skip cache for authenticated/tenant-specific data where appropriate

### Connection Management

- Lazy connection (connect on first use)
- Retry strategy (100ms -> 300ms max, 3 retries)
- Graceful degradation (cache miss, not crash)

---

## 14. Security Foundation

### Layers

| Layer                | Implementation                  | Protection                       |
| -------------------- | ------------------------------- | -------------------------------- |
| **HTTP Headers**     | Helmet (15+ headers)            | XSS, clickjacking, MIME sniffing |
| **CORS**             | Configured origins              | Unauthorized cross-origin access |
| **Rate Limiting**    | express-rate-limit + Redis      | Brute force, DDoS                |
| **Input Validation** | Zod on all inputs               | Injection, malformed data        |
| **Request Size**     | 10mb body limit                 | Payload bombs                    |
| **Secrets**          | .env (never committed)          | Credential exposure              |
| **Encryption**       | AES-256-GCM                     | Sensitive data at rest           |
| **Hashing**          | SHA-256                         | API key storage                  |
| **SQL Injection**    | Prisma parameterized queries    | Database injection               |
| **XSS**              | Helmet + input sanitization     | Cross-site scripting             |
| **CSRF**             | SameSite cookies + Origin check | Cross-site requests              |
| **Audit Logging**    | AuditLog table                  | Non-repudiation                  |

### API Key Security

- Store SHA-256 hash of key
- Return full key only on creation
- Prefix-based identification (`sk_` prefix)
- Key revocation support with expiry

### Multi-tenancy

- Row-level isolation via `userId` and `alternateId` foreign keys
- Tenant context from `x-tenant-id` header
- RBAC at service layer (role-based access)

---

## 15. Docker

### Dockerfile (Multi-stage)

```
Stage 1: builder
  - Node 22 Alpine
  - Install all deps
  - Generate Prisma client
  - Build TypeScript

Stage 2: production
  - Node 22 Alpine (smaller)
  - Copy only dist + production node_modules
  - Non-root user (appuser)
  - tini init system (PID 1)
  - Health check endpoint
```

### Docker Compose Services

| Service    | Image          | Ports | Depends | Healthcheck      |
| ---------- | -------------- | ----- | ------- | ---------------- |
| **api**    | Custom         | 4000  | redis   | /health/liveness |
| **worker** | Custom         | -     | redis   | -                |
| **redis**  | redis:7-alpine | 6379  | -       | redis-cli ping   |

### Networks

- `altme-network`: Bridge network for all services

### Volumes

- `redis-data`: Persist Redis data

### Resource Limits

| Service | CPU      | Memory |
| ------- | -------- | ------ |
| api     | 1 core   | 1GB    |
| worker  | 2 cores  | 2GB    |
| redis   | 0.5 core | 256MB  |

---

## 16. CI/CD

### Pipeline Stages

```
Lint & Type Check
  ↓
Test (with Postgres + Redis services)
  ↓
Build
  ↓
Docker Build & Push (main branch only)
  ↓
Deploy to Railway (main branch only)
```

### GitHub Actions Workflow

| Stage  | Trigger      | Actions                  |
| ------ | ------------ | ------------------------ |
| Lint   | All pushes   | `eslint`, `tsc --noEmit` |
| Test   | All pushes   | `vitest run --coverage`  |
| Build  | All pushes   | `tsc`                    |
| Docker | Push to main | Build, tag, push to GHCR |
| Deploy | Push to main | Webhook to Railway       |

### Service Containers for Tests

- PostgreSQL with pgvector extension
- Redis 7 Alpine
- Both with health checks and proper timeouts

### Quality Gates

- All lint checks pass
- All tests pass
- Coverage > 80%
- Build successful
- TypeScript strict mode

---

## 17. Monitoring

### Health Endpoints

| Endpoint                | Purpose          | Expected                 |
| ----------------------- | ---------------- | ------------------------ |
| `GET /health`           | Overall status   | 200 + `{ status: "ok" }` |
| `GET /health/liveness`  | Container health | 200                      |
| `GET /health/readiness` | Dependency check | 200 if DB connected      |

### Metrics (Prometheus-ready)

- Request rate, duration, errors
- Queue sizes and processing times
- AI provider latency and token usage
- Database query performance
- Memory and CPU usage

### Logging (Structured JSON)

- All logs in JSON format
- Request-scoped with `requestId`
- Compatible with Logstash/Datadog/Axiom

### Future Monitoring Stack

- Prometheus (metrics collection)
- Grafana (dashboards)
- Sentry (error tracking)
- Datadog/Axiom (log aggregation)

---

## 18. Coding Standards

### Naming Conventions

| Category   | Convention                     | Example           |
| ---------- | ------------------------------ | ----------------- |
| Files      | kebab-case                     | `user.service.ts` |
| Classes    | PascalCase                     | `UserService`     |
| Functions  | camelCase                      | `createUser()`    |
| Variables  | camelCase                      | `userData`        |
| Constants  | UPPER_SNAKE                    | `MAX_RETRIES`     |
| Enums      | PascalCase                     | `UserRole`        |
| Interfaces | PascalCase (I prefix optional) | `IUserRepository` |
| Types      | PascalCase                     | `Nullable<T>`     |
| DTOs       | PascalCase + DTO               | `CreateUserDTO`   |

### File Organization

- One class per file (except barrel exports)
- Group by domain, not by type
- Barrel `index.ts` files for clean imports
- Tests co-located with source (`*.test.ts`)

### Controller Pattern

```typescript
export class UserController {
  constructor(private readonly userService: UserService) {}

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.userService.create(req.body);
      apiResponse.created(res, result);
    } catch (err) {
      next(err);
    }
  };
}
```

### Service Pattern

```typescript
export class UserService {
  constructor(private readonly userRepo: UserRepository) {}

  async create(data: CreateUserDTO): Promise<User> {
    // 1. Validate business rules
    // 2. Check for conflicts
    // 3. Transform data
    // 4. Call repository
    // 5. Emit events
    // 6. Return result
  }
}
```

### Repository Pattern

```typescript
export class UserRepository implements IBaseRepository<User> {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async create(data: Prisma.UserCreateInput): Promise<User> {
    return this.prisma.user.create({ data });
  }
}
```

### Dependency Injection

- Manual DI via constructor injection
- Services receive repositories in constructor
- Controllers receive services in constructor
- No DI framework to keep it simple

---

## 19. Development Workflow

### Local Development

```bash
# 1. Install dependencies
npm install

# 2. Copy environment
cp .env.example .env

# 3. Start infrastructure (Redis)
docker compose up -d redis

# 4. Generate Prisma client
npm run prisma:generate

# 5. Run migrations
npm run prisma:migrate

# 6. Start dev server (auto-reload)
npm run dev
```

### Test Workflow

```bash
# Unit tests (fast)
npm run test:unit

# Integration tests (requires DB + Redis)
npm run test:integration

# All tests with coverage
npm run test:coverage
```

### Git Workflow

- Feature branches from `develop`
- PR to `develop` for review
- `main` is production-ready
- Semantic commit messages

---

## 20. Pre-Phase 1 Recommendations

### Before Implementing Auth

1. **Deploy infrastructure**: Set up Neon PostgreSQL, Upstash Redis
2. **Configure environment**: Fill `.env` with real values
3. **Run Prisma migration**: `npm run prisma:migrate`
4. **Verify health endpoint**: `curl http://localhost:4000/api/v1/health`
5. **Write integration test**: Test app initialization
6. **Set up monitoring**: Deploy Grafana + Prometheus (or use managed)
7. **Set up error tracking**: Configure Sentry
8. **Set up CI/CD**: Push repo, verify GitHub Actions runs

### Architecture Decisions Summary

| Decision   | Choice             | Rationale                                      |
| ---------- | ------------------ | ---------------------------------------------- |
| Framework  | Express.js         | Mature, minimal, enormous ecosystem            |
| Language   | TypeScript         | Type safety, scalability, developer experience |
| ORM        | Prisma             | Type-safe, migrations, great DX                |
| Database   | PostgreSQL (Neon)  | Serverless, pgvector support, reliable         |
| Cache      | Redis (Upstash)    | Serverless Redis, BullMQ compatible            |
| Queue      | BullMQ             | Redis-based, robust, scalable                  |
| Validation | Zod                | TypeScript-first, composable, fast             |
| Logging    | Pino               | Fastest structured logger                      |
| Auth       | JWT (Phase 1)      | Stateless, scalable                            |
| Storage    | S3-compatible (R2) | Cheap, global, S3 API                          |
| Container  | Docker             | Portable, consistent environments              |
| Hosting    | Railway            | Developer experience, scalable                 |

### Risk Mitigation

| Risk                   | Mitigation                                  |
| ---------------------- | ------------------------------------------- |
| AI provider outage     | Multi-provider support with fallback        |
| Rate limiting at scale | Distributed rate limiting via Redis         |
| Database bottlenecks   | Connection pooling, indexing, read replicas |
| Queue backpressure     | Monitoring, alerting, auto-scaling          |
| Secrets exposure       | Env vars only, .env in gitignore, audit     |
| Cost overruns          | Usage tracking, budget alerts, tier limits  |

---

## Quick Start

```bash
cd backend
cp .env.example .env
npm install
npm run prisma:generate
npm run prisma:migrate
npm run dev
```

Server starts at `http://localhost:4000`
API docs at `http://localhost:4000/docs`

---

## Implemented in Phase 1 (Auth & User Management)

The following items were implemented in the `backend` codebase as part of Phase 1:

- Prisma schema and client
  - Models: `User`, `Session`, `RefreshToken`, `VerificationToken`, `PasswordResetToken`, `OAuthAccount`, `AuditLog`, and supporting relations.
  - Resolved schema issues and generated `@prisma/client`.

- Authentication & User Management module (`src/auth`)
  - Services (`auth.service.ts`): registration, email verification, password login, refresh token rotation, logout, forgot/reset password, OAuth user handling, session creation.
  - Controllers (`auth.controller.ts`): REST endpoints for register/login/refresh/logout/forgot/reset/verify/resend.
  - Repositories: `user`, `session`, `token`, `oauth`, `audit` repositories under `src/auth/repositories`.
  - Validators: Zod schemas for auth-related requests.
  - Utilities: JWT helpers, password hashing, token hashing, mail templates, and mailer wrapper.
  - Middleware: bearer token `authenticate` that sets `req.authUser`.

- Routes & integration
  - `auth` routes wired into main API router and `app.ts`.
  - Session and user endpoints implemented for session management and profile operations.

- Security & operational features
  - Access tokens (HS512) and refresh tokens with rotation and hashed storage.
  - Audit logging for security events (login attempts, password resets, token rotations, OAuth events).
  - Email templates for verification, password reset, and security alerts.

- Developer experience & typing fixes
  - TypeScript errors across auth, middleware, and utils resolved so the backend type-checks.
  - Added `@types/jsonwebtoken` and adjusted JWT util typing to match runtime usage.
  - Where necessary, Prisma JSON inputs were cast to satisfy client types; these are flagged for follow-up typing improvements.

### Remaining (short-term)

- Implement OAuth provider handlers (Google, GitHub) with secure redirect/callback flows.
- Harden service logic and edge-case behavior (strict typing, null/undefined consistency for `tenantId`).
- Add unit and integration tests for auth flows and token rotation.
- Replace `any`/casts for Prisma JSON fields with proper typed inputs.

If you want, I can (pick one):

- Run the backend test suite (if available) and report failures.
- Implement OAuth provider routes and a quick manual test flow.
- Harden a few service edge-cases now and add tests.

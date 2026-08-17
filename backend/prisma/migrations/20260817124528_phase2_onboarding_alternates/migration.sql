-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "AlternateStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'PAUSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AlternateVisibility" AS ENUM ('PUBLIC', 'UNLISTED', 'PRIVATE');

-- CreateEnum
CREATE TYPE "OnboardingStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "OnboardingStep" AS ENUM ('PERSONAL', 'SOURCES', 'PERSONA', 'VOICE', 'AI_PROVIDER', 'PUBLISH');

-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('FILE', 'URL', 'LINKEDIN', 'YOUTUBE', 'OTHER');

-- CreateEnum
CREATE TYPE "SourceStatus" AS ENUM ('PENDING', 'PROCESSING', 'READY', 'FAILED', 'DELETED');

-- CreateEnum
CREATE TYPE "MessageRole" AS ENUM ('USER', 'ASSISTANT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "ConversationChannel" AS ENUM ('CHAT', 'EMAIL', 'VOICE', 'TELEPHONY', 'API', 'WIDGET');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'PAST_DUE', 'CANCELED', 'INCOMPLETE', 'EXPIRED', 'TRIALING');

-- CreateEnum
CREATE TYPE "SubscriptionTier" AS ENUM ('FREE', 'PRO', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "ApiKeyType" AS ENUM ('PUBLIC', 'PRIVATE');

-- CreateEnum
CREATE TYPE "TrainingStatus" AS ENUM ('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "VoiceProvider" AS ENUM ('ELEVENLABS', 'CARTESIA', 'CUSTOM');

-- CreateEnum
CREATE TYPE "VoiceType" AS ENUM ('PROVIDER_VOICE', 'CLONED_VOICE');

-- CreateEnum
CREATE TYPE "VoiceStatus" AS ENUM ('PENDING', 'PROCESSING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "AIProvider" AS ENUM ('OPENAI', 'ANTHROPIC');

-- CreateEnum
CREATE TYPE "EmailDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- CreateEnum
CREATE TYPE "EmailStatus" AS ENUM ('DRAFT', 'SENT', 'FAILED', 'DELIVERED', 'OPENED', 'CLICKED');

-- CreateEnum
CREATE TYPE "CallStatus" AS ENUM ('INITIATED', 'RINGING', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'NO_ANSWER', 'BUSY');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('ALTERNATE_CREATED', 'ALTERNATE_UPDATED', 'ALTERNATE_DELETED', 'ONBOARDING_STARTED', 'ONBOARDING_COMPLETED', 'SOURCE_ADDED', 'SOURCE_DELETED', 'PERSONA_UPDATED', 'VOICE_SELECTED', 'VOICE_CONSENT_GIVEN', 'AI_PROVIDER_ADDED', 'AI_PROVIDER_REMOVED', 'ALTERNATE_PUBLISHED');

-- CreateEnum
CREATE TYPE "OAuthProvider" AS ENUM ('GOOGLE', 'GITHUB');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "tenantId" UUID,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "name" TEXT,
    "avatarUrl" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "passwordHash" TEXT,
    "isMfaEnabled" BOOLEAN NOT NULL DEFAULT false,
    "mfaSecret" TEXT,
    "bio" TEXT,
    "timezone" TEXT DEFAULT 'UTC',
    "language" TEXT DEFAULT 'en',
    "theme" TEXT DEFAULT 'light',
    "lastLoginAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenants" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "domain" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_preferences" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "language" TEXT NOT NULL DEFAULT 'en',
    "theme" TEXT NOT NULL DEFAULT 'light',
    "notificationPreferences" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tenantId" UUID,
    "device" TEXT,
    "browser" TEXT,
    "os" TEXT,
    "ipAddress" TEXT,
    "country" TEXT,
    "city" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "rotatedFromId" UUID,
    "replacedByToken" TEXT,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "fingerprint" TEXT,
    "lastUsedAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_tokens" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verification_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "oauth_accounts" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "provider" "OAuthProvider" NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "scope" TEXT,
    "expiresAt" TIMESTAMP(3),
    "tokenType" TEXT,
    "idToken" TEXT,
    "profile" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "oauth_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alternates" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "username" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "title" TEXT,
    "bio" TEXT,
    "avatarUrl" TEXT,
    "visibility" "AlternateVisibility" NOT NULL DEFAULT 'PRIVATE',
    "status" "AlternateStatus" NOT NULL DEFAULT 'DRAFT',
    "personaPrompt" TEXT,
    "modelId" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "alternates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "onboardings" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "alternateId" UUID NOT NULL,
    "currentStep" "OnboardingStep" NOT NULL,
    "completedSteps" "OnboardingStep"[],
    "status" "OnboardingStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "onboardings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "personas" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "alternateId" UUID NOT NULL,
    "tone" TEXT,
    "writingStyle" TEXT,
    "personality" TEXT,
    "instructions" TEXT,
    "boundaries" TEXT,
    "refusalBehavior" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "personas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_sources" (
    "id" UUID NOT NULL,
    "alternateId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" "SourceType" NOT NULL,
    "origin" TEXT,
    "name" TEXT NOT NULL,
    "url" TEXT,
    "fileName" TEXT,
    "mimeType" TEXT,
    "fileSize" INTEGER,
    "status" "SourceStatus" NOT NULL DEFAULT 'PENDING',
    "wordCount" INTEGER,
    "errorMessage" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "training_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_chunks" (
    "id" UUID NOT NULL,
    "alternateId" UUID NOT NULL,
    "sourceId" UUID NOT NULL,
    "index" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "metadata" JSONB,
    "tokenCount" INTEGER,
    "embeddingId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_jobs" (
    "id" UUID NOT NULL,
    "alternateId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "status" "TrainingStatus" NOT NULL DEFAULT 'QUEUED',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "totalItems" INTEGER NOT NULL DEFAULT 0,
    "processedItems" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "training_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "voice_profiles" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "alternateId" UUID NOT NULL,
    "provider" "VoiceProvider" NOT NULL,
    "voiceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "VoiceType" NOT NULL,
    "consentGiven" BOOLEAN NOT NULL DEFAULT false,
    "consentTimestamp" TIMESTAMP(3),
    "status" "VoiceStatus" NOT NULL DEFAULT 'PENDING',
    "settings" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "voice_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_provider_configs" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "alternateId" UUID NOT NULL,
    "provider" "AIProvider" NOT NULL,
    "encryptedApiKey" TEXT NOT NULL,
    "keyLabel" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "defaultModel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastValidatedAt" TIMESTAMP(3),

    CONSTRAINT "ai_provider_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversations" (
    "id" UUID NOT NULL,
    "alternateId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "channel" "ConversationChannel" NOT NULL DEFAULT 'CHAT',
    "title" TEXT,
    "sessionId" TEXT,
    "metadata" JSONB,
    "messageCount" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "satisfaction" INTEGER,
    "feedback" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" UUID NOT NULL,
    "conversationId" UUID NOT NULL,
    "role" "MessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "tokensUsed" INTEGER,
    "modelUsed" TEXT,
    "latencyMs" INTEGER,
    "metadata" JSONB,
    "sources" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_threads" (
    "id" UUID NOT NULL,
    "alternateId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "subject" TEXT NOT NULL,
    "fromEmail" TEXT NOT NULL,
    "toEmail" TEXT NOT NULL,
    "threadId" TEXT,
    "direction" "EmailDirection" NOT NULL DEFAULT 'INBOUND',
    "status" "EmailStatus" NOT NULL DEFAULT 'SENT',
    "messageCount" INTEGER NOT NULL DEFAULT 0,
    "lastActivityAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_threads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_messages" (
    "id" UUID NOT NULL,
    "threadId" UUID NOT NULL,
    "messageId" TEXT,
    "fromEmail" TEXT NOT NULL,
    "toEmail" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "bodyHtml" TEXT,
    "status" "EmailStatus" NOT NULL DEFAULT 'SENT',
    "metadata" JSONB,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "call_records" (
    "id" UUID NOT NULL,
    "alternateId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "twilioCallSid" TEXT,
    "fromNumber" TEXT NOT NULL,
    "toNumber" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "status" "CallStatus" NOT NULL DEFAULT 'INITIATED',
    "duration" INTEGER,
    "cost" DECIMAL(10,4),
    "recordingUrl" TEXT,
    "transcription" TEXT,
    "metadata" JSONB,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "call_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytic_events" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "event" TEXT NOT NULL,
    "properties" JSONB,
    "sessionId" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytic_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tenantId" UUID,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "oldValue" JSONB,
    "newValue" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_keys" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "keyPrefix" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "type" "ApiKeyType" NOT NULL DEFAULT 'PRIVATE',
    "scopes" JSONB,
    "lastUsedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "isRevoked" BOOLEAN NOT NULL DEFAULT false,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "tier" "SubscriptionTier" NOT NULL DEFAULT 'FREE',
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "currentPeriodStart" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "trialEndsAt" TIMESTAMP(3),
    "canceledAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usage_records" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "subscriptionId" UUID,
    "feature" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit" TEXT NOT NULL DEFAULT 'count',
    "metadata" JSONB,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usage_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_username_idx" ON "users"("username");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "users_tenantId_idx" ON "users"("tenantId");

-- CreateIndex
CREATE INDEX "users_deletedAt_idx" ON "users"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "tenants_domain_key" ON "tenants"("domain");

-- CreateIndex
CREATE INDEX "tenants_slug_idx" ON "tenants"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "user_preferences_userId_key" ON "user_preferences"("userId");

-- CreateIndex
CREATE INDEX "user_preferences_timezone_idx" ON "user_preferences"("timezone");

-- CreateIndex
CREATE INDEX "user_preferences_language_idx" ON "user_preferences"("language");

-- CreateIndex
CREATE INDEX "user_preferences_theme_idx" ON "user_preferences"("theme");

-- CreateIndex
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");

-- CreateIndex
CREATE INDEX "sessions_tenantId_idx" ON "sessions"("tenantId");

-- CreateIndex
CREATE INDEX "sessions_isActive_idx" ON "sessions"("isActive");

-- CreateIndex
CREATE INDEX "sessions_expiresAt_idx" ON "sessions"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_tokenHash_key" ON "refresh_tokens"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_rotatedFromId_key" ON "refresh_tokens"("rotatedFromId");

-- CreateIndex
CREATE INDEX "refresh_tokens_userId_idx" ON "refresh_tokens"("userId");

-- CreateIndex
CREATE INDEX "refresh_tokens_sessionId_idx" ON "refresh_tokens"("sessionId");

-- CreateIndex
CREATE INDEX "refresh_tokens_expiresAt_idx" ON "refresh_tokens"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_tokenHash_key" ON "verification_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "verification_tokens_userId_idx" ON "verification_tokens"("userId");

-- CreateIndex
CREATE INDEX "verification_tokens_expiresAt_idx" ON "verification_tokens"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_tokenHash_key" ON "password_reset_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "password_reset_tokens_userId_idx" ON "password_reset_tokens"("userId");

-- CreateIndex
CREATE INDEX "password_reset_tokens_expiresAt_idx" ON "password_reset_tokens"("expiresAt");

-- CreateIndex
CREATE INDEX "oauth_accounts_userId_idx" ON "oauth_accounts"("userId");

-- CreateIndex
CREATE INDEX "oauth_accounts_provider_idx" ON "oauth_accounts"("provider");

-- CreateIndex
CREATE UNIQUE INDEX "oauth_accounts_provider_providerAccountId_key" ON "oauth_accounts"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "alternates_username_key" ON "alternates"("username");

-- CreateIndex
CREATE INDEX "alternates_userId_idx" ON "alternates"("userId");

-- CreateIndex
CREATE INDEX "alternates_username_idx" ON "alternates"("username");

-- CreateIndex
CREATE INDEX "alternates_status_idx" ON "alternates"("status");

-- CreateIndex
CREATE INDEX "alternates_visibility_idx" ON "alternates"("visibility");

-- CreateIndex
CREATE INDEX "alternates_deletedAt_idx" ON "alternates"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "onboardings_alternateId_key" ON "onboardings"("alternateId");

-- CreateIndex
CREATE INDEX "onboardings_userId_idx" ON "onboardings"("userId");

-- CreateIndex
CREATE INDEX "onboardings_alternateId_idx" ON "onboardings"("alternateId");

-- CreateIndex
CREATE INDEX "onboardings_status_idx" ON "onboardings"("status");

-- CreateIndex
CREATE UNIQUE INDEX "personas_alternateId_key" ON "personas"("alternateId");

-- CreateIndex
CREATE INDEX "personas_userId_idx" ON "personas"("userId");

-- CreateIndex
CREATE INDEX "personas_alternateId_idx" ON "personas"("alternateId");

-- CreateIndex
CREATE INDEX "training_sources_alternateId_idx" ON "training_sources"("alternateId");

-- CreateIndex
CREATE INDEX "training_sources_userId_idx" ON "training_sources"("userId");

-- CreateIndex
CREATE INDEX "training_sources_type_idx" ON "training_sources"("type");

-- CreateIndex
CREATE INDEX "training_sources_status_idx" ON "training_sources"("status");

-- CreateIndex
CREATE INDEX "content_chunks_alternateId_idx" ON "content_chunks"("alternateId");

-- CreateIndex
CREATE INDEX "content_chunks_sourceId_idx" ON "content_chunks"("sourceId");

-- CreateIndex
CREATE INDEX "training_jobs_alternateId_idx" ON "training_jobs"("alternateId");

-- CreateIndex
CREATE INDEX "training_jobs_userId_idx" ON "training_jobs"("userId");

-- CreateIndex
CREATE INDEX "training_jobs_status_idx" ON "training_jobs"("status");

-- CreateIndex
CREATE INDEX "voice_profiles_userId_idx" ON "voice_profiles"("userId");

-- CreateIndex
CREATE INDEX "voice_profiles_alternateId_idx" ON "voice_profiles"("alternateId");

-- CreateIndex
CREATE UNIQUE INDEX "voice_profiles_alternateId_key" ON "voice_profiles"("alternateId");

-- CreateIndex
CREATE UNIQUE INDEX "ai_provider_configs_alternateId_key" ON "ai_provider_configs"("alternateId");

-- CreateIndex
CREATE INDEX "ai_provider_configs_userId_idx" ON "ai_provider_configs"("userId");

-- CreateIndex
CREATE INDEX "ai_provider_configs_alternateId_idx" ON "ai_provider_configs"("alternateId");

-- CreateIndex
CREATE INDEX "ai_provider_configs_provider_idx" ON "ai_provider_configs"("provider");

-- CreateIndex
CREATE INDEX "conversations_alternateId_idx" ON "conversations"("alternateId");

-- CreateIndex
CREATE INDEX "conversations_userId_idx" ON "conversations"("userId");

-- CreateIndex
CREATE INDEX "conversations_channel_idx" ON "conversations"("channel");

-- CreateIndex
CREATE INDEX "conversations_createdAt_idx" ON "conversations"("createdAt");

-- CreateIndex
CREATE INDEX "messages_conversationId_idx" ON "messages"("conversationId");

-- CreateIndex
CREATE INDEX "messages_createdAt_idx" ON "messages"("createdAt");

-- CreateIndex
CREATE INDEX "email_threads_alternateId_idx" ON "email_threads"("alternateId");

-- CreateIndex
CREATE INDEX "email_threads_userId_idx" ON "email_threads"("userId");

-- CreateIndex
CREATE INDEX "email_threads_threadId_idx" ON "email_threads"("threadId");

-- CreateIndex
CREATE INDEX "email_messages_threadId_idx" ON "email_messages"("threadId");

-- CreateIndex
CREATE UNIQUE INDEX "call_records_twilioCallSid_key" ON "call_records"("twilioCallSid");

-- CreateIndex
CREATE INDEX "call_records_alternateId_idx" ON "call_records"("alternateId");

-- CreateIndex
CREATE INDEX "call_records_userId_idx" ON "call_records"("userId");

-- CreateIndex
CREATE INDEX "call_records_status_idx" ON "call_records"("status");

-- CreateIndex
CREATE INDEX "call_records_startedAt_idx" ON "call_records"("startedAt");

-- CreateIndex
CREATE INDEX "analytic_events_userId_idx" ON "analytic_events"("userId");

-- CreateIndex
CREATE INDEX "analytic_events_event_idx" ON "analytic_events"("event");

-- CreateIndex
CREATE INDEX "analytic_events_timestamp_idx" ON "analytic_events"("timestamp");

-- CreateIndex
CREATE INDEX "audit_logs_userId_idx" ON "audit_logs"("userId");

-- CreateIndex
CREATE INDEX "audit_logs_tenantId_idx" ON "audit_logs"("tenantId");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_entity_idx" ON "audit_logs"("entity");

-- CreateIndex
CREATE INDEX "audit_logs_entityId_idx" ON "audit_logs"("entityId");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_keyHash_key" ON "api_keys"("keyHash");

-- CreateIndex
CREATE INDEX "api_keys_userId_idx" ON "api_keys"("userId");

-- CreateIndex
CREATE INDEX "api_keys_keyHash_idx" ON "api_keys"("keyHash");

-- CreateIndex
CREATE INDEX "api_keys_isRevoked_idx" ON "api_keys"("isRevoked");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_stripeCustomerId_key" ON "subscriptions"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_stripeSubscriptionId_key" ON "subscriptions"("stripeSubscriptionId");

-- CreateIndex
CREATE INDEX "subscriptions_userId_idx" ON "subscriptions"("userId");

-- CreateIndex
CREATE INDEX "subscriptions_status_idx" ON "subscriptions"("status");

-- CreateIndex
CREATE INDEX "subscriptions_tier_idx" ON "subscriptions"("tier");

-- CreateIndex
CREATE INDEX "usage_records_userId_idx" ON "usage_records"("userId");

-- CreateIndex
CREATE INDEX "usage_records_feature_idx" ON "usage_records"("feature");

-- CreateIndex
CREATE INDEX "usage_records_recordedAt_idx" ON "usage_records"("recordedAt");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_rotatedFromId_fkey" FOREIGN KEY ("rotatedFromId") REFERENCES "refresh_tokens"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_tokens" ADD CONSTRAINT "verification_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oauth_accounts" ADD CONSTRAINT "oauth_accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alternates" ADD CONSTRAINT "alternates_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onboardings" ADD CONSTRAINT "onboardings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onboardings" ADD CONSTRAINT "onboardings_alternateId_fkey" FOREIGN KEY ("alternateId") REFERENCES "alternates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personas" ADD CONSTRAINT "personas_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personas" ADD CONSTRAINT "personas_alternateId_fkey" FOREIGN KEY ("alternateId") REFERENCES "alternates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_sources" ADD CONSTRAINT "training_sources_alternateId_fkey" FOREIGN KEY ("alternateId") REFERENCES "alternates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_sources" ADD CONSTRAINT "training_sources_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_chunks" ADD CONSTRAINT "content_chunks_alternateId_fkey" FOREIGN KEY ("alternateId") REFERENCES "alternates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_chunks" ADD CONSTRAINT "content_chunks_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "training_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_jobs" ADD CONSTRAINT "training_jobs_alternateId_fkey" FOREIGN KEY ("alternateId") REFERENCES "alternates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_jobs" ADD CONSTRAINT "training_jobs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voice_profiles" ADD CONSTRAINT "voice_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voice_profiles" ADD CONSTRAINT "voice_profiles_alternateId_fkey" FOREIGN KEY ("alternateId") REFERENCES "alternates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_provider_configs" ADD CONSTRAINT "ai_provider_configs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_provider_configs" ADD CONSTRAINT "ai_provider_configs_alternateId_fkey" FOREIGN KEY ("alternateId") REFERENCES "alternates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_alternateId_fkey" FOREIGN KEY ("alternateId") REFERENCES "alternates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_threads" ADD CONSTRAINT "email_threads_alternateId_fkey" FOREIGN KEY ("alternateId") REFERENCES "alternates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_threads" ADD CONSTRAINT "email_threads_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_messages" ADD CONSTRAINT "email_messages_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "email_threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_records" ADD CONSTRAINT "call_records_alternateId_fkey" FOREIGN KEY ("alternateId") REFERENCES "alternates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_records" ADD CONSTRAINT "call_records_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytic_events" ADD CONSTRAINT "analytic_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_records" ADD CONSTRAINT "usage_records_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_records" ADD CONSTRAINT "usage_records_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

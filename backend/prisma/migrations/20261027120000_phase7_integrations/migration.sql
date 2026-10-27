CREATE TABLE "integration_providers" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT,
    "homepageUrl" TEXT,
    "color" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "integration_providers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "integration_connections" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "alternateId" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT,
    "status" TEXT NOT NULL,
    "grantedScopes" TEXT NOT NULL,
    "encryptedCredentials" TEXT NOT NULL,
    "credentialVersion" INTEGER NOT NULL DEFAULT 1,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "lastConnectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),
    "lastHealthCheckAt" TIMESTAMP(3),
    "lastErrorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "disconnectedAt" TIMESTAMP(3),

    CONSTRAINT "integration_connections_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "integration_executions" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "alternateId" UUID NOT NULL,
    "connectionId" UUID NOT NULL,
    "agentRunId" UUID,
    "toolExecutionId" UUID,
    "provider" TEXT NOT NULL,
    "capability" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "idempotencyKey" TEXT,
    "requestMetadata" JSONB NOT NULL,
    "resultMetadata" JSONB NOT NULL,
    "errorCode" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "integration_executions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "oauth_states" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "alternateId" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "codeVerifier" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "oauth_states_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "integration_providers_name_key" ON "integration_providers"("name");
CREATE UNIQUE INDEX "integration_connections_userId_alternateId_provider_key" ON "integration_connections"("userId", "alternateId", "provider");
CREATE INDEX "integration_connections_userId_idx" ON "integration_connections"("userId");
CREATE INDEX "integration_connections_alternateId_idx" ON "integration_connections"("alternateId");
CREATE INDEX "integration_connections_provider_idx" ON "integration_connections"("provider");
CREATE INDEX "integration_connections_status_idx" ON "integration_connections"("status");
CREATE INDEX "integration_executions_userId_idx" ON "integration_executions"("userId");
CREATE INDEX "integration_executions_alternateId_idx" ON "integration_executions"("alternateId");
CREATE INDEX "integration_executions_connectionId_idx" ON "integration_executions"("connectionId");
CREATE INDEX "integration_executions_agentRunId_idx" ON "integration_executions"("agentRunId");
CREATE INDEX "integration_executions_toolExecutionId_idx" ON "integration_executions"("toolExecutionId");
CREATE INDEX "integration_executions_status_idx" ON "integration_executions"("status");
CREATE UNIQUE INDEX "oauth_states_state_key" ON "oauth_states"("state");
CREATE INDEX "oauth_states_userId_idx" ON "oauth_states"("userId");
CREATE INDEX "oauth_states_alternateId_idx" ON "oauth_states"("alternateId");

ALTER TABLE "integration_connections" ADD CONSTRAINT "integration_connections_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "integration_connections" ADD CONSTRAINT "integration_connections_alternateId_fkey"
    FOREIGN KEY ("alternateId") REFERENCES "alternates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "integration_executions" ADD CONSTRAINT "integration_executions_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "integration_executions" ADD CONSTRAINT "integration_executions_alternateId_fkey"
    FOREIGN KEY ("alternateId") REFERENCES "alternates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "integration_executions" ADD CONSTRAINT "integration_executions_connectionId_fkey"
    FOREIGN KEY ("connectionId") REFERENCES "integration_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "oauth_states" ADD CONSTRAINT "oauth_states_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "oauth_states" ADD CONSTRAINT "oauth_states_alternateId_fkey"
    FOREIGN KEY ("alternateId") REFERENCES "alternates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

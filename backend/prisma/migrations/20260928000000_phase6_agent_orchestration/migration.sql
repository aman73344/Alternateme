-- AlterTable
ALTER TABLE "alternates" ADD COLUMN     "agentEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "agent_runs" (
    "id" UUID NOT NULL,
    "alternateId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "conversationId" UUID,
    "executionContext" TEXT NOT NULL DEFAULT 'OWNER',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "goal" TEXT NOT NULL,
    "stepCount" INTEGER NOT NULL DEFAULT 0,
    "toolCallCount" INTEGER NOT NULL DEFAULT 0,
    "llmCallCount" INTEGER NOT NULL DEFAULT 0,
    "tokenCount" INTEGER NOT NULL DEFAULT 0,
    "failureCode" TEXT,
    "failureMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_steps" (
    "id" UUID NOT NULL,
    "agentRunId" UUID NOT NULL,
    "stepNumber" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "toolName" TEXT,
    "inputSummary" TEXT,
    "outputSummary" TEXT,
    "durationMs" INTEGER,
    "errorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tool_executions" (
    "id" UUID NOT NULL,
    "agentRunId" UUID NOT NULL,
    "alternateId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "executionContext" TEXT NOT NULL DEFAULT 'OWNER',
    "toolName" TEXT NOT NULL,
    "riskLevel" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "idempotencyKey" TEXT NOT NULL,
    "input" JSONB,
    "sanitizedInput" JSONB,
    "output" JSONB,
    "outputSummary" TEXT,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "approvalRequired" BOOLEAN NOT NULL DEFAULT false,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tool_executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_requests" (
    "id" UUID NOT NULL,
    "agentRunId" UUID NOT NULL,
    "toolExecutionId" UUID NOT NULL,
    "alternateId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "toolName" TEXT NOT NULL,
    "riskLevel" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reason" TEXT NOT NULL,
    "sanitizedActionSummary" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "executedAt" TIMESTAMP(3),
    "decidedBy" UUID,
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "approval_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tool_configurations" (
    "id" UUID NOT NULL,
    "alternateId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "toolName" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "allowedContexts" JSONB,
    "maxCallsPerRun" INTEGER,
    "requireApproval" BOOLEAN,
    "config" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tool_configurations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "agent_runs_alternateId_idx" ON "agent_runs"("alternateId");

-- CreateIndex
CREATE INDEX "agent_runs_userId_idx" ON "agent_runs"("userId");

-- CreateIndex
CREATE INDEX "agent_runs_conversationId_idx" ON "agent_runs"("conversationId");

-- CreateIndex
CREATE INDEX "agent_runs_status_idx" ON "agent_runs"("status");

-- CreateIndex
CREATE INDEX "agent_runs_executionContext_idx" ON "agent_runs"("executionContext");

-- CreateIndex
CREATE INDEX "agent_runs_createdAt_idx" ON "agent_runs"("createdAt");

-- CreateIndex
CREATE INDEX "agent_steps_agentRunId_idx" ON "agent_steps"("agentRunId");

-- CreateIndex
CREATE INDEX "agent_steps_toolName_idx" ON "agent_steps"("toolName");

-- CreateIndex
CREATE INDEX "agent_steps_status_idx" ON "agent_steps"("status");

-- CreateIndex
CREATE INDEX "agent_steps_createdAt_idx" ON "agent_steps"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "agent_steps_agentRunId_stepNumber_key" ON "agent_steps"("agentRunId", "stepNumber");

-- CreateIndex
CREATE INDEX "tool_executions_agentRunId_idx" ON "tool_executions"("agentRunId");

-- CreateIndex
CREATE INDEX "tool_executions_alternateId_idx" ON "tool_executions"("alternateId");

-- CreateIndex
CREATE INDEX "tool_executions_userId_idx" ON "tool_executions"("userId");

-- CreateIndex
CREATE INDEX "tool_executions_toolName_idx" ON "tool_executions"("toolName");

-- CreateIndex
CREATE INDEX "tool_executions_status_idx" ON "tool_executions"("status");

-- CreateIndex
CREATE INDEX "tool_executions_createdAt_idx" ON "tool_executions"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "tool_executions_alternateId_toolName_idempotencyKey_key" ON "tool_executions"("alternateId", "toolName", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "approval_requests_toolExecutionId_key" ON "approval_requests"("toolExecutionId");

-- CreateIndex
CREATE INDEX "approval_requests_agentRunId_idx" ON "approval_requests"("agentRunId");

-- CreateIndex
CREATE INDEX "approval_requests_alternateId_idx" ON "approval_requests"("alternateId");

-- CreateIndex
CREATE INDEX "approval_requests_userId_idx" ON "approval_requests"("userId");

-- CreateIndex
CREATE INDEX "approval_requests_status_idx" ON "approval_requests"("status");

-- CreateIndex
CREATE INDEX "approval_requests_expiresAt_idx" ON "approval_requests"("expiresAt");

-- CreateIndex
CREATE INDEX "approval_requests_createdAt_idx" ON "approval_requests"("createdAt");

-- CreateIndex
CREATE INDEX "tool_configurations_alternateId_idx" ON "tool_configurations"("alternateId");

-- CreateIndex
CREATE INDEX "tool_configurations_userId_idx" ON "tool_configurations"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "tool_configurations_alternateId_toolName_key" ON "tool_configurations"("alternateId", "toolName");

-- AddForeignKey
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_alternateId_fkey" FOREIGN KEY ("alternateId") REFERENCES "alternates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_steps" ADD CONSTRAINT "agent_steps_agentRunId_fkey" FOREIGN KEY ("agentRunId") REFERENCES "agent_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tool_executions" ADD CONSTRAINT "tool_executions_agentRunId_fkey" FOREIGN KEY ("agentRunId") REFERENCES "agent_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tool_executions" ADD CONSTRAINT "tool_executions_alternateId_fkey" FOREIGN KEY ("alternateId") REFERENCES "alternates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tool_executions" ADD CONSTRAINT "tool_executions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_agentRunId_fkey" FOREIGN KEY ("agentRunId") REFERENCES "agent_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_alternateId_fkey" FOREIGN KEY ("alternateId") REFERENCES "alternates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_toolExecutionId_fkey" FOREIGN KEY ("toolExecutionId") REFERENCES "tool_executions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tool_configurations" ADD CONSTRAINT "tool_configurations_alternateId_fkey" FOREIGN KEY ("alternateId") REFERENCES "alternates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tool_configurations" ADD CONSTRAINT "tool_configurations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


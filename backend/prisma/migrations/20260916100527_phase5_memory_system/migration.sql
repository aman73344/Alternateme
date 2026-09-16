-- AlterTable
ALTER TABLE "alternates" ADD COLUMN     "memoryEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "memories" (
    "id" UUID NOT NULL,
    "alternateId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "normalizedContent" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL DEFAULT 'EXPLICIT',
    "importance" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "sourceConversationId" UUID,
    "sourceMessageId" UUID,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "visibility" TEXT NOT NULL DEFAULT 'PRIVATE',
    "isExtracted" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3),
    "lastAccessedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastReinforcedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reinforcementCount" INTEGER NOT NULL DEFAULT 0,
    "supersededById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "memories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memory_embeddings" (
    "id" UUID NOT NULL,
    "memoryId" UUID NOT NULL,
    "alternateId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "vector" vector(1536),
    "model" TEXT NOT NULL DEFAULT 'text-embedding-3-small',
    "dimensions" INTEGER NOT NULL DEFAULT 1536,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "memory_embeddings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation_summaries" (
    "id" UUID NOT NULL,
    "conversationId" UUID NOT NULL,
    "alternateId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "summary" TEXT NOT NULL,
    "messageRangeStart" INTEGER NOT NULL,
    "messageRangeEnd" INTEGER NOT NULL,
    "tokenCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversation_summaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memory_extraction_jobs" (
    "id" UUID NOT NULL,
    "alternateId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "messageId" UUID NOT NULL,
    "conversationId" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "errorMessage" TEXT,
    "extractedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "memory_extraction_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "memories_supersededById_key" ON "memories"("supersededById");

-- CreateIndex
CREATE INDEX "memories_alternateId_idx" ON "memories"("alternateId");

-- CreateIndex
CREATE INDEX "memories_userId_idx" ON "memories"("userId");

-- CreateIndex
CREATE INDEX "memories_type_idx" ON "memories"("type");

-- CreateIndex
CREATE INDEX "memories_status_idx" ON "memories"("status");

-- CreateIndex
CREATE INDEX "memories_importance_idx" ON "memories"("importance");

-- CreateIndex
CREATE INDEX "memories_createdAt_idx" ON "memories"("createdAt");

-- CreateIndex
CREATE INDEX "memories_updatedAt_idx" ON "memories"("updatedAt");

-- CreateIndex
CREATE INDEX "memories_expiresAt_idx" ON "memories"("expiresAt");

-- CreateIndex
CREATE INDEX "memories_lastAccessedAt_idx" ON "memories"("lastAccessedAt");

-- CreateIndex
CREATE INDEX "memories_normalizedContent_idx" ON "memories"("normalizedContent");

-- CreateIndex
CREATE INDEX "memories_sourceConversationId_idx" ON "memories"("sourceConversationId");

-- CreateIndex
CREATE INDEX "memories_sourceMessageId_idx" ON "memories"("sourceMessageId");

-- CreateIndex
CREATE UNIQUE INDEX "memory_embeddings_memoryId_key" ON "memory_embeddings"("memoryId");

-- CreateIndex
CREATE INDEX "memory_embeddings_memoryId_idx" ON "memory_embeddings"("memoryId");

-- CreateIndex
CREATE INDEX "memory_embeddings_alternateId_idx" ON "memory_embeddings"("alternateId");

-- CreateIndex
CREATE INDEX "memory_embeddings_userId_idx" ON "memory_embeddings"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "conversation_summaries_conversationId_key" ON "conversation_summaries"("conversationId");

-- CreateIndex
CREATE INDEX "conversation_summaries_conversationId_idx" ON "conversation_summaries"("conversationId");

-- CreateIndex
CREATE INDEX "conversation_summaries_alternateId_idx" ON "conversation_summaries"("alternateId");

-- CreateIndex
CREATE INDEX "conversation_summaries_userId_idx" ON "conversation_summaries"("userId");

-- CreateIndex
CREATE INDEX "conversation_summaries_createdAt_idx" ON "conversation_summaries"("createdAt");

-- CreateIndex
CREATE INDEX "memory_extraction_jobs_alternateId_idx" ON "memory_extraction_jobs"("alternateId");

-- CreateIndex
CREATE INDEX "memory_extraction_jobs_userId_idx" ON "memory_extraction_jobs"("userId");

-- CreateIndex
CREATE INDEX "memory_extraction_jobs_status_idx" ON "memory_extraction_jobs"("status");

-- CreateIndex
CREATE INDEX "memory_extraction_jobs_messageId_idx" ON "memory_extraction_jobs"("messageId");

-- CreateIndex
CREATE INDEX "memory_extraction_jobs_createdAt_idx" ON "memory_extraction_jobs"("createdAt");

-- AddForeignKey
ALTER TABLE "memories" ADD CONSTRAINT "memories_alternateId_fkey" FOREIGN KEY ("alternateId") REFERENCES "alternates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memories" ADD CONSTRAINT "memories_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memories" ADD CONSTRAINT "memories_supersededById_fkey" FOREIGN KEY ("supersededById") REFERENCES "memories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memory_embeddings" ADD CONSTRAINT "memory_embeddings_memoryId_fkey" FOREIGN KEY ("memoryId") REFERENCES "memories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memory_embeddings" ADD CONSTRAINT "memory_embeddings_alternateId_fkey" FOREIGN KEY ("alternateId") REFERENCES "alternates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memory_embeddings" ADD CONSTRAINT "memory_embeddings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_summaries" ADD CONSTRAINT "conversation_summaries_alternateId_fkey" FOREIGN KEY ("alternateId") REFERENCES "alternates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_summaries" ADD CONSTRAINT "conversation_summaries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_summaries" ADD CONSTRAINT "conversation_summaries_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memory_extraction_jobs" ADD CONSTRAINT "memory_extraction_jobs_alternateId_fkey" FOREIGN KEY ("alternateId") REFERENCES "alternates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memory_extraction_jobs" ADD CONSTRAINT "memory_extraction_jobs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memory_extraction_jobs" ADD CONSTRAINT "memory_extraction_jobs_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memory_extraction_jobs" ADD CONSTRAINT "memory_extraction_jobs_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Recreate pgvector HNSW index for document chunk embeddings (removed by db pull introspection)
CREATE INDEX IF NOT EXISTS "embeddings_vector_hnsw_idx" ON "embeddings" USING hnsw ("vector" vector_cosine_ops);

-- Create pgvector HNSW index for memory embeddings
CREATE INDEX IF NOT EXISTS "memory_embeddings_vector_hnsw_idx" ON "memory_embeddings" USING hnsw ("vector" vector_cosine_ops);

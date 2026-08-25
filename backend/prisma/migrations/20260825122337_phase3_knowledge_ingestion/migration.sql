-- Enable pgvector. On Neon it is available (0.8.0) but not pre-installed; on CI
-- the pgvector/pgvector image ships it. IF NOT EXISTS keeps this idempotent and
-- does not touch existing data.
CREATE EXTENSION IF NOT EXISTS vector;

-- CreateEnum
CREATE TYPE "IngestionStage" AS ENUM ('QUEUED', 'PROCESSING', 'EXTRACTING', 'CLEANING', 'CHUNKING', 'EMBEDDING', 'COMPLETED', 'FAILED', 'CANCELLED', 'RETRYING');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('PENDING', 'PROCESSING', 'READY', 'FAILED', 'OCR_REQUIRED', 'DELETED');

-- CreateEnum
CREATE TYPE "KnowledgeVersionStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUPERSEDED', 'FAILED');

-- AlterTable
ALTER TABLE "training_sources" ADD COLUMN     "checksum" TEXT,
ADD COLUMN     "chunkCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "currentVersion" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "documentCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "errorCode" TEXT,
ADD COLUMN     "failedAt" TIMESTAMP(3),
ADD COLUMN     "lastProcessedAt" TIMESTAMP(3),
ADD COLUMN     "processedAt" TIMESTAMP(3),
ADD COLUMN     "processingStage" TEXT,
ADD COLUMN     "storageBucket" TEXT,
ADD COLUMN     "storageKey" TEXT,
ADD COLUMN     "storageUrl" TEXT;

-- CreateTable
CREATE TABLE "knowledge_documents" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "alternateId" UUID NOT NULL,
    "sourceId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "mimeType" TEXT,
    "language" TEXT NOT NULL DEFAULT 'en',
    "characterCount" INTEGER NOT NULL DEFAULT 0,
    "wordCount" INTEGER NOT NULL DEFAULT 0,
    "pageCount" INTEGER NOT NULL DEFAULT 0,
    "checksum" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "status" "DocumentStatus" NOT NULL DEFAULT 'PENDING',
    "processedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_chunks" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "alternateId" UUID NOT NULL,
    "sourceId" UUID NOT NULL,
    "documentId" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "chunkIndex" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "tokenCount" INTEGER NOT NULL DEFAULT 0,
    "characterCount" INTEGER NOT NULL DEFAULT 0,
    "heading" TEXT,
    "metadata" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "embeddings" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "alternateId" UUID NOT NULL,
    "sourceId" UUID NOT NULL,
    "documentId" UUID NOT NULL,
    "chunkId" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "model" TEXT NOT NULL,
    "modelDimensions" INTEGER NOT NULL DEFAULT 1536,
    "tokenCount" INTEGER,
    "vector" vector(1536),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "embeddings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ingestion_jobs" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "alternateId" UUID NOT NULL,
    "sourceId" UUID NOT NULL,
    "documentId" UUID,
    "version" INTEGER NOT NULL DEFAULT 0,
    "type" TEXT NOT NULL DEFAULT 'INGEST',
    "status" "IngestionStage" NOT NULL DEFAULT 'QUEUED',
    "stage" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "isRetryable" BOOLEAN NOT NULL DEFAULT false,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "payload" JSONB,
    "result" JSONB,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ingestion_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_versions" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "alternateId" UUID NOT NULL,
    "sourceId" UUID NOT NULL,
    "documentId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "KnowledgeVersionStatus" NOT NULL DEFAULT 'PENDING',
    "chunkCount" INTEGER NOT NULL DEFAULT 0,
    "checksum" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "supersededAt" TIMESTAMP(3),

    CONSTRAINT "knowledge_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "knowledge_documents_userId_idx" ON "knowledge_documents"("userId");

-- CreateIndex
CREATE INDEX "knowledge_documents_alternateId_idx" ON "knowledge_documents"("alternateId");

-- CreateIndex
CREATE INDEX "knowledge_documents_sourceId_idx" ON "knowledge_documents"("sourceId");

-- CreateIndex
CREATE INDEX "knowledge_documents_version_idx" ON "knowledge_documents"("version");

-- CreateIndex
CREATE INDEX "knowledge_documents_status_idx" ON "knowledge_documents"("status");

-- CreateIndex
CREATE INDEX "document_chunks_userId_idx" ON "document_chunks"("userId");

-- CreateIndex
CREATE INDEX "document_chunks_alternateId_idx" ON "document_chunks"("alternateId");

-- CreateIndex
CREATE INDEX "document_chunks_sourceId_idx" ON "document_chunks"("sourceId");

-- CreateIndex
CREATE INDEX "document_chunks_documentId_idx" ON "document_chunks"("documentId");

-- CreateIndex
CREATE INDEX "document_chunks_version_idx" ON "document_chunks"("version");

-- CreateIndex
CREATE INDEX "document_chunks_isActive_idx" ON "document_chunks"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "document_chunks_userId_version_chunkIndex_key" ON "document_chunks"("userId", "version", "chunkIndex");

-- CreateIndex
CREATE INDEX "embeddings_userId_idx" ON "embeddings"("userId");

-- CreateIndex
CREATE INDEX "embeddings_alternateId_idx" ON "embeddings"("alternateId");

-- CreateIndex
CREATE INDEX "embeddings_sourceId_idx" ON "embeddings"("sourceId");

-- CreateIndex
CREATE INDEX "embeddings_documentId_idx" ON "embeddings"("documentId");

-- CreateIndex
CREATE INDEX "embeddings_chunkId_idx" ON "embeddings"("chunkId");

-- CreateIndex
CREATE INDEX "embeddings_version_idx" ON "embeddings"("version");

-- CreateIndex
CREATE INDEX "ingestion_jobs_userId_idx" ON "ingestion_jobs"("userId");

-- CreateIndex
CREATE INDEX "ingestion_jobs_alternateId_idx" ON "ingestion_jobs"("alternateId");

-- CreateIndex
CREATE INDEX "ingestion_jobs_sourceId_idx" ON "ingestion_jobs"("sourceId");

-- CreateIndex
CREATE INDEX "ingestion_jobs_status_idx" ON "ingestion_jobs"("status");

-- CreateIndex
CREATE INDEX "ingestion_jobs_createdAt_idx" ON "ingestion_jobs"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_versions_documentId_key" ON "knowledge_versions"("documentId");

-- CreateIndex
CREATE INDEX "knowledge_versions_userId_idx" ON "knowledge_versions"("userId");

-- CreateIndex
CREATE INDEX "knowledge_versions_alternateId_idx" ON "knowledge_versions"("alternateId");

-- CreateIndex
CREATE INDEX "knowledge_versions_status_idx" ON "knowledge_versions"("status");

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_versions_sourceId_version_key" ON "knowledge_versions"("sourceId", "version");
-- ============================================================================
-- pgvector indexes
-- The embeddings table stores vectors for retrieval-eligible DocumentChunks.
-- We use an HNSW index with cosine distance:
--   * HNSW gives good recall/latency trade-off for online RAG retrieval and
--     does not require a one-time expensive build, unlike IVFFlat.
--   * cosine distance matches text embeddings that are normalized / built for
--     semantic similarity.
--   * pgvector 0.8.0 (Neon/CI) supports HNSW on >= PG14.
-- Scoped retrieval filters by (alternateId, version, isActive) first and then
-- uses the vector index for ranking within the alternate's knowledge.
-- A dedicated tenant-scoped vector index is avoided at this scale to keep
-- write amplification low; the (alternateId) btree narrows the candidate set.
CREATE INDEX "embeddings_vector_hnsw_idx" ON "embeddings" USING hnsw ("vector" vector_cosine_ops);

-- AddForeignKey
ALTER TABLE "knowledge_documents" ADD CONSTRAINT "knowledge_documents_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_documents" ADD CONSTRAINT "knowledge_documents_alternateId_fkey" FOREIGN KEY ("alternateId") REFERENCES "alternates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_documents" ADD CONSTRAINT "knowledge_documents_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "training_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_chunks" ADD CONSTRAINT "document_chunks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_chunks" ADD CONSTRAINT "document_chunks_alternateId_fkey" FOREIGN KEY ("alternateId") REFERENCES "alternates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_chunks" ADD CONSTRAINT "document_chunks_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "training_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_chunks" ADD CONSTRAINT "document_chunks_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "knowledge_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "embeddings" ADD CONSTRAINT "embeddings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "embeddings" ADD CONSTRAINT "embeddings_alternateId_fkey" FOREIGN KEY ("alternateId") REFERENCES "alternates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "embeddings" ADD CONSTRAINT "embeddings_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "training_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "embeddings" ADD CONSTRAINT "embeddings_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "knowledge_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "embeddings" ADD CONSTRAINT "embeddings_chunkId_fkey" FOREIGN KEY ("chunkId") REFERENCES "document_chunks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingestion_jobs" ADD CONSTRAINT "ingestion_jobs_alternateId_fkey" FOREIGN KEY ("alternateId") REFERENCES "alternates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingestion_jobs" ADD CONSTRAINT "ingestion_jobs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingestion_jobs" ADD CONSTRAINT "ingestion_jobs_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "training_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingestion_jobs" ADD CONSTRAINT "ingestion_jobs_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "knowledge_documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_versions" ADD CONSTRAINT "knowledge_versions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_versions" ADD CONSTRAINT "knowledge_versions_alternateId_fkey" FOREIGN KEY ("alternateId") REFERENCES "alternates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_versions" ADD CONSTRAINT "knowledge_versions_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "training_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_versions" ADD CONSTRAINT "knowledge_versions_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "knowledge_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

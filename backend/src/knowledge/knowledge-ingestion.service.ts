import { createHash } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { config } from '@/config';
import { logger } from '@/utils/logger';
import { extractorRegistry, registerExtractors } from './extractors';
import { sourceResolver } from './source-resolver';
import { ContentCleaner } from './content-cleaner';
import { ChunkingService } from './chunking.service';
import { EmbeddingService } from './embedding/embedding.service';
import { registerEmbeddingProviders } from './embedding/bootstrap';
import { KnowledgeError } from './knowledge.errors';
import { knowledgeRepository } from './knowledge.repository';
import { knowledgeSourceRepository } from './knowledge-source.repository';
import { knowledgeChunkRepository } from './knowledge-chunk.repository';
import { knowledgeVersioningRepository } from './knowledge-versioning.repository';
import type { ExtractSource } from './extractors/extractor';
import type { IngestionJobData } from './knowledge.types';

export interface IngestOutcome {
  documentId: string;
  version: number;
  chunkCount: number;
  checksum: string;
  skippedIdempotent?: boolean;
  ocrRequired?: boolean;
}

interface SourceLike {
  id: string;
  type: string;
  name?: string | null;
  url?: string | null;
  fileName?: string | null;
  mimeType?: string | null;
  storageKey?: string | null;
  currentVersion?: number | null;
  metadata?: unknown;
}

export class KnowledgeIngestionService {
  private readonly cleaner = new ContentCleaner({
    maxCharacters: config.knowledge.file.maxDocumentSize,
  });
  private readonly chunker = new ChunkingService({
    chunkSize: config.knowledge.chunking.chunkSize,
    overlap: config.knowledge.chunking.overlap,
    maxChunkSize: config.knowledge.chunking.maxChunkSize,
    minChunkSize: config.knowledge.chunking.minChunkSize,
  });
  private buildEmbeddingService(): EmbeddingService {
    registerEmbeddingProviders();
    return new EmbeddingService({});
  }

  /** Entry point invoked by the worker. Runs the whole pipeline for one source. */
  async ingest(jobData: IngestionJobData): Promise<IngestOutcome> {
    const { jobId, userId, alternateId, sourceId, force } = jobData;

    const [source, _started] = await Promise.all([
      knowledgeSourceRepository.getSource(sourceId, userId, alternateId) as Promise<SourceLike>,
      knowledgeRepository.markJobStarted(jobId),
    ]);
    await Promise.all([
      knowledgeSourceRepository.markSourceProcessing(sourceId, 'EXTRACTING'),
      knowledgeRepository.markJobStage(jobId, 'EXTRACTING', 'EXTRACTING', 25),
    ]);

    const nextVersion = this.nextVersion(source);
    const extractSource = await sourceResolver.resolve(source);
    const extraction = await this.extract(extractSource);

    if (extraction.ocrRequired) {
      await this.fail(sourceId, jobId, 'OCR_REQUIRED');
      return { documentId: '', version: nextVersion, chunkCount: 0, checksum: '', ocrRequired: true };
    }

    await Promise.all([
      knowledgeSourceRepository.markSourceProcessing(sourceId, 'CLEANING'),
      knowledgeRepository.markJobStage(jobId, 'CLEANING', 'CLEANING', 45),
    ]);
    const cleaned = this.cleaner.clean(extraction);
    if (!cleaned.content || !cleaned.content.trim()) {
      await this.fail(sourceId, jobId, 'EMPTY_DOCUMENT');
      return { documentId: '', version: nextVersion, chunkCount: 0, checksum: '' };
    }

    const checksum = this.hash(cleaned.content);

    // Idempotency gate — unchanged content (without force) keeps the existing
    // ACTIVE version so we never create duplicate chunks/embeddings.
    if (!force) {
      const active = await knowledgeVersioningRepository.getActiveVersion(sourceId);
      if (active && active.checksum === checksum) {
        logger.info({ sourceId, version: active.version }, 'Content unchanged; skipping reprocess');
        await knowledgeRepository.markJobCompleted(jobId, { skipped: true, version: active.version });
        await knowledgeSourceRepository.markSourceReady(sourceId, {
          version: active.version,
          chunkCount: active.chunkCount,
          documentCount: 1,
          checksum,
        });
        return {
          documentId: active.documentId,
          version: active.version,
          chunkCount: active.chunkCount,
          checksum,
          skippedIdempotent: true,
        };
      }
    }

    return this.finish({ jobData, source, extraction, cleaned, checksum, nextVersion });
  }
  /** Runs chunk → embed → persist → activate version (post-idempotency). */
  private async finish(args: {
    jobData: IngestionJobData;
    source: SourceLike;
    extraction: { title?: string; mimeType?: string; pageCount?: number; ocrRequired?: boolean };
    cleaned: { content: string; language?: string };
    checksum: string;
    nextVersion: number;
  }): Promise<IngestOutcome> {
    const { jobData, source, extraction, cleaned, checksum, nextVersion } = args;
    const { jobId, userId, alternateId, sourceId } = jobData;

    await Promise.all([
      knowledgeSourceRepository.markSourceProcessing(sourceId, 'CHUNKING'),
      knowledgeRepository.markJobStage(jobId, 'CHUNKING', 'CHUNKING', 60),
    ]);

    const baseMetadata: Record<string, unknown> = {
      sourceType: source.type,
      sourceUrl: source.url,
      documentTitle: source.name,
      language: cleaned.language || 'en',
    };
    const chunks = this.chunker.chunk(cleaned.content, baseMetadata);
    if (chunks.length === 0) {
      await this.fail(sourceId, jobId, 'CHUNKING_FAILED');
      return { documentId: '', version: nextVersion, chunkCount: 0, checksum: '' };
    }

    await Promise.all([
      knowledgeSourceRepository.markSourceProcessing(sourceId, 'EMBEDDING'),
      knowledgeRepository.markJobStage(jobId, 'EMBEDDING', 'EMBEDDING', 70),
    ]);

    const embeddingService = this.buildEmbeddingService();
    const { vectors, tokenCounts } = await embeddingService.embed(chunks.map((c) => c.content));
    if (vectors.length !== chunks.length) {
      await this.fail(sourceId, jobId, 'EMBEDDING_FAILED');
      return { documentId: '', version: nextVersion, chunkCount: 0, checksum: '' };
    }

    // Commit document metadata.
    const document = await knowledgeSourceRepository.createDocument({
      userId,
      alternateId,
      sourceId,
      title: extraction.title || source.name || 'Document',
      mimeType: extraction.mimeType,
      language: cleaned.language || 'en',
      characterCount: cleaned.content.length,
      wordCount: cleaned.content.split(/\s+/).filter(Boolean).length,
      pageCount: extraction.pageCount ?? 0,
      checksum,
      version: nextVersion,
    });

    // Persist chunks.
    await knowledgeChunkRepository.createChunks(
      chunks.map((c) => ({
        userId,
        alternateId,
        sourceId,
        documentId: document.id,
        version: nextVersion,
        chunkIndex: c.index,
        content: c.content,
        tokenCount: c.tokenCount,
        characterCount: c.characterCount,
        heading: c.heading,
        metadata: c.metadata,
      })),
    );

    // Persist embeddings into pgvector via raw insert (Prisma cannot bind the
    // Unsupported vector column).
    const rows = await knowledgeChunkRepository.getChunkIdsForDocument(document.id, nextVersion);
    const byIndex = new Map(rows.map((r) => [r.chunkIndex, r.id]));
    const embeddingRows = vectors.map((vector, i) => ({
      id: uuidv4(),
      userId,
      alternateId,
      sourceId,
      documentId: document.id,
      chunkId: byIndex.get(chunks[i].index) || '',
      version: nextVersion,
      model: embeddingService.modelName,
      dimensions: embeddingService.dimensions,
      tokenCount: tokenCounts?.[0],
      vector,
    }));
    if (embeddingRows.some((r) => !r.chunkId)) {
      await this.fail(sourceId, jobId, 'EMBEDDING_FAILED');
      return { documentId: document.id, version: nextVersion, chunkCount: 0, checksum };
    }
    await knowledgeChunkRepository.insertEmbeddings(embeddingRows);

    // Versioning: create + activate, superseding the previous ACTIVE version.
    await knowledgeVersioningRepository
      .createVersion({
        userId,
        alternateId,
        sourceId,
        documentId: document.id,
        version: nextVersion,
        chunkCount: chunks.length,
        checksum,
      })
      .catch((e) => logger.warn({ e }, 'createVersion raced; reusing existing'));
    await knowledgeVersioningRepository.activateVersion(sourceId, nextVersion);
    await knowledgeSourceRepository.markDocumentReady(document.id);
    await knowledgeSourceRepository.markSourceReady(sourceId, {
      version: nextVersion,
      chunkCount: chunks.length,
      documentCount: 1,
      checksum,
    });
    await knowledgeRepository.markJobCompleted(jobId, {
      version: nextVersion,
      chunkCount: chunks.length,
      documentId: document.id,
    });

    logger.info({ jobId, sourceId, version: nextVersion, chunks: chunks.length }, 'Knowledge ingestion completed');
    return { documentId: document.id, version: nextVersion, chunkCount: chunks.length, checksum };
  }

  private nextVersion(source: SourceLike): number {
    return (source.currentVersion || 0) + 1;
  }

  private hash(content: string): string {
    return createHash('sha256').update(content).digest('hex');
  }

  private async extract(extractSource: ExtractSource) {
    // The registry is populated by the worker bootstrap, but the service must
    // be self-sufficient regardless of entry point (worker, direct invocation,
    // future HTTP trigger). registerExtractors is idempotent.
    registerExtractors();
    const extractor = extractorRegistry.resolve(extractSource);
    if (!extractor) {
      throw new KnowledgeError('UNSUPPORTED_FILE_TYPE', undefined, 'No extractor matched this source');
    }
    return extractor.extract(extractSource);
  }

  private async fail(sourceId: string, jobId: string, errorCodeKey: string): Promise<void> {
    const err = KnowledgeError.from(errorCodeKey);
    await knowledgeSourceRepository.markSourceFailed(sourceId, err.code, err.safeMessage);
    await knowledgeRepository.markJobFailed(jobId, err.code, err.safeMessage, err.isRetryable, 1);
  }
}

export const knowledgeIngestionService = new KnowledgeIngestionService();
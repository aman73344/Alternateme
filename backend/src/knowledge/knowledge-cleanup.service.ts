import { prisma } from '@/database';
import { logger } from '@/utils/logger';
import { knowledgeVersioningRepository } from './knowledge-versioning.repository';

/**
 * KnowledgeCleanupService — safe, asynchronous knowledge lifecycle.
 * Deletion is two-phase:
 *   1. softDeleteSourceKnowledge() removes a source's knowledge from
 *      retrieval eligibility immediately (chunks → isActive=false, ACTIVE
 *      versions → SUPERSEDED, documents → DELETED) so the source can be
 *      deleted with zero dangling knowledge visible to RAG.
 *   2. purgeSourceData() runs later (cleanup queue) and physically deletes
 *      embedded vectors + chunk rows after it is safe to do so. This keeps the
 *      API response fast for large datasets while never leaving dangling data.
 */
export class KnowledgeCleanupService {
  /** Phase 1 of deletion — synchronous, immediate, removes from retrieval. */
  async softDeleteSourceKnowledge(sourceId: string): Promise<void> {
    await knowledgeVersioningRepository.softDeleteKnowledge(sourceId);
    logger.info({ sourceId }, 'Knowledge soft-deleted');
  }

  /** Phase 2 of deletion — batch-remove old vector/chunk rows (idle worker). */
  async purgeSourceData(sourceId: string): Promise<{ chunks: number; embeddings: number }> {
    // Only delete rows for sources already marked DELETED so we never drop
    // active knowledge on an unlucky race.
    const source = await prisma.trainingSource.findUnique({
      where: { id: sourceId },
      select: { status: true },
    });
    if (!source || source.status !== 'DELETED') {
      logger.warn({ sourceId }, 'Refusing to purge data for a non-deleted source');
      return { chunks: 0, embeddings: 0 };
    }

    // Embeddings live in a table with an Unsupported vector column, so they
    // require raw SQL; chunks go through Prisma. Sequential is fine here —
    // the job is idempotent and retried safely if interrupted.
    const embeddings = await prisma.$executeRawUnsafe(
      'DELETE FROM "embeddings" WHERE "sourceId" = $1::uuid',
      sourceId,
    );
    const removedChunks = await prisma.documentChunk.deleteMany({ where: { sourceId } });
    logger.info(
      { sourceId, chunks: removedChunks.count, embeddings },
      'Knowledge purged',
    );
    return { chunks: removedChunks.count, embeddings };
  }

  /** Reconcile count fields on the source after cleanup. */
  async resetSourceCounts(sourceId: string): Promise<void> {
    await prisma.trainingSource.update({
      where: { id: sourceId },
      data: { chunkCount: 0, documentCount: 0 },
    });
  }
}

export const knowledgeCleanupService = new KnowledgeCleanupService();

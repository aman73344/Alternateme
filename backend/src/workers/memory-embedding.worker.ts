/**
 * Memory Embedding Worker
 *
 * Consumes jobs from the memory-embedding queue.
 * Generates embeddings for new or updated memories.
 */

import { Worker, Job } from 'bullmq';
import { config } from '@/config';
import { logger } from '@/utils/logger';
import { QueueName } from '@/queues';
import { EmbeddingService } from '@/knowledge/embedding/embedding.service';
import { upsertMemoryEmbedding } from '@/memory/memory-embedding.repository';
import { createAuditLog } from '@/auth/repositories/audit.repository';

/** Shared embedding service instance (Phase 3 abstraction). */
const embeddingService = new EmbeddingService();

interface MemoryEmbeddingJobData {
  memoryId: string;
  alternateId: string;
  userId: string;
  content: string;
}

const connection = {
  url: config.redis.url,
  maxRetriesPerRequest: null,
};

export function createMemoryEmbeddingWorker(): Worker {
  const worker = new Worker(
    QueueName.MEMORY_EMBEDDING,
    async (job: Job) => {
      const data = job.data as MemoryEmbeddingJobData;
      const started = Date.now();

      logger.info(
        { jobId: job.id, memoryId: data.memoryId },
        'Memory embedding job started',
      );

      try {
        const result = await embeddingService.embed([data.content]);
        const embedding = result.vectors[0];
        if (!embedding) throw new Error('Embedding provider returned no vector');
        await upsertMemoryEmbedding(data.memoryId, data.alternateId, data.userId, embedding);

        logger.info(
          { jobId: job.id, memoryId: data.memoryId, durationMs: Date.now() - started },
          'Memory embedding job completed',
        );

        // Audit event
        await createAuditLog({
          userId: data.userId,
          action: 'MEMORY_EMBEDDING_CREATED',
          entity: 'MemoryEmbedding',
          entityId: data.memoryId,
        });

        return { success: true };
      } catch (err) {
        logger.error(
          {
            jobId: job.id,
            memoryId: data.memoryId,
            err: err instanceof Error ? { message: err.message } : err,
            durationMs: Date.now() - started,
          },
          'Memory embedding job failed',
        );
        throw err;
      }
    },
    { connection, concurrency: config.queue.concurrency },
  );

  worker.on('completed', (job) => {
    logger.info({ jobId: job.id }, 'Memory embedding worker completed');
  });

  worker.on('failed', (job, err) => {
    logger.error(
      { jobId: job?.id, err: err instanceof Error ? err.message : err },
      'Memory embedding worker failed',
    );
    // Fire audit event for failed embedding
    if (job) {
      void createAuditLog({
        userId: job.data?.userId ?? '',
        action: 'MEMORY_EMBEDDING_FAILED',
        entity: 'MemoryEmbedding',
        entityId: job.data?.memoryId,
        metadata: { error: err instanceof Error ? err.message : String(err) },
      });
    }
  });

  return worker;
}

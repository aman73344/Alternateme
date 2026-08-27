import { Worker } from 'bullmq';
import { config } from '@/config';
import { logger } from '@/utils/logger';
import { QueueName } from '@/queues';
import { knowledgeChunkRepository } from '@/knowledge/knowledge-chunk.repository';
import { EmbeddingService } from '@/knowledge/embedding/embedding.service';
import { registerEmbeddingProviders } from '@/knowledge/embedding/bootstrap';

const connection = { url: config.redis.url, maxRetriesPerRequest: null };

export interface EmbeddingGenerationJobData {
  documentId: string;
  sourceId: string;
  version: number;
}

/**
 * embedding-generation.worker.ts — generates + stores embeddings for a
 * document's chunks. It delegates batching/retry to EmbeddingService and never
 * touches controllers. Note: in the current orchestrator embeddings are
 * generated inline during KnowledgeIngestionService; this queue is the
 * extension point for batching large sources across workers.
 */
export function createEmbeddingGenerationWorker(): Worker {
  registerEmbeddingProviders();
  const worker = new Worker(
    QueueName.EMBEDDING_GENERATION,
    async (job) => {
      const data = job.data as EmbeddingGenerationJobData;
      logger.info({ jobId: job.id, documentId: data.documentId }, 'Embedding generation started');
      const chunks = await knowledgeChunkRepository.getChunksForDocument(data.documentId, data.version);
      if (chunks.length === 0) return { embedded: 0 };
      const service = new EmbeddingService({});
      const { vectors } = await service.embed(chunks.map((c) => c.content));
      return { embedded: vectors.length };
    },
    { connection, concurrency: config.queue.concurrency },
  );
  worker.on('failed', (job, err) => logger.error({ jobId: job?.id, err: err?.message }, 'Embedding generation failed'));
  return worker;
}
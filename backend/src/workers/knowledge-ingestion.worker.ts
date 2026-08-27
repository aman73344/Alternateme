import { Worker } from 'bullmq';
import { config } from '@/config';
import { logger } from '@/utils/logger';
import { QueueName } from '@/queues';
import { registerExtractors } from '@/knowledge/extractors';
import { knowledgeIngestionService } from '@/knowledge/knowledge-ingestion.service';
import type { IngestionJobData } from '@/knowledge/knowledge.types';

const connection = {
  url: config.redis.url,
  maxRetriesPerRequest: null,
};

/**
 * knowledge-ingestion.worker.ts — consumes jobs from the knowledge-ingestion
 * queue and runs them through the pipeline service. The worker stays thin; all
 * pipeline logic lives in KnowledgeIngestionService.
 */
export function createKnowledgeIngestionWorker(): Worker {
  registerExtractors();

  const worker = new Worker(
    QueueName.KNOWLEDGE_INGESTION,
    async (job) => {
      const data = job.data as IngestionJobData;
      const started = Date.now();
      logger.info(
        { jobId: job.id, sourceId: data.sourceId, alternateId: data.alternateId },
        'Knowledge ingestion job started',
      );
      try {
        const outcome = await knowledgeIngestionService.ingest(data);
        logger.info(
          { jobId: job.id, sourceId: data.sourceId, version: outcome.version, chunkCount: outcome.chunkCount, durationMs: Date.now() - started },
          'Knowledge ingestion job completed',
        );
        return outcome;
      } catch (err) {
        logger.error(
          { jobId: job.id, sourceId: data.sourceId, err: err instanceof Error ? { message: err.message } : err, durationMs: Date.now() - started },
          'Knowledge ingestion job failed',
        );
        throw err; // BullMQ drives retry policy
      }
    },
    { connection, concurrency: config.queue.concurrency },
  );

  worker.on('completed', (job) => logger.info({ jobId: job.id }, 'Knowledge ingestion worker completed'));
  worker.on('failed', (job, err) =>
    logger.error({ jobId: job?.id, err: err?.message }, 'Knowledge ingestion worker failed'),
  );
  return worker;
}
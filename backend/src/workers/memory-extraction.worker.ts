/**
 * Memory Extraction Worker
 *
 * Consumes jobs from the memory-extraction queue.
 * The worker stays thin — all extraction logic lives in MemoryExtractionService.
 */

import { Worker, Job } from 'bullmq';
import { config } from '@/config';
import { logger } from '@/utils/logger';
import { QueueName } from '@/queues';
import { memoryExtractionService } from '@/memory/memory.extraction';
import { ExtractionJobData } from '@/memory/memory.extraction';

const connection = {
  url: config.redis.url,
  maxRetriesPerRequest: null,
};

export function createMemoryExtractionWorker(): Worker {
  const worker = new Worker(
    QueueName.MEMORY_EXTRACTION,
    async (job: Job) => {
      const data = job.data as ExtractionJobData;
      const started = Date.now();

      logger.info(
        { jobId: job.id, messageId: data.messageId, alternateId: data.alternateId },
        'Memory extraction job started',
      );

      try {
        const result = await memoryExtractionService.extract(data);

        logger.info(
          {
            jobId: job.id,
            messageId: data.messageId,
            created: result.created,
            updated: result.updated,
            skipped: result.skipped,
            durationMs: Date.now() - started,
          },
          'Memory extraction job completed',
        );

        return result;
      } catch (err) {
        logger.error(
          {
            jobId: job.id,
            messageId: data.messageId,
            err: err instanceof Error ? { message: err.message } : err,
            durationMs: Date.now() - started,
          },
          'Memory extraction job failed',
        );
        throw err;
      }
    },
    { connection, concurrency: config.queue.concurrency },
  );

  worker.on('completed', (job) => {
    logger.info({ jobId: job.id }, 'Memory extraction worker completed');
  });

  worker.on('failed', (job, err) => {
    logger.error(
      { jobId: job?.id, err: err instanceof Error ? err.message : err },
      'Memory extraction worker failed',
    );
  });

  return worker;
}

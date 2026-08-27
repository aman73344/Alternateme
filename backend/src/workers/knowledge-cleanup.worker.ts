import { Worker } from 'bullmq';
import { config } from '@/config';
import { logger } from '@/utils/logger';
import { QueueName } from '@/queues';
import { knowledgeCleanupService } from '@/knowledge/knowledge-cleanup.service';

const connection = { url: config.redis.url, maxRetriesPerRequest: null };

export interface KnowledgeCleanupJobData {
  sourceId: string;
  userId: string;
  alternateId: string;
}

/**
 * knowledge-cleanup.worker.ts — async phase-2 deletion. Soft-deletion already
 * removed knowledge from retrieval eligibility at the API layer; this worker
 * physically purges vectors + chunks for deleted sources off the request path.
 */
export function createKnowledgeCleanupWorker(): Worker {
  const worker = new Worker(
    QueueName.KNOWLEDGE_CLEANUP,
    async (job) => {
      const data = job.data as KnowledgeCleanupJobData;
      logger.info({ jobId: job.id, sourceId: data.sourceId }, 'Knowledge cleanup started');
      const result = await knowledgeCleanupService.purgeSourceData(data.sourceId);
      await knowledgeCleanupService.resetSourceCounts(data.sourceId);
      return result;
    },
    { connection, concurrency: config.queue.concurrency },
  );
  worker.on('completed', (job) => logger.info({ jobId: job.id }, 'Knowledge cleanup completed'));
  worker.on('failed', (job, err) => logger.error({ jobId: job?.id, err: err?.message }, 'Knowledge cleanup failed'));
  return worker;
}
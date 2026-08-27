import { Worker } from 'bullmq';
import { config } from '@/config';
import { logger } from '@/utils/logger';
import { QueueName } from '@/queues';
import { knowledgeIngestionQueue } from '@/queues';
import { prisma } from '@/database';
import type { IngestionJobData } from '@/knowledge/knowledge.types';

const connection = { url: config.redis.url, maxRetriesPerRequest: null };

/**
 * knowledge-retry.worker.ts — re-enqueues failed ingestion jobs whose error was
 * transient (isRetryable). Permanent errors are never retried automatically.
 */
export function createKnowledgeRetryWorker(): Worker {
  const worker = new Worker(
    QueueName.KNOWLEDGE_RETRY,
    async (job) => {
      const { ingestionJobId } = job.data as { ingestionJobId: string };
      const ingestionJob = await prisma.ingestionJob.findUnique({
        where: { id: ingestionJobId },
      });
      if (!ingestionJob) return { requeued: false };
      if (!ingestionJob.isRetryable) return { requeued: false };
      if (ingestionJob.attempts >= ingestionJob.maxAttempts) return { requeued: false };

      const queue = knowledgeIngestionQueue();
      if (!queue) {
        logger.warn({ ingestionJobId }, 'Redis unavailable; cannot requeue');
        return { requeued: false };
      }
      await queue.add(
        'ingest',
        {
          jobId: ingestionJobId,
          userId: ingestionJob.userId,
          alternateId: ingestionJob.alternateId,
          sourceId: ingestionJob.sourceId,
          version: ingestionJob.version,
        } satisfies IngestionJobData,
        { attempts: ingestionJob.maxAttempts, backoff: { type: 'exponential', delay: 2000 } },
      );
      await prisma.ingestionJob.update({
        where: { id: ingestionJobId },
        data: { status: 'RETRYING', stage: 'RETRYING' },
      });
      return { requeued: true };
    },
    { connection, concurrency: config.queue.concurrency },
  );
  worker.on('failed', (job, err) => logger.error({ jobId: job?.id, err: err?.message }, 'Knowledge retry failed'));
  return worker;
}
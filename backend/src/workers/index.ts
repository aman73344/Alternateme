import { Worker, ConnectionOptions } from 'bullmq';
import { config } from '@/config';
import { logger } from '@/utils/logger';
import { QueueName } from '@/queues';
import { registerExtractors } from '@/knowledge/extractors';
import { createKnowledgeIngestionWorker } from './knowledge-ingestion.worker';
import { createDocumentProcessingWorker } from './document-processing.worker';
import { createEmbeddingGenerationWorker } from './embedding-generation.worker';
import { createKnowledgeCleanupWorker } from './knowledge-cleanup.worker';
import { createKnowledgeRetryWorker } from './knowledge-retry.worker';

const connection: ConnectionOptions = {
  url: config.redis.url,
  maxRetriesPerRequest: null,
};

function createWorker(name: QueueName, processor: (job: unknown) => Promise<void>): Worker {
  const worker = new Worker(name, async (job) => {
    logger.info({ jobId: job.id, queue: name, data: job.data }, 'Processing job');
    await processor(job);
  }, { connection, concurrency: config.queue.concurrency });

  worker.on('completed', (job) => {
    logger.info({ jobId: job.id, queue: name }, 'Job completed');
  });

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, queue: name, err }, 'Job failed');
  });

  return worker;
}

export async function startWorkers(): Promise<void> {
  registerExtractors();
  const workers = [
    createWorker(QueueName.EMBEDDING, async () => {}),
    createWorker(QueueName.TRAINING, async () => {}),
    createWorker(QueueName.EMAIL, async () => {}),
    createWorker(QueueName.VOICE, async () => {}),
    createWorker(QueueName.ANALYTICS, async () => {}),
    createWorker(QueueName.CLEANUP, async () => {}),
    // Phase 3 knowledge pipeline workers
    createKnowledgeIngestionWorker(),
    createDocumentProcessingWorker(),
    createEmbeddingGenerationWorker(),
    createKnowledgeCleanupWorker(),
    createKnowledgeRetryWorker(),
  ];

  logger.info({ count: workers.length }, 'Workers started');

  process.on('SIGTERM', async () => {
    await Promise.all(workers.map((w) => w.close()));
    process.exit(0);
  });
}

if (require.main === module) {
  startWorkers().catch((err) => {
    logger.fatal({ err }, 'Failed to start workers');
    process.exit(1);
  });
}

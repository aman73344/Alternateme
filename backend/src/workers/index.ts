import { Worker, ConnectionOptions } from 'bullmq';
import { config } from '@/config';
import { logger } from '@/utils/logger';
import { QueueName } from '@/queues';

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
  const workers = [
    createWorker(QueueName.EMBEDDING, async () => {}),
    createWorker(QueueName.TRAINING, async () => {}),
    createWorker(QueueName.EMAIL, async () => {}),
    createWorker(QueueName.VOICE, async () => {}),
    createWorker(QueueName.ANALYTICS, async () => {}),
    createWorker(QueueName.CLEANUP, async () => {}),
  ];

  logger.info({ count: workers.length }, 'Workers started');

  process.on('SIGTERM', async () => {
    await Promise.all(workers.map((w) => w.close()));
  });
}

if (require.main === module) {
  startWorkers().catch((err) => {
    logger.fatal({ err }, 'Failed to start workers');
    process.exit(1);
  });
}

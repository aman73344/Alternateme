import { Queue, ConnectionOptions } from 'bullmq';
import { config } from '@/config';

const connection: ConnectionOptions = {
  url: config.redis.url,
  maxRetriesPerRequest: null,
};

export enum QueueName {
  EMBEDDING = 'embedding',
  TRAINING = 'training',
  EMAIL = 'email',
  VOICE = 'voice',
  ANALYTICS = 'analytics',
  CLEANUP = 'cleanup',
  RETRY = 'retry',
}

function createQueue(name: QueueName): Queue {
  return new Queue(name, {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: { age: 3600, count: 100 },
      removeOnFail: { age: 86400, count: 1000 },
    },
  });
}

export const embeddingQueue = createQueue(QueueName.EMBEDDING);
export const trainingQueue = createQueue(QueueName.TRAINING);
export const emailQueue = createQueue(QueueName.EMAIL);
export const voiceQueue = createQueue(QueueName.VOICE);
export const analyticsQueue = createQueue(QueueName.ANALYTICS);
export const cleanupQueue = createQueue(QueueName.CLEANUP);
export const retryQueue = createQueue(QueueName.RETRY);

export async function closeAllQueues(): Promise<void> {
  const queues = [
    embeddingQueue, trainingQueue, emailQueue,
    voiceQueue, analyticsQueue, cleanupQueue, retryQueue,
  ];
  await Promise.all(queues.map((q) => q.close()));
}

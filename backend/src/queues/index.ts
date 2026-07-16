import { Queue, ConnectionOptions } from 'bullmq';
import { config } from '@/config';
import { logger } from '@/utils/logger';

export enum QueueName {
  EMBEDDING = 'embedding',
  TRAINING = 'training',
  EMAIL = 'email',
  VOICE = 'voice',
  ANALYTICS = 'analytics',
  CLEANUP = 'cleanup',
  RETRY = 'retry',
}

// Completely lazy - no connection setup at module load time
const queues = new Map<string, Queue | null>();

function getConnection(): ConnectionOptions | undefined {
  try {
    return {
      url: config.redis.url,
      maxRetriesPerRequest: null,
      enableOfflineQueue: false,
      retryStrategy: () => null, // Don't retry - fail fast
    };
  } catch {
    logger.warn('Redis not configured, queues will be disabled');
    return undefined;
  }
}

function getQueue(name: QueueName): Queue | null {
  if (queues.has(name)) {
    return queues.get(name) || null;
  }
  
  const connection = getConnection();
  if (!connection) {
    queues.set(name, null);
    return null;
  }
  
  try {
    const queue = new Queue(name, {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: { age: 3600, count: 100 },
        removeOnFail: { age: 86400, count: 1000 },
      },
    });
    queues.set(name, queue);
    logger.info({ queue: name }, 'Queue created');
    return queue;
  } catch (err) {
    logger.warn({ err, queue: name }, 'Failed to create queue, disabling');
    queues.set(name, null);
    return null;
  }
}

// Export getter functions for lazy initialization
export const embeddingQueue = () => getQueue(QueueName.EMBEDDING);
export const trainingQueue = () => getQueue(QueueName.TRAINING);
export const emailQueue = () => getQueue(QueueName.EMAIL);
export const voiceQueue = () => getQueue(QueueName.VOICE);
export const analyticsQueue = () => getQueue(QueueName.ANALYTICS);
export const cleanupQueue = () => getQueue(QueueName.CLEANUP);
export const retryQueue = () => getQueue(QueueName.RETRY);

export async function closeAllQueues(): Promise<void> {
  const allQueues = Array.from(queues.values()).filter((q): q is Queue => q !== null);
  
  if (allQueues.length === 0) return;
  
  await Promise.all(allQueues.map((q) => q.close()));
  queues.clear();
}
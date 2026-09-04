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
  KNOWLEDGE_INGESTION = 'knowledge-ingestion',
  DOCUMENT_PROCESSING = 'document-processing',
  EMBEDDING_GENERATION = 'embedding-generation',
  KNOWLEDGE_CLEANUP = 'knowledge-cleanup',
  KNOWLEDGE_RETRY = 'knowledge-retry',
}

// Completely lazy - no connection setup at module load time
const queues = new Map<string, Queue | null>();

function getConnection(): ConnectionOptions | undefined {
  // Queues are fully disabled when explicitly turned off (hermetic test runs)
  // or when no Redis URL is configured. Callers treat null queues as "job is
  // persisted in the DB only" and never fail the request because of it.
  if (!config.redis.enabled) {
    return undefined;
  }
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
    // Without a listener, a dead/restarting Redis raises an unhandled 'error'
    // event that would crash the API/worker process. Degrade gracefully
    // instead: BullMQ retries the connection and jobs resume on recovery.
    queue.on('error', (err) => {
      logger.warn({ err, queue: name }, 'Queue connection error; processing resumes when Redis recovers');
    });
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
export const knowledgeIngestionQueue = () => getQueue(QueueName.KNOWLEDGE_INGESTION);
export const documentProcessingQueue = () => getQueue(QueueName.DOCUMENT_PROCESSING);
export const embeddingGenerationQueue = () => getQueue(QueueName.EMBEDDING_GENERATION);
export const knowledgeCleanupQueue = () => getQueue(QueueName.KNOWLEDGE_CLEANUP);
export const knowledgeRetryQueue = () => getQueue(QueueName.KNOWLEDGE_RETRY);

export async function closeAllQueues(): Promise<void> {
  const allQueues = Array.from(queues.values()).filter((q): q is Queue => q !== null);
  
  if (allQueues.length === 0) return;
  
  await Promise.all(allQueues.map((q) => q.close()));
  queues.clear();
}
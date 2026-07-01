import Redis from 'ioredis';
import { config } from '@/config';
import { logger } from '@/utils/logger';

class RedisManager {
  private client: Redis;
  private subscriber: Redis;

  constructor() {
    this.client = new Redis(config.redis.url, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => Math.min(times * 100, 3000),
      lazyConnect: true,
    });

    this.subscriber = new Redis(config.redis.url, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => Math.min(times * 100, 3000),
      lazyConnect: true,
    });
  }

  async connect(): Promise<void> {
    await Promise.all([this.client.connect(), this.subscriber.connect()]);
    logger.info('Redis connected');
  }

  getClient(): Redis {
    return this.client;
  }

  getSubscriber(): Redis {
    return this.subscriber;
  }

  async acquireLock(resource: string, ttlMs = 30000): Promise<boolean> {
    const result = await this.client.set(
      `lock:${resource}`,
      Date.now().toString(),
      'PX',
      ttlMs,
      'NX',
    );
    return result === 'OK';
  }

  async releaseLock(resource: string): Promise<void> {
    await this.client.del(`lock:${resource}`);
  }

  async disconnect(): Promise<void> {
    await Promise.all([this.client.quit(), this.subscriber.quit()]);
    logger.info('Redis disconnected');
  }
}

export const redis = new RedisManager();

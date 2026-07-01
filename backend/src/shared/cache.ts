import Redis from 'ioredis';
import { config } from '@/config';
import { logger } from '@/utils/logger';

class CacheManager {
  private client: Redis | null = null;
  private readonly prefix: string;

  constructor() {
    this.prefix = `${config.redis.prefix}:cache:`;
  }

  private getClient(): Redis {
    if (!this.client) {
      this.client = new Redis(config.redis.url, {
        lazyConnect: true,
        maxRetriesPerRequest: 3,
        retryStrategy: (times) => Math.min(times * 100, 3000),
      });

      this.client.on('error', (err) => {
        logger.error({ err }, 'Redis cache error');
      });

      this.client.on('connect', () => {
        logger.info('Redis cache connected');
      });
    }
    return this.client;
  }

  async connect(): Promise<void> {
    try {
      await this.getClient().connect();
    } catch (err) {
      logger.warn({ err }, 'Redis cache connection failed, running without cache');
    }
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.getClient().get(`${this.prefix}${key}`);
      return value ? JSON.parse(value) : null;
    } catch {
      return null;
    }
  }

  async set(key: string, value: unknown, ttlSeconds = 3600): Promise<void> {
    try {
      const serialized = JSON.stringify(value);
      await this.getClient().set(`${this.prefix}${key}`, serialized, 'EX', ttlSeconds);
    } catch (err) {
      logger.warn({ err, key }, 'Cache set failed');
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.getClient().del(`${this.prefix}${key}`);
    } catch {
      // silent
    }
  }

  async delPattern(pattern: string): Promise<void> {
    try {
      const keys = await this.getClient().keys(`${this.prefix}${pattern}`);
      if (keys.length > 0) {
        await this.getClient().del(...keys);
      }
    } catch {
      // silent
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.getClient().exists(`${this.prefix}${key}`);
      return result === 1;
    } catch {
      return false;
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.client = null;
    }
  }
}

export const cache = new CacheManager();

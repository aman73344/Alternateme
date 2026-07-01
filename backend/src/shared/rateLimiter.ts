import Redis from 'ioredis';
import { config } from '@/config';
import { RateLimitError } from '@/utils/errors';

class DistributedRateLimiter {
  private client: Redis | null = null;

  private getClient(): Redis {
    if (!this.client) {
      this.client = new Redis(config.redis.url, { lazyConnect: true });
    }
    return this.client;
  }

  async check(key: string, maxRequests: number, windowMs: number): Promise<void> {
    try {
      const client = this.getClient();
      const now = Date.now();
      const windowKey = `ratelimit:${key}:${Math.floor(now / windowMs)}`;

      const current = await client.incr(windowKey);
      if (current === 1) {
        await client.pexpire(windowKey, windowMs);
      }

      if (current > maxRequests) {
        throw new RateLimitError();
      }
    } catch (err) {
      if (err instanceof RateLimitError) throw err;
      // redis error - allow request to proceed
    }
  }
}

export const distributedRateLimiter = new DistributedRateLimiter();

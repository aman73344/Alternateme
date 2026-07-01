import { v4 as uuidv4, validate as uuidValidate } from 'uuid';
import { randomBytes, createCipheriv, createDecipheriv, createHash } from 'crypto';
import { config } from '@/config';

export const id = {
  generate: (): string => uuidv4(),
  isValid: (value: string): boolean => uuidValidate(value),
  short: (): string => randomBytes(4).toString('hex'),
};

export const date = {
  now: (): Date => new Date(),
  addDays: (date: Date, days: number): Date => {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  },
  addHours: (date: Date, hours: number): Date => {
    const result = new Date(date);
    result.setHours(result.getHours() + hours);
    return result;
  },
  diffInMs: (date1: Date, date2: Date): number => date1.getTime() - date2.getTime(),
  toISO: (date: Date): string => date.toISOString(),
};

export const encryption = {
  encrypt: (text: string): string => {
    const key = createHash('sha256').update(config.encryption.key).digest();
    const iv = randomBytes(16);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
  },

  decrypt: (encryptedText: string): string => {
    const key = createHash('sha256').update(config.encryption.key).digest();
    const parts = encryptedText.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  },
};

export const hash = {
  sha256: (data: string): string => createHash('sha256').update(data).digest('hex'),
  md5: (data: string): string => createHash('md5').update(data).digest('hex'),
};

export const pagination = {
  parse: (query: { page?: string; limit?: string }): { page: number; limit: number; skip: number } => {
    const page = Math.max(1, parseInt(query.page || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(query.limit || '10', 10)));
    const skip = (page - 1) * limit;
    return { page, limit, skip };
  },
};

export const retry = {
  execute: async <T>(
    fn: () => Promise<T>,
    options: { maxRetries?: number; baseDelay?: number; maxDelay?: number } = {},
  ): Promise<T> => {
    const { maxRetries = 3, baseDelay = 1000, maxDelay = 10000 } = options;
    let attempt = 0;
    while (true) {
      try {
        return await fn();
      } catch (error) {
        attempt++;
        if (attempt >= maxRetries) throw error;
        const delay = Math.min(baseDelay * Math.pow(2, attempt - 1) + Math.random() * 1000, maxDelay);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  },
};

export const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

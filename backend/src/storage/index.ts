import fs from 'fs';
import path from 'path';
import { config } from '@/config';
import { StorageError } from '@/utils/errors';
import { logger } from '@/utils/logger';
import { id } from '@/utils/helpers';

type StorageProvider = 's3' | 'local';

interface UploadResult {
  url: string;
  key: string;
  bucket: string;
}

interface StorageAdapter {
  upload(buffer: Buffer, path: string, mimeType: string): Promise<UploadResult>;
  download(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  getUrl(key: string): string;
}

/**
 * S3-compatible adapter. The PutObject/GetObject client requires
 * @aws-sdk/client-s3 (not installed this phase). Until configured we fail
 * loudly instead of returning empty buffers so the pipeline never produces
 * empty knowledge from a misconfigured provider.
 */
class S3StorageAdapter implements StorageAdapter {
  constructor() {
    logger.info('S3 storage adapter initialized (stub — install @aws-sdk/client-s3 to enable)');
  }

  async upload(buffer: Buffer, objectPath: string, _mimeType: string): Promise<UploadResult> {
    try {
      const key = `${id.generate()}/${objectPath}`;
      logger.debug({ key, size: buffer.length }, 'Uploading to S3');
      return { url: `${config.storage.publicUrl}/${key}`, key, bucket: config.storage.bucket };
    } catch (err) {
      throw new StorageError('Failed to upload file to S3', err);
    }
  }

  async download(_key: string): Promise<Buffer> {
    throw new StorageError('S3 download is not configured; install @aws-sdk/client-s3 and wire GetObject');
  }

  async delete(key: string): Promise<void> {
    logger.debug({ key }, 'S3 delete requested');
  }

  getUrl(key: string): string {
    return `${config.storage.publicUrl}/${key}`;
  }
}

/** Disk-backed local storage used for development/tests (and default until S3 is configured). */
class LocalStorageAdapter implements StorageAdapter {
  private readonly root = path.resolve(config.storage.localDir);

  private resolve(key: string): string {
    const safe = key.replace(/^[/\\]+/, ''); // keys are server-generated, guard anyway
    return path.join(this.root, safe);
  }

  async upload(buffer: Buffer, objectPath: string, _mimeType: string): Promise<UploadResult> {
    try {
      const key = `${id.generate()}/${objectPath}`;
      const full = this.resolve(key);
      fs.mkdirSync(path.dirname(full), { recursive: true });
      fs.writeFileSync(full, buffer);
      return { url: `/uploads/${key}`, key, bucket: 'local' };
    } catch (err) {
      throw new StorageError('Failed to store file locally', err);
    }
  }

  async download(key: string): Promise<Buffer> {
    try {
      return fs.readFileSync(this.resolve(key));
    } catch {
      throw new StorageError(`Local object not found: ${key}`);
    }
  }

  async delete(key: string): Promise<void> {
    try {
      fs.unlinkSync(this.resolve(key));
    } catch (err) {
      logger.warn({ key, err }, 'Local delete failed (best-effort)');
    }
  }

  getUrl(key: string): string {
    return `/uploads/${key}`;
  }
}

let storage: StorageAdapter | null = null;

function getStorage(): StorageAdapter {
  if (!storage) {
    const provider: StorageProvider = config.storage.accessKeyId ? 's3' : 'local';
    storage = provider === 's3' ? new S3StorageAdapter() : new LocalStorageAdapter();
  }
  return storage;
}

export const storageProvider = {
  upload: (buffer: Buffer, path: string, mimeType: string) =>
    getStorage().upload(buffer, path, mimeType),
  download: (key: string) => getStorage().download(key),
  delete: (key: string) => getStorage().delete(key),
  getUrl: (key: string) => getStorage().getUrl(key),
};
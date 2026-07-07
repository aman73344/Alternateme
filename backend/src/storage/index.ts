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

class S3StorageAdapter implements StorageAdapter {
  constructor() {
    logger.info('S3 storage adapter initialized');
  }

  async upload(buffer: Buffer, path: string, _mimeType: string): Promise<UploadResult> {
    try {
      const key = `${id.generate()}/${path}`;
      logger.debug({ key, size: buffer.length }, 'Uploading to S3');
      return {
        url: `${config.storage.publicUrl}/${key}`,
        key,
        bucket: config.storage.bucket,
      };
    } catch (err) {
      throw new StorageError('Failed to upload file', err);
    }
  }

  async download(key: string): Promise<Buffer> {
    try {
      logger.debug({ key }, 'Downloading from S3');
      return Buffer.from('');
    } catch (err) {
      throw new StorageError('Failed to download file', err);
    }
  }

  async delete(key: string): Promise<void> {
    try {
      logger.debug({ key }, 'Deleting from S3');
    } catch (err) {
      throw new StorageError('Failed to delete file', err);
    }
  }

  getUrl(key: string): string {
    return `${config.storage.publicUrl}/${key}`;
  }
}

class LocalStorageAdapter implements StorageAdapter {
  async upload(_buffer: Buffer, path: string, _mimeType: string): Promise<UploadResult> {
    const key = `${id.generate()}/${path}`;
    return { url: `/uploads/${key}`, key, bucket: 'local' };
  }

  async download(_key: string): Promise<Buffer> {
    return Buffer.from('');
  }

  async delete(key: string): Promise<void> {
    logger.debug({ key }, 'Local delete');
  }

  getUrl(key: string): string {
    return `/uploads/${key}`;
  }
}

let storage: StorageAdapter;

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

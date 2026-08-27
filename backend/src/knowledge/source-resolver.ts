import { storageProvider } from '@/storage';
import { fetchUrl } from './url-fetcher';
import { logger } from '@/utils/logger';
import { KnowledgeError } from './knowledge.errors';
import type { ExtractSource, SourceTypeFlat } from './extractors/extractor';
import { getYouTubeVideoId } from './extractors';

export type ResolvedSource = ExtractSource;

/**
 * SourceResolver — turns a persistent TrainingSource into the normalized
 * ExtractSource the extractors understand. Responsibilities:
 *  - file-like sources: download the object from the Phase-0 storage
 *    abstraction (S3-compatible or local) by storageKey;
 *  - URL sources: SSRF-safe fetch via fetchUrl;
 *  - YouTube: parse the id (transcript is fetched by the extractor);
 *  - LinkedIn/OTHER: pass through with no scraping.
 */
export class SourceResolver {
  async resolve(source: {
    id: string;
    type: string;
    name?: string | null;
    url?: string | null;
    fileName?: string | null;
    mimeType?: string | null;
    storageKey?: string | null;
    metadata?: unknown;
  }): Promise<ResolvedSource> {
    const extra = (source.metadata || {}) as Record<string, unknown>;

    // FILE: pull from object storage. Never done in the API request path —
    // only inside the worker.
    if (source.type === 'FILE') {
      if (!source.storageKey) {
        throw new KnowledgeError('EXTRACTION_FAILED', { sourceId: source.id }, 'File source has no stored object');
      }
      let buffer: Buffer;
      try {
        buffer = await storageProvider.download(source.storageKey);
      } catch (err) {
        logger.warn({ err, storageKey: source.storageKey }, 'Download from storage failed');
        throw new KnowledgeError('EXTRACTION_FAILED', { sourceId: source.id }, 'Could not read the stored file');
      }
      return {
        type: 'FILE',
        name: source.name ?? source.fileName ?? undefined,
        url: source.url ?? undefined,
        fileName: source.fileName ?? undefined,
        mimeType: source.mimeType ?? undefined,
        buffer,
        sourceId: source.id,
        metadata: extra,
      };
    }

    // URL — validate + SSRF-safe fetch with redirect re-validation.
    if (source.type === 'URL') {
      if (!source.url) {
        throw new KnowledgeError('INVALID_URL', { sourceId: source.id }, 'URL source is missing its URL');
      }
      const fetched = await fetchUrl(source.url);
      return {
        type: 'URL',
        name: source.name ?? undefined,
        url: fetched.url,
        fileName: source.fileName ?? undefined,
        mimeType: fetched.contentType,
        buffer: fetched.buffer,
        sourceId: source.id,
        metadata: { ...extra, finalUrl: fetched.url },
      };
    }

    // YouTube — only identify the id; the extractor fetches the transcript.
    if (source.type === 'YOUTUBE') {
      return {
        type: 'YOUTUBE',
        name: source.name ?? undefined,
        url: source.url ?? undefined,
        sourceId: source.id,
        metadata: { ...extra, videoId: source.url ? getYouTubeVideoId(source.url) : undefined },
      };
    }

    // LinkedIn / OTHER — pass through (LinkedIn extractor refuses to scrape).
    return {
      type: source.type as SourceTypeFlat,
      name: source.name ?? undefined,
      url: source.url ?? undefined,
      fileName: source.fileName ?? undefined,
      mimeType: source.mimeType ?? undefined,
      sourceId: source.id,
      metadata: extra,
    };
  }
}

export const sourceResolver = new SourceResolver();
import { YoutubeTranscript } from 'youtube-transcript';
import { KnowledgeError } from '../knowledge.errors';
import { logger } from '@/utils/logger';
import type { DocumentExtractor, ExtractSource } from './extractor';
import { isYoutubeSource } from './extractor';
import type { ExtractionResult } from '../knowledge.types';

const YT_ID_RE =
  /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|v\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/;

export function getYouTubeVideoId(url?: string): string | null {
  if (!url) return null;
  const match = url.match(YT_ID_RE);
  return match ? match[1] : null;
}

interface OEmbedResult {
  title?: string;
  author_name?: string;
  channel_id?: string;
  thumbnail_url?: string;
}

/**
 * Fetch public video metadata via YouTube's official oEmbed endpoint (a
 * compliant, key-less public API). Returns null on any failure so transcript
 * processing can proceed without it.
 */
export async function fetchYoutubeMetadata(videoId: string): Promise<OEmbedResult | null> {
  const oembedUrl = `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}`;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(oembedUrl, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    return (await res.json()) as OEmbedResult;
  } catch {
    return null;
  }
}

/**
 * YoutubeExtractor — extracts the public transcript/captions when legitimately
 * available. We never bypass access restrictions or invent transcripts: if no
 * captions exist the extractor throws YOUTUBE_TRANSCRIPT_UNAVAILABLE and the
 * pipeline marks the source accordingly. Adoption of an official YouTube Data
 * API upload-capable adapter can replace this without touching callers.
 */
export class YoutubeExtractor implements DocumentExtractor {
  readonly id = 'youtube';

  supports(source: ExtractSource): boolean {
    return isYoutubeSource(source) || source.type === 'YOUTUBE';
  }

  async extract(source: ExtractSource): Promise<ExtractionResult> {
    const videoId = getYouTubeVideoId(source.url || '') || (source.metadata?.videoId as string);

    if (!videoId) {
      throw new KnowledgeError('INVALID_URL', undefined, 'Unable to determine YouTube video id');
    }

    const meta = await fetchYoutubeMetadata(videoId);

    try {
      const transcriptList = await YoutubeTranscript.fetchTranscript(videoId);
      if (!transcriptList || transcriptList.length === 0) {
        throw new KnowledgeError('YOUTUBE_TRANSCRIPT_UNAVAILABLE', { videoId });
      }

      const lines = transcriptList.map((entry) => {
        const seconds = Math.floor((entry.offset || 0) / 1000);
        const hh = Math.floor(seconds / 3600);
        const mm = Math.floor((seconds % 3600) / 60);
        const ss = seconds % 60;
        const stamp = hh > 0 ? `${hh}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}` : `${mm}:${String(ss).padStart(2, '0')}`;
        return `[${stamp}] ${(entry.text || '').trim()}`;
      });

      const content = lines.join('\n');
      if (!content.trim()) {
        throw new KnowledgeError('YOUTUBE_TRANSCRIPT_UNAVAILABLE', { videoId });
      }

      return {
        title: meta?.title || source.name || `YouTube: ${videoId}`,
        content,
        mimeType: 'text/plain',
        language: (transcriptList[0] as { lang?: string })?.lang || 'en',
        sourceUrl: source.url || `https://www.youtube.com/watch?v=${videoId}`,
        metadata: {
          extractor: this.id,
          sourceType: 'YOUTUBE',
          videoId,
          channel: meta?.author_name,
          thumbnailUrl: meta?.thumbnail_url,
          hasTimestamps: true,
          publishedDate: undefined,
        },
      };
    } catch (err) {
      if (err instanceof KnowledgeError) throw err;
      logger.warn({ err, videoId }, 'YouTube transcript unavailable');
      throw new KnowledgeError('YOUTUBE_TRANSCRIPT_UNAVAILABLE', { videoId });
    }
  }
}
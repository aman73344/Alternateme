import type { ExtractionResult } from '../knowledge.types';

export type SourceTypeFlat = 'FILE' | 'URL' | 'LINKEDIN' | 'YOUTUBE' | 'OTHER';

/**
 * The normalized input handed to an extractor. `buffer` carries the raw bytes
 * for file-like sources (downloaded objects / fetched URL bodies); `url` and
 * metadata carry enough context for URL/YouTube/LinkedIn adapters.
 */
export interface ExtractSource {
  type: SourceTypeFlat;
  name?: string;
  url?: string;
  fileName?: string;
  mimeType?: string;
  buffer?: Buffer;
  sourceId?: string;
  metadata?: Record<string, unknown>;
}

export interface DocumentExtractor {
  readonly id: string;
  supports(source: ExtractSource): boolean;
  extract(source: ExtractSource): Promise<ExtractionResult>;
}

export function isPdfSource(source: ExtractSource): boolean {
  const mime = (source.mimeType || '').toLowerCase();
  const name = (source.fileName || source.name || '').toLowerCase();
  return mime.includes('pdf') || name.endsWith('.pdf');
}

export function isDocxSource(source: ExtractSource): boolean {
  const mime = (source.mimeType || '').toLowerCase();
  const name = (source.fileName || source.name || '').toLowerCase();
  return mime.includes('wordprocessingml') || name.endsWith('.docx');
}

export function isPlainTextSource(source: ExtractSource): boolean {
  const mime = (source.mimeType || '').toLowerCase();
  const name = (source.fileName || source.name || '').toLowerCase();
  return (
    mime.startsWith('text/plain') ||
    name.endsWith('.txt') ||
    name.endsWith('.text')
  );
}

export function isMarkdownSource(source: ExtractSource): boolean {
  const mime = (source.mimeType || '').toLowerCase();
  const name = (source.fileName || source.name || '').toLowerCase();
  return (
    mime.includes('markdown') ||
    mime.includes('md') ||
    name.endsWith('.md') ||
    name.endsWith('.markdown') ||
    name.endsWith('.mdown')
  );
}

export function isHtmlSource(source: ExtractSource): boolean {
  const mime = (source.mimeType || '').toLowerCase();
  const name = (source.fileName || source.name || '').toLowerCase();
  return mime.includes('html') || mime.includes('xhtml') || name.endsWith('.html') || name.endsWith('.htm');
}

export function isYoutubeSource(source: ExtractSource): boolean {
  return source.type === 'YOUTUBE' || (!!source.url && /(youtube\.com|youtu\.be)/i.test(source.url));
}
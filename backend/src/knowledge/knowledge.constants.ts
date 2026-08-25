/**
 * Knowledge ingestion shared constants and helpers.
 * File-format detection (extension + MIME + magic bytes) lives here so it can
 * be reused by the validators, the extractor resolver, and the exporter of
 * supported-source metadata without duplicating rules.
 */

// Split into TWO files (extraction + ing available) — see knowledge.types.ts.
export type SourceKind = 'FILE' | 'URL' | 'LINKEDIN' | 'YOUTUBE' | 'OTHER';

export interface FileProfile {
  mimeType: string;
  extension: string[];
  kind: 'PDF' | 'DOCX' | 'TXT' | 'MARKDOWN' | 'OTHER';
  extractor: 'pdf' | 'docx' | 'text' | 'markdown';
}

// The extractor that should handle a given set of MIME types / extensions.
export const FILE_PROFILES: FileProfile[] = [
  {
    mimeType: 'application/pdf',
    extension: ['.pdf'],
    kind: 'PDF',
    extractor: 'pdf',
  },
  {
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    extension: ['.docx'],
    kind: 'DOCX',
    extractor: 'docx',
  },
  {
    mimeType: 'text/plain',
    extension: ['.txt', '.text'],
    kind: 'TXT',
    extractor: 'text',
  },
  {
    mimeType: 'text/markdown',
    extension: ['.md', '.markdown', '.mdown'],
    kind: 'MARKDOWN',
    extractor: 'markdown',
  },
];

// Sanity threshold: below this many characters a plain (non-scanned) PDF is
// presumed to be image-only and therefore requires OCR to be useful.
export const OCR_TEXT_THRESHOLD_CHARS = 30;

export const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB (base config default)
export const MAX_DOCUMENT_SIZE = 15 * 1024 * 1024; // 15 MB extracted text cap

export const MAGIC_BYTES: Array<{ mimeType: string; matches: (b: Uint8Array) => boolean }> = [
  {
    mimeType: 'application/pdf',
    matches: (b) => b.length > 4 && b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46,
  },
  {
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    matches: (b) =>
      b.length > 4 &&
      b[0] === 0x50 &&
      b[1] === 0x4b && // 'PK' — ZIP container used by DOCX
      b[2] === 0x03 &&
      b[3] === 0x04,
  },
];

export function detectMagicMime(buffer: Uint8Array): string | null {
  for (const probe of MAGIC_BYTES) {
    if (probe.matches(buffer)) return probe.mimeType;
  }
  return null;
}

export function getFileProfile(mimeType: string | null | undefined, fileName?: string): FileProfile | null {
  const ext = fileName ? getExtension(fileName) : '';
  const byMime = mimeType ? FILE_PROFILES.find((p) => p.mimeType === mimeType) : undefined;
  const byExt =
    ext && ext.length ? FILE_PROFILES.find((p) => p.extension.includes(ext)) : undefined;
  return byMime || byExt || null;
}

export function getExtension(fileName: string): string {
  const idx = fileName.lastIndexOf('.');
  return idx >= 0 ? fileName.slice(idx).toLowerCase() : '';
}
import { createHash } from 'crypto';
import { config } from '@/config';
import { KnowledgeError } from './knowledge.errors';
import { detectMagicMime, getFileProfile } from './knowledge.constants';

export interface FileValidationResult {
  mimeType: string;
  profile: NonNullable<ReturnType<typeof getFileProfile>>;
  size: number;
  checksum: string;
  extension: string;
}

const DANGEROUS_MAGIC = [
  { label: 'PE/Executable', fn: (b: Uint8Array) => b.length > 1 && b[0] === 0x4d && b[1] === 0x5a }, // MZ
  { label: 'ELF', fn: (b: Uint8Array) => b.length > 3 && b[0] === 0x7f && b[1] === 0x45 && b[2] === 0x4c && b[3] === 0x46 },
  { label: 'Shell script', fn: (b: Uint8Array) => b.length > 2 && b[0] === 0x23 && b[1] === 0x21 }, // #!
];

function looksDangerous(buffer: Uint8Array): string | null {
  for (const probe of DANGEROUS_MAGIC) {
    if (probe.fn(buffer)) return probe.label;
  }
  return null;
}

/**
 * File validation before ingestion: MIME type, extension, size, magic bytes
 * and path-traversal-safe names. Never trusts the filename alone. Prevents
 * zip-bombs/executables/malformed uploads from entering the pipeline.
 */
export function validateUploadedFile(buffer: Buffer, fileName?: string, claimedMime?: string): FileValidationResult {
  const maxSize = config.knowledge.file.maxFileSize;
  if (buffer.length === 0) {
    throw new KnowledgeError('EMPTY_DOCUMENT', { fileName });
  }
  if (buffer.length > maxSize) {
    throw new KnowledgeError('FILE_TOO_LARGE', { fileName, size: buffer.length });
  }

  if (fileName) {
    const base = fileName.split(/[\\/]/).pop() || fileName;
    if (base !== fileName || fileName.includes('..') || base.startsWith('.')) {
      throw new KnowledgeError('UNSUPPORTED_FILE_TYPE', { fileName }, 'File name is not allowed');
    }
  }

  const dangerous = looksDangerous(new Uint8Array(buffer.subarray(0, 64)));
  if (dangerous) {
    throw new KnowledgeError('UNSUPPORTED_FILE_TYPE', { fileName, kind: dangerous });
  }

  const magicMime = detectMagicMime(new Uint8Array(buffer.subarray(0, 64)));
  const effectiveMime = magicMime || (claimedMime && !claimedMime.startsWith('application/octet-stream') ? claimedMime : undefined);
  const profile = getFileProfile(effectiveMime, fileName);

  if (!profile) {
    throw new KnowledgeError('UNSUPPORTED_FILE_TYPE', { fileName, claimedMime: effectiveMime });
  }

  // Claimed MIME must not contradict magic bytes for container formats.
  if (magicMime && profile.mimeType !== magicMime) {
    throw new KnowledgeError('UNSUPPORTED_FILE_TYPE', { fileName, magicMime, profileMime: profile.mimeType });
  }

  return {
    mimeType: profile.mimeType,
    profile,
    size: buffer.length,
    checksum: hashBuffer(buffer),
    extension: getFileProfileExtension(fileName, profile.mimeType),
  };
}

function getFileProfileExtension(fileName: string | undefined, mimeType: string): string {
  if (fileName && fileName.lastIndexOf('.') >= 0) {
    return fileName.slice(fileName.lastIndexOf('.')).toLowerCase();
  }
  return mimeType === 'application/pdf' ? '.pdf' : mimeType.includes('word') ? '.docx' : '.txt';
}

export function hashBuffer(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}
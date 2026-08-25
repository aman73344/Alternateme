import { BaseError } from '@/utils/errors';
import httpStatus from 'http-status';

export interface KnowledgeErrorSpec {
  code: string;
  httpStatus: number;
  isRetryable: boolean;
  message: string; // internal diagnostic-facing message (never a stack trace)
  safeMessage: string; // safe user-facing message (no internals)
}

export const KNOWLEDGE_ERRORS: Record<string, KnowledgeErrorSpec> = {
  UNSUPPORTED_FILE_TYPE: {
    code: 'UNSUPPORTED_FILE_TYPE',
    httpStatus: httpStatus.UNPROCESSABLE_ENTITY,
    isRetryable: false,
    message: 'The uploaded file type is not supported for ingestion',
    safeMessage: 'This file type is not supported. Please upload a PDF, DOCX, TXT or Markdown file.',
  },
  FILE_TOO_LARGE: {
    code: 'FILE_TOO_LARGE',
    httpStatus: httpStatus.UNPROCESSABLE_ENTITY,
    isRetryable: false,
    message: 'The uploaded file exceeds the configured size limit',
    safeMessage: 'This file is too large to process.',
  },
  CORRUPT_DOCUMENT: {
    code: 'CORRUPT_DOCUMENT',
    httpStatus: httpStatus.UNPROCESSABLE_ENTITY,
    isRetryable: false,
    message: 'The document could not be parsed because it appears to be corrupted',
    safeMessage: 'This document is corrupted and could not be read.',
  },
  EMPTY_DOCUMENT: {
    code: 'EMPTY_DOCUMENT',
    httpStatus: httpStatus.UNPROCESSABLE_ENTITY,
    isRetryable: false,
    message: 'No extractable text was found in the source',
    safeMessage: 'No readable text was found in this source.',
  },
  URL_BLOCKED: {
    code: 'URL_BLOCKED',
    httpStatus: httpStatus.UNPROCESSABLE_ENTITY,
    isRetryable: false,
    message: 'The URL was blocked by ingestion policy',
    safeMessage: 'This web address could not be ingested.',
  },
  SSRF_BLOCKED: {
    code: 'SSRF_BLOCKED',
    httpStatus: httpStatus.UNPROCESSABLE_ENTITY,
    isRetryable: false,
    message: 'The URL resolved to a private or disallowed address',
    safeMessage: 'This web address could not be ingested.',
  },
  FETCH_TIMEOUT: {
    code: 'FETCH_TIMEOUT',
    httpStatus: httpStatus.BAD_GATEWAY,
    isRetryable: true,
    message: 'Fetching the source timed out',
    safeMessage: 'That source took too long to load and will be retried.',
  },
  FETCH_FAILED: {
    code: 'FETCH_FAILED',
    httpStatus: httpStatus.BAD_GATEWAY,
    isRetryable: true,
    message: 'Failed to fetch the source over the network',
    safeMessage: 'The source could not be downloaded.',
  },
  CONTENT_TOO_LARGE: {
    code: 'CONTENT_TOO_LARGE',
    httpStatus: httpStatus.UNPROCESSABLE_ENTITY,
    isRetryable: false,
    message: 'The fetched content exceeded the configured response size limit',
    safeMessage: 'This source is too large to process.',
  },
  INVALID_URL: {
    code: 'INVALID_URL',
    httpStatus: httpStatus.UNPROCESSABLE_ENTITY,
    isRetryable: false,
    message: 'The URL is not valid or not ingestible',
    safeMessage: 'This web address is not valid.',
  },
  EXTRACTION_FAILED: {
    code: 'EXTRACTION_FAILED',
    httpStatus: httpStatus.INTERNAL_SERVER_ERROR,
    isRetryable: true,
    message: 'Text extraction failed for the source',
    safeMessage: 'We could not read this source.',
  },
  OCR_REQUIRED: {
    code: 'OCR_REQUIRED',
    httpStatus: httpStatus.UNPROCESSABLE_ENTITY,
    isRetryable: false,
    message: 'The document appears to be scanned and text extraction requires OCR',
    safeMessage: 'This appears to be a scanned document. OCR is not enabled.',
  },
  CHUNKING_FAILED: {
    code: 'CHUNKING_FAILED',
    httpStatus: httpStatus.INTERNAL_SERVER_ERROR,
    isRetryable: true,
    message: 'Chunking the extracted content failed',
    safeMessage: 'We could not split this source into readable pieces.',
  },
  EMBEDDING_FAILED: {
    code: 'EMBEDDING_FAILED',
    httpStatus: httpStatus.INTERNAL_SERVER_ERROR,
    isRetryable: true,
    message: 'Generating or storing embeddings failed',
    safeMessage: 'We could not index this source.',
  },
  EMBEDDING_PROVIDER_ERROR: {
    code: 'EMBEDDING_PROVIDER_ERROR',
    httpStatus: httpStatus.BAD_GATEWAY,
    isRetryable: true,
    message: 'The embedding provider returned an error',
    safeMessage: 'The embedding service is unavailable. The source will be retried.',
  },
  YOUTUBE_TRANSCRIPT_UNAVAILABLE: {
    code: 'YOUTUBE_TRANSCRIPT_UNAVAILABLE',
    httpStatus: httpStatus.UNPROCESSABLE_ENTITY,
    isRetryable: false,
    message: 'No publicly available transcript was found for the YouTube video',
    safeMessage: 'No transcript is available for this video, or access is restricted.',
  },
  LINKEDIN_ACCESS_UNAVAILABLE: {
    code: 'LINKEDIN_ACCESS_UNAVAILABLE',
    httpStatus: httpStatus.UNPROCESSABLE_ENTITY,
    isRetryable: false,
    message: 'LinkedIn content cannot be retrieved without authorization',
    safeMessage: 'This LinkedIn source is not publicly accessible.',
  },
  SOURCE_NOT_FOUND: {
    code: 'SOURCE_NOT_FOUND',
    httpStatus: httpStatus.NOT_FOUND,
    isRetryable: false,
    message: 'The source does not exist or is not accessible',
    safeMessage: 'Source not found.',
  },
  IDEMPOTENT_SKIP: {
    code: 'IDEMPOTENT_SKIP',
    httpStatus: httpStatus.OK,
    isRetryable: false,
    message: 'Content unchanged since last successful ingest',
    safeMessage: 'This source has not changed.',
  },
};

export class KnowledgeError extends BaseError {
  public readonly isRetryable: boolean;
  public readonly safeMessage: string;

  constructor(code: string, detail?: unknown, overrideMessage?: string) {
    const spec: KnowledgeErrorSpec =
      KNOWLEDGE_ERRORS[code] || KNOWLEDGE_ERRORS.EXTRACTION_FAILED;
    super(overrideMessage || spec.message, spec.httpStatus, spec.code, spec.isRetryable, detail);
    this.isRetryable = spec.isRetryable;
    this.safeMessage = overrideMessage || spec.safeMessage;
  }

  static from(code: string, detail?: unknown, overrideMessage?: string): KnowledgeError {
    return new KnowledgeError(code, detail, overrideMessage);
  }
}
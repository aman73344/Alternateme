/**
 * Memory Policy — validation and safety rules
 *
 * Enforces write policy: determines if a piece of information should be persisted as a memory.
 */

import { SECRET_PATTERNS, MEMORY_DEFAULTS } from './memory.constants';
import { MemoryType, MemorySourceType, MemoryVisibility, MemoryStatus } from './memory.types';
import { ValidationError } from '@/utils/errors';

/**
 * Secret detection result
 */
export interface SecretDetectionResult {
  isSensitive: boolean;
  matchedPattern?: string;
  redactedContent?: string;
  confidence: number;
}

/**
 * Validate that content is safe to store as a memory.
 * Rejects secrets, credentials, and other sensitive information.
 */
export function detectSecrets(content: string): SecretDetectionResult {
  for (const pattern of SECRET_PATTERNS) {
    const match = content.match(pattern);
    if (match) {
      // Redact for logging/safe storage
      const redacted = content.replace(pattern, '[REDACTED]');
      return {
        isSensitive: true,
        matchedPattern: match[0].substring(0, 50),
        redactedContent: redacted,
        confidence: 0.95,
      };
    }
  }

  return {
    isSensitive: false,
    confidence: 1.0,
  };
}

/**
 * Check if a memory type is valid
 */
export function isValidMemoryType(type: string): boolean {
  return Object.values(MemoryType).includes(type as MemoryType);
}

/**
 * Check if a memory source type is valid
 */
export function isValidSourceType(sourceType: string): boolean {
  return Object.values(MemorySourceType).includes(sourceType as MemorySourceType);
}

/**
 * Check if a memory status is valid
 */
export function isValidMemoryStatus(status: string): boolean {
  return Object.values(MemoryStatus).includes(status as MemoryStatus);
}

/**
 * Check if memory visibility is valid
 */
export function isValidVisibility(visibility: string): boolean {
  return Object.values(MemoryVisibility).includes(visibility as MemoryVisibility);
}

/**
 * Validate content length
 */
export function validateContentLength(content: string): void {
  const trimmed = content.trim();
  if (trimmed.length === 0) {
    throw new ValidationError('Memory content cannot be empty');
  }
  if (trimmed.length > MEMORY_DEFAULTS.MAX_CONTENT_LENGTH) {
    throw new ValidationError(
      `Memory content exceeds maximum length of ${MEMORY_DEFAULTS.MAX_CONTENT_LENGTH} characters`,
    );
  }
}

/**
 * Validate importance score
 */
export function validateImportance(importance: number): void {
  if (importance < 0 || importance > 1) {
    throw new ValidationError('Importance must be between 0.0 and 1.0');
  }
}

/**
 * Validate confidence score
 */
export function validateConfidence(confidence: number): void {
  if (confidence < 0 || confidence > 1) {
    throw new ValidationError('Confidence must be between 0.0 and 1.0');
  }
}

/**
 * Memory write policy — determines if a memory should be written.
 * Returns false if the memory should be skipped.
 */
export function evaluateWritePolicy(params: {
  content: string;
  importance: number;
  confidence: number;
  type: MemoryType;
  sourceType: MemorySourceType;
}): { shouldWrite: boolean; reason?: string } {
  // Never store secrets
  const secretCheck = detectSecrets(params.content);
  if (secretCheck.isSensitive) {
    return {
      shouldWrite: false,
      reason: 'Content contains sensitive information (secrets, credentials, etc.)',
    };
  }

  // Skip low-confidence inferred memories
  if (params.sourceType === MemorySourceType.INFERRED && params.confidence < 0.6) {
    return {
      shouldWrite: false,
      reason: 'Inferred memory confidence below threshold',
    };
  }

  // Skip low-importance memories (one-off remarks, jokes, etc.)
  if (params.importance < 0.3) {
    return {
      shouldWrite: false,
      reason: 'Importance below threshold',
    };
  }

  // Skip empty content
  if (params.content.trim().length === 0) {
    return {
      shouldWrite: false,
      reason: 'Empty content',
    };
  }

  return { shouldWrite: true };
}

/**
 * Normalize content for deduplication.
 * Lowercase, trim, remove extra whitespace, strip common punctuation.
 */
export function normalizeContent(content: string): string {
  return content
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[.,;:!?]+/g, '')
    .replace(/\b(the|a|an)\b/g, '')
    .trim();
}

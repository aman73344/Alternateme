/**
 * Retry Policy
 *
 * Only transient classes are retried, and only with bounded exponential
 * backoff. Terminal classes (INVALID_INPUT, UNAUTHORIZED, FORBIDDEN,
 * NOT_FOUND, POLICY_DENIED, APPROVAL_REJECTED, PERMANENT_FAILURE) are never
 * retried — retrying them would burn budget and, for denials, look like an
 * attempt to bypass a decision.
 */

import { AGENT_DEFAULTS } from '../agent.constants';
import { AgentError } from '../agent.errors';

/** Error codes that are safe to retry even when they arrive as a generic error. */
const RETRYABLE_CODES = new Set([
  'TIMEOUT',
  'TEMPORARY_PROVIDER_FAILURE',
  'NETWORK_ERROR',
  'RATE_LIMITED',
  'ECONNRESET',
  'ETIMEDOUT',
  'EAI_AGAIN',
  'TOOL_TIMEOUT',
  'AGENT_TIMEOUT',
  'AGENT_PROVIDER_UNAVAILABLE',
  'AGENT_RATE_LIMITED',
  'AI_ERROR',
  'PROVIDER_ERROR',
]);

/** Error codes that must never be retried, regardless of classification above. */
const TERMINAL_CODES = new Set([
  'INVALID_INPUT',
  'TOOL_INVALID_INPUT',
  'UNAUTHORIZED',
  'AUTHORIZATION_ERROR',
  'FORBIDDEN',
  'TOOL_NOT_ALLOWED',
  'TOOL_DISABLED',
  'TOOL_NOT_FOUND',
  'NOT_FOUND',
  'POLICY_DENIED',
  'TOOL_APPROVAL_REJECTED',
  'TOOL_APPROVAL_EXPIRED',
  'PERMANENT_FAILURE',
  'AGENT_MAX_STEPS',
  'AGENT_MAX_TOOL_CALLS',
  'AGENT_CONTEXT_LIMIT',
]);

export function isRetryable(error: unknown): boolean {
  const code = extractCode(error);
  if (code && TERMINAL_CODES.has(code)) return false;
  if (code && RETRYABLE_CODES.has(code)) return true;
  return AgentError.isRetryableError(error);
}

function extractCode(error: unknown): string | null {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === 'string') return code;
  }
  return null;
}

/** Exponential backoff with a ceiling; attempt is 1-based. */
export function backoffMs(attempt: number): number {
  const exponential = AGENT_DEFAULTS.RETRY_BASE_MS * Math.pow(2, Math.max(0, attempt - 1));
  return Math.min(exponential, AGENT_DEFAULTS.RETRY_MAX_MS);
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Run `fn` with bounded retries. `signal` aborts remaining attempts (used when
 * the overall agent runtime budget is exhausted).
 */
export async function withRetry<T>(
  fn: (attempt: number) => Promise<T>,
  options: {
    maxAttempts?: number;
    signal?: { aborted: boolean };
    onRetry?: (info: { attempt: number; error: unknown; delayMs: number }) => void;
  } = {},
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? AGENT_DEFAULTS.MAX_TOOL_ATTEMPTS;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (options.signal?.aborted) {
      throw lastError ?? AgentError.from('AGENT_TIMEOUT', { reason: 'aborted before attempt' });
    }
    try {
      return await fn(attempt);
    } catch (err) {
      lastError = err;
      if (attempt >= maxAttempts || !isRetryable(err)) throw err;
      const delayMs = backoffMs(attempt);
      options.onRetry?.({ attempt, error: err, delayMs });
      await sleep(delayMs);
    }
  }

  throw lastError;
}

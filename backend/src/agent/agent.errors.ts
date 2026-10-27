/**
 * Agent Error Catalogue
 *
 * Mirrors `src/knowledge/knowledge.errors.ts`: one spec table drives the HTTP
 * status, the retry classification (ERROR-HANDLING §Phase 6) and the user-safe
 * message, so tool and run failures are never classified ad-hoc at a throw site.
 *
 * `isRetryable` follows the retry policy: only transient classes are retried
 * automatically. INVALID_INPUT / UNAUTHORIZED / FORBIDDEN / NOT_FOUND /
 * POLICY_DENIED / APPROVAL_REJECTED are terminal.
 */

import httpStatus from 'http-status';
import { BaseError } from '@/utils/errors';

export interface AgentErrorSpec {
  code: string;
  httpStatus: number;
  isRetryable: boolean;
  message: string;
  safeMessage: string;
  /** Category used by ERROR-HANDLING.md for the Phase 6 grouping. */
  category:
    | 'authorization'
    | 'validation'
    | 'timeout'
    | 'provider'
    | 'approval'
    | 'policy'
    | 'rate_limit'
    | 'internal';
}

export const AGENT_ERRORS: Record<string, AgentErrorSpec> = {
  // --- run lifecycle -----------------------------------------------------
  AGENT_NOT_FOUND: {
    code: 'AGENT_NOT_FOUND',
    httpStatus: httpStatus.NOT_FOUND,
    isRetryable: false,
    message: 'The agent run does not exist or is not visible to this user',
    safeMessage: 'Agent run not found.',
    category: 'validation',
  },
  AGENT_DISABLED: {
    code: 'AGENT_DISABLED',
    httpStatus: httpStatus.UNPROCESSABLE_ENTITY,
    isRetryable: false,
    message: 'Agent mode is not enabled for this alternate',
    safeMessage: 'The agent is not enabled for this alternate.',
    category: 'policy',
  },
  AGENT_UNAUTHORIZED: {
    code: 'AGENT_UNAUTHORIZED',
    httpStatus: httpStatus.FORBIDDEN,
    isRetryable: false,
    message: 'The user is not permitted to act on this alternate',
    safeMessage: 'You do not have access to this alternate.',
    category: 'authorization',
  },
  AGENT_MAX_STEPS: {
    code: 'AGENT_MAX_STEPS',
    httpStatus: httpStatus.UNPROCESSABLE_ENTITY,
    isRetryable: false,
    message: 'The agent exceeded its configured step limit',
    safeMessage: 'This request took too many steps. Please ask something more specific.',
    category: 'policy',
  },
  AGENT_MAX_TOOL_CALLS: {
    code: 'AGENT_MAX_TOOL_CALLS',
    httpStatus: httpStatus.UNPROCESSABLE_ENTITY,
    isRetryable: false,
    message: 'The agent exceeded its configured tool-call limit',
    safeMessage: 'This request needed too many lookups. Please try again more specifically.',
    category: 'policy',
  },
  AGENT_MAX_LLM_CALLS: {
    code: 'AGENT_MAX_LLM_CALLS',
    httpStatus: httpStatus.UNPROCESSABLE_ENTITY,
    isRetryable: false,
    message: 'The agent exceeded its configured LLM-call budget',
    safeMessage: 'This request used too much model capacity. Please try again.',
    category: 'policy',
  },
  AGENT_TIMEOUT: {
    code: 'AGENT_TIMEOUT',
    httpStatus: httpStatus.GATEWAY_TIMEOUT,
    isRetryable: true,
    message: 'The agent run exceeded its configured runtime limit',
    safeMessage: 'That took too long. Please try again.',
    category: 'timeout',
  },
  AGENT_CONTEXT_LIMIT: {
    code: 'AGENT_CONTEXT_LIMIT',
    httpStatus: httpStatus.UNPROCESSABLE_ENTITY,
    isRetryable: false,
    message: 'The assembled context exceeded the configured token budget',
    safeMessage: 'There is too much context to work with. Please shorten the request.',
    category: 'policy',
  },
  AGENT_PROVIDER_UNAVAILABLE: {
    code: 'AGENT_PROVIDER_UNAVAILABLE',
    httpStatus: httpStatus.BAD_GATEWAY,
    isRetryable: true,
    message: 'The configured LLM provider is unavailable',
    safeMessage: 'My AI provider is temporarily unavailable. Please try again.',
    category: 'provider',
  },
  AGENT_RATE_LIMITED: {
    code: 'AGENT_RATE_LIMITED',
    httpStatus: httpStatus.TOO_MANY_REQUESTS,
    isRetryable: true,
    message: 'The agent rate limit was exceeded',
    safeMessage: 'Too many requests. Please slow down and try again shortly.',
    category: 'rate_limit',
  },
  AGENT_EXECUTION_FAILED: {
    code: 'AGENT_EXECUTION_FAILED',
    httpStatus: httpStatus.INTERNAL_SERVER_ERROR,
    isRetryable: false,
    message: 'The agent run failed',
    safeMessage: 'Something went wrong while I was working on that.',
    category: 'internal',
  },
  AGENT_RUN_CANCELLED: {
    code: 'AGENT_RUN_CANCELLED',
    httpStatus: httpStatus.UNPROCESSABLE_ENTITY,
    isRetryable: false,
    message: 'The agent run was cancelled',
    safeMessage: 'That request was cancelled.',
    category: 'policy',
  },

  // --- tool lifecycle ----------------------------------------------------
  TOOL_NOT_FOUND: {
    code: 'TOOL_NOT_FOUND',
    httpStatus: httpStatus.NOT_FOUND,
    isRetryable: false,
    message: 'The requested tool does not exist in the registry',
    safeMessage: 'That capability is not available.',
    category: 'validation',
  },
  TOOL_DISABLED: {
    code: 'TOOL_DISABLED',
    httpStatus: httpStatus.UNPROCESSABLE_ENTITY,
    isRetryable: false,
    message: 'The requested tool is disabled for this alternate',
    safeMessage: 'That capability is not currently enabled.',
    category: 'policy',
  },
  TOOL_INVALID_INPUT: {
    code: 'TOOL_INVALID_INPUT',
    httpStatus: httpStatus.BAD_REQUEST,
    isRetryable: false,
    message: 'The tool arguments failed server-side schema validation',
    safeMessage: 'The request could not be understood.',
    category: 'validation',
  },
  TOOL_NOT_ALLOWED: {
    code: 'TOOL_NOT_ALLOWED',
    httpStatus: httpStatus.FORBIDDEN,
    isRetryable: false,
    message: 'The tool is not permitted in this execution context',
    safeMessage: 'You do not have permission for that action.',
    category: 'authorization',
  },
  TOOL_APPROVAL_REQUIRED: {
    code: 'TOOL_APPROVAL_REQUIRED',
    httpStatus: httpStatus.ACCEPTED,
    isRetryable: false,
    message: 'The tool requires human approval before it can execute',
    safeMessage: 'This action is waiting for your approval.',
    category: 'approval',
  },
  TOOL_APPROVAL_REJECTED: {
    code: 'TOOL_APPROVAL_REJECTED',
    httpStatus: httpStatus.UNPROCESSABLE_ENTITY,
    isRetryable: false,
    message: 'The approval for this tool execution was rejected',
    safeMessage: 'That action was declined.',
    category: 'approval',
  },
  TOOL_APPROVAL_NOT_FOUND: {
    code: 'TOOL_APPROVAL_NOT_FOUND',
    httpStatus: httpStatus.NOT_FOUND,
    isRetryable: false,
    message: 'The approval request does not exist or is not visible to this user',
    safeMessage: 'Approval request not found.',
    category: 'validation',
  },
  TOOL_APPROVAL_EXPIRED: {
    code: 'TOOL_APPROVAL_EXPIRED',
    httpStatus: httpStatus.UNPROCESSABLE_ENTITY,
    isRetryable: false,
    message: 'The approval request expired before a decision was made',
    safeMessage: 'That approval request expired. Please ask again.',
    category: 'approval',
  },
  TOOL_TIMEOUT: {
    code: 'TOOL_TIMEOUT',
    httpStatus: httpStatus.GATEWAY_TIMEOUT,
    isRetryable: true,
    message: 'The tool exceeded its configured runtime limit',
    safeMessage: 'That lookup took too long. Please try again.',
    category: 'timeout',
  },
  TOOL_EXECUTION_FAILED: {
    code: 'TOOL_EXECUTION_FAILED',
    httpStatus: httpStatus.INTERNAL_SERVER_ERROR,
    isRetryable: false,
    message: 'The tool failed during execution',
    safeMessage: 'Something went wrong while I was doing that.',
    category: 'internal',
  },
  TOOL_RESULT_INVALID: {
    code: 'TOOL_RESULT_INVALID',
    httpStatus: httpStatus.INTERNAL_SERVER_ERROR,
    isRetryable: false,
    message: 'The tool returned a result that could not be validated or serialized',
    safeMessage: 'I could not read the result of that step.',
    category: 'internal',
  },
};

export class AgentError extends BaseError {
  public readonly isRetryable: boolean;
  public readonly safeMessage: string;
  public readonly category: AgentErrorSpec['category'];

  constructor(code: string, detail?: unknown, overrideMessage?: string) {
    const spec = AGENT_ERRORS[code] ?? AGENT_ERRORS.AGENT_EXECUTION_FAILED;
    super(overrideMessage || spec.message, spec.httpStatus, spec.code, spec.isRetryable, detail);
    this.isRetryable = spec.isRetryable;
    this.safeMessage = spec.safeMessage;
    this.category = spec.category;
  }

  static from(code: string, detail?: unknown, overrideMessage?: string): AgentError {
    return new AgentError(code, detail, overrideMessage);
  }

  /** True when this error is transient and safe to retry with backoff. */
  static isRetryableError(err: unknown): boolean {
    if (err instanceof AgentError) return err.isRetryable;
    if (err instanceof BaseError) {
      const spec = Object.values(AGENT_ERRORS).find((s) => s.code === err.code);
      return spec?.isRetryable ?? false;
    }
    return false;
  }
}

/**
 * Tool Input Schemas
 *
 * These are the authoritative contracts. They are used twice:
 *   1. validated server-side against the model's arguments before execution
 *   2. converted to JSON Schema for the model-facing tool definition
 *
 * Every object is `.strict()`: Zod's default behaviour is to *strip* unknown
 * keys, which would silently accept (and discard) attacker-supplied fields.
 * Strict mode makes an unexpected field a hard TOOL_INVALID_INPUT rejection,
 * as required by the Phase 6 input-validation rules.
 */

import { z } from 'zod';
import { AGENT_DEFAULTS } from '../agent.constants';

const QUERY = z
  .string()
  .trim()
  .min(3, 'query must be at least 3 characters')
  .max(500, 'query must be at most 500 characters');

const UUID = z.string().uuid();

export const KnowledgeSearchInputSchema = z
  .object({
    query: QUERY,
    limit: z.coerce.number().int().min(1).max(10).default(5),
    sourceId: UUID.optional(),
  })
  .strict();

export const MemorySearchInputSchema = z
  .object({
    query: QUERY,
    limit: z.coerce.number().int().min(1).max(10).default(5),
  })
  .strict();

export const ConversationContextInputSchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(50).default(20),
    includeRole: z.enum(['USER', 'ASSISTANT', 'BOTH']).default('BOTH'),
  })
  .strict();

export const AlternateContextInputSchema = z
  .object({
    includePersona: z.boolean().default(true),
  })
  .strict();

export const GoogleCalendarListEventsInputSchema = z
  .object({
    timeMin: z.string().datetime().optional(),
    timeMax: z.string().datetime().optional(),
    limit: z.coerce.number().int().min(1).max(10).default(5),
  })
  .strict();

export const GoogleGmailSearchMessagesInputSchema = z
  .object({
    query: z.string().trim().min(1).max(200),
    limit: z.coerce.number().int().min(1).max(10).default(5),
  })
  .strict();

export const GoogleTasksListInputSchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(50).default(10),
  })
  .strict();

/**
 * Scaffolding tool used to exercise the approval gate. It performs no external
 * side effect: it returns a confirmation payload that the agent loop records on
 * the ToolExecution row.
 */
export const SampleOwnerActionInputSchema = z
  .object({
    note: z
      .string()
      .trim()
      .min(1, 'note is required')
      .max(500, 'note must be at most 500 characters'),
    urgency: z.enum(['low', 'normal', 'high']).default('normal'),
  })
  .strict();

/** Goal for starting a run from the API. */
export const StartAgentRunSchema = z.object({
  goal: z.string().trim().min(AGENT_DEFAULTS.GOAL_MIN_CHARS).max(AGENT_DEFAULTS.GOAL_MAX_CHARS),
  conversationId: UUID.optional(),
  /** When true the run is queued instead of executed inline. */
  asynchronous: z.boolean().default(false),
});

export const ListAgentRunsQuerySchema = z.object({
  status: z
    .enum([
      'PENDING',
      'RUNNING',
      'WAITING_FOR_APPROVAL',
      'COMPLETED',
      'FAILED',
      'CANCELLED',
      'TIMED_OUT',
    ])
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const ListApprovalsQuerySchema = z.object({
  status: z
    .enum(['PENDING', 'APPROVED', 'REJECTED', 'EXPIRED', 'CANCELLED', 'EXECUTED'])
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const ApprovalDecisionSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

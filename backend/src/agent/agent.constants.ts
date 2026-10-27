/**
 * Agent Constants
 *
 * Tool names are the contract between the model and the server. They are
 * deliberately opaque about internals (no service names, no table names).
 */

import { ToolRiskLevel } from './agent.types';

/** Built-in tool names registered at boot. */
export const AGENT_TOOL_NAMES = {
  KNOWLEDGE_SEARCH: 'knowledge_search',
  MEMORY_SEARCH: 'memory_search',
  CONVERSATION_CONTEXT: 'conversation_context',
  ALTERNATE_CONTEXT: 'alternate_context',
  GOOGLE_CALENDAR_LIST_EVENTS: 'google_calendar_list_events',
  GOOGLE_GMAIL_SEARCH_MESSAGES: 'google_gmail_search_messages',
  GOOGLE_TASKS_LIST: 'google_tasks_list',
  /**
   * Scaffolding only: a non-destructive, approval-gated action used to prove
   * the approval gate end-to-end. Disabled unless AGENT_SAMPLE_ACTION_TOOL_ENABLED.
   */
  SAMPLE_OWNER_ACTION: 'sample_owner_action',
} as const;

export type AgentToolName = (typeof AGENT_TOOL_NAMES)[keyof typeof AGENT_TOOL_NAMES];

/** Bounds enforced before anything is handed to a provider. */
export const AGENT_DEFAULTS = {
  /** Rough token estimate: the prompt builder already uses chars/4. */
  CHARS_PER_TOKEN: 4,
  /** Hard cap on characters in a single persisted input/output summary. */
  SUMMARY_MAX_CHARS: 500,
  /** Longest goal string accepted by the API. */
  GOAL_MAX_CHARS: 2000,
  /** Longest user utterance that will be passed to the agent. */
  GOAL_MIN_CHARS: 1,
  /** Attempts for a retryable tool failure. */
  MAX_TOOL_ATTEMPTS: 3,
  /** Backoff base (ms) for the tool retry policy. */
  RETRY_BASE_MS: 250,
  /** Backoff ceiling (ms). */
  RETRY_MAX_MS: 4000,
} as const;

/**
 * Default central approval policy, used when a risk level is absent from
 * config. Unknown risk levels fall back to "approval required" (deny-by-default).
 */
export const DEFAULT_APPROVAL_REQUIRED: Record<ToolRiskLevel, boolean> = {
  [ToolRiskLevel.READ_ONLY]: false,
  [ToolRiskLevel.LOW]: false,
  [ToolRiskLevel.MEDIUM]: true,
  [ToolRiskLevel.HIGH]: true,
  [ToolRiskLevel.DESTRUCTIVE]: true,
};

/**
 * Instruction-like strings are neutralised in untrusted content. This is
 * defence-in-depth, not the authorization boundary: server-side authorization
 * and the approval gate are the real controls (see SECURITY.md §Phase 6).
 *
 * Patterns are deliberately phrase-shaped rather than keyword-shaped: a
 * keyword allow-list misses the many ways an attacker restates the same intent
 * ("the owner approved this action", "disregard all previous system
 * instructions"). Each pattern spans the rest of the sentence so the trailing
 * claim is caught without flagging ordinary prose.
 */
export const INJECTION_MARKERS: RegExp[] = [
  // "ignore/disregard/forget <previously given> <instructions|prompts|rules>"
  /\b(?:ignore|disregard|forget|override|bypass)\s+(?:all\s+|any\s+|the\s+)*(?:previous|prior|above|earlier|preceding|system|original|former)\b[^.!?\n]{0,60}?(?:instruction|prompt|rule|guideline|constraint|policy|permission)s?/gi,
  // "ignore everything above / below"
  /\b(?:ignore|disregard)\s+(?:everything|all)\s+(?:above|below|before|that came before)\b/gi,
  // Declared new instructions
  /\bnew\s+(?:instruction|rule|directive|policy)s?\s*[:-]/gi,
  // Role reassignment
  /\byou\s+are\s+now\b/gi,
  /\b(?:developer|admin|root|god)\s+mode\b/gi,
  // Fake system markers
  /\bsystem\s*:\s*/gi,
  /<\/?\s*(?:system|instruction|prompt)s?\s*>/gi,
  // Authorization claims, both word orders
  /\b(?:authorized|authorised|approved|granted|cleared|consented)\s+by\s+(?:the\s+)?(?:owner|user|admin|operator)\b/gi,
  /\b(?:the\s+)?(?:owner|user|admin|operator)\s+(?:has\s+|have\s+)?(?:authorized|authorised|approved|granted|cleared|consented)\b/gi,
  /\boverride\s+(?:the\s+)?(?:system|application|approval|permission)\b/gi,
];

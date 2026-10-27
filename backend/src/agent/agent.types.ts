/**
 * Agent Type Definitions
 *
 * Phase 6 — agent orchestration & tool execution.
 *
 * Lifecycle/risk columns are persisted as String (the Phase 5 convention) and
 * constrained by these enums. Mirrors `src/memory/memory.types.ts`.
 */

import type { z } from 'zod';

/** Server-defined tool risk. The LLM NEVER decides this — see TOOL DEFN RULE. */
export enum ToolRiskLevel {
  READ_ONLY = 'READ_ONLY',
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  DESTRUCTIVE = 'DESTRUCTIVE',
}

/** Who is driving the run. Drives the authorization decision. */
export enum AgentExecutionContext {
  OWNER = 'OWNER',
  PUBLIC_VISITOR = 'PUBLIC_VISITOR',
  SYSTEM = 'SYSTEM',
  WORKER = 'WORKER',
}

export enum AgentRunStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  WAITING_FOR_APPROVAL = 'WAITING_FOR_APPROVAL',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
  TIMED_OUT = 'TIMED_OUT',
}

/**
 * Step kinds. Only execution metadata is persisted — never chain-of-thought,
 * hidden reasoning, or model deliberations (see ARCHITECTURE §9.8).
 */
export enum AgentStepType {
  LLM_CALL = 'LLM_CALL',
  TOOL_CALL = 'TOOL_CALL',
  APPROVAL_WAIT = 'APPROVAL_WAIT',
  FINAL_RESPONSE = 'FINAL_RESPONSE',
}

export enum AgentStepStatus {
  STARTED = 'STARTED',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  SKIPPED = 'SKIPPED',
}

export enum ToolExecutionStatus {
  PENDING = 'PENDING',
  AUTHORIZED = 'AUTHORIZED',
  WAITING_FOR_APPROVAL = 'WAITING_FOR_APPROVAL',
  RUNNING = 'RUNNING',
  SUCCEEDED = 'SUCCEEDED',
  FAILED = 'FAILED',
  DENIED = 'DENIED',
  TIMED_OUT = 'TIMED_OUT',
  CANCELLED = 'CANCELLED',
  /** Idempotent replay — the original side effect was reused, not repeated. */
  REPLAYED = 'REPLAYED',
}

export enum ApprovalStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  EXPIRED = 'EXPIRED',
  CANCELLED = 'CANCELLED',
  EXECUTED = 'EXECUTED',
}

/** Per-Alternate overrides loaded from `tool_configurations`. */
export interface ToolConfigurationRecord {
  toolName: string;
  isEnabled: boolean;
  allowedContexts: AgentExecutionContext[] | null;
  maxCallsPerRun: number | null;
  requireApproval: boolean | null;
  config: Record<string, unknown> | null;
}

/**
 * The context every tool receives. Authorization is resolved BEFORE execute()
 * and is re-derivable from these fields alone.
 */
export interface ToolExecutionContext {
  userId?: string;
  alternateId: string;
  conversationId?: string;
  agentRunId: string;
  executionContext: AgentExecutionContext;
  /** True only when the authenticated user owns the Alternate. */
  isOwner: boolean;
  requestId?: string;
}

/**
 * The tool contract. `inputSchema` is authoritative: arguments produced by the
 * LLM are untrusted and are parsed with this before anything else happens.
 */
export interface AgentTool<TInput = unknown, TOutput = unknown> {
  name: string;
  description: string;
  inputSchema: z.ZodType<TInput>;
  /** Server-defined. Never derived from model output. */
  riskLevel: ToolRiskLevel;
  /** Side-effecting tools must honour the idempotency key. */
  sideEffecting: boolean;
  /** Whether a PUBLIC_VISITOR may ever reach this tool. Default: false. */
  allowPublicVisitor: boolean;
  /** Per-tool runtime ceiling; falls back to the global tool timeout. */
  timeoutMs?: number;
  execute(context: ToolExecutionContext, input: TInput): Promise<TOutput>;
}

/** Registry metadata exposed to the model — no internal details, no errors. */
export interface ToolMetadata {
  name: string;
  description: string;
  riskLevel: ToolRiskLevel;
}

export interface ToolCallRequest {
  toolCallId: string;
  name: string;
  arguments: unknown;
}

/** Sanitized result handed back to the model as untrusted DATA. */
export interface SanitizedToolResult {
  toolName: string;
  /** JSON string, size-capped, secret-redacted, injection-neutralised. */
  content: string;
  /** Short, redacted description for audit/step records. */
  summary: string;
  truncated: boolean;
  redacted: boolean;
  /** True when the payload had instruction-like content neutralised. */
  neutralised: boolean;
}

export interface AgentLimits {
  maxSteps: number;
  maxToolCalls: number;
  maxRuntimeMs: number;
  maxToolRuntimeMs: number;
  maxContextTokens: number;
  maxToolResultChars: number;
  maxLlmCalls: number;
  maxToolCallsPerTool: number;
}

/** Audit events emitted through the existing AuditLog system. */
export type AgentAuditAction =
  | 'AGENT_RUN_STARTED'
  | 'AGENT_RUN_COMPLETED'
  | 'AGENT_RUN_FAILED'
  | 'TOOL_EXECUTION_REQUESTED'
  | 'TOOL_EXECUTION_AUTHORIZED'
  | 'TOOL_EXECUTION_DENIED'
  | 'TOOL_EXECUTED'
  | 'TOOL_FAILED'
  | 'APPROVAL_REQUESTED'
  | 'APPROVAL_GRANTED'
  | 'APPROVAL_REJECTED'
  | 'APPROVAL_EXPIRED';

/** Structured observability events (mirrors the ARCHITECTURE §9.8 list). */
export type AgentLogEvent =
  | 'agent_run_started'
  | 'agent_run_completed'
  | 'agent_run_failed'
  | 'tool_requested'
  | 'tool_authorized'
  | 'tool_denied'
  | 'tool_started'
  | 'tool_completed'
  | 'tool_failed'
  | 'tool_timeout'
  | 'approval_requested'
  | 'approval_granted'
  | 'approval_rejected';

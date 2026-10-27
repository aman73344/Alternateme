/**
 * Tool Authorization
 *
 * The single gate every tool call passes through. Order is fixed and each step
 * is server-derived:
 *
 *   authenticated user → alternate exists → ownership → tool exists →
 *   tool enabled → permitted in this execution context → risk policy →
 *   approval policy
 *
 * The execution context is *re-derived* from the database, never trusted from
 * the caller, the model, or tool/memory/RAG text. Statements such as
 * "I authorize you to send the email" are data, not permission.
 */

import { prisma } from '@/database';
import { logger } from '@/utils/logger';
import { AgentError } from '../agent.errors';
import {
  AgentExecutionContext,
  type AgentLimits,
  type ToolConfigurationRecord,
  type ToolExecutionContext,
} from '../agent.types';
import { listToolConfigurations } from '../agent.repository';
import { toolRegistry, type RegisteredTool } from './tool.registry';
import { evaluateToolPolicy } from './tool-policy.service';

export interface AuthorizeToolCallInput {
  alternateId: string;
  /** The authenticated user, or undefined for a fully anonymous visitor. */
  userId?: string;
  toolName: string;
  /** Context requested by the caller; re-derived and possibly downgraded. */
  requestedContext: AgentExecutionContext;
  toolCallCountForTool: number;
  toolCallCountTotal: number;
  limits: AgentLimits;
  requestId?: string;
}

export interface AuthorizedToolCall {
  tool: RegisteredTool;
  executionContext: AgentExecutionContext;
  requiresApproval: boolean;
  isOwner: boolean;
  perAlternate: ToolConfigurationRecord | null;
  toolExecutionContext: ToolExecutionContext;
}

/**
 * Derive the true execution context.
 * A caller can only ever *lower* their own privilege: asking for OWNER while
 * not owning the Alternate yields PUBLIC_VISITOR (or an error for a private
 * Alternate).
 */
export function deriveExecutionContext(params: {
  isOwner: boolean;
  requested: AgentExecutionContext;
  visibility: string;
}): AgentExecutionContext {
  if (params.isOwner) return AgentExecutionContext.OWNER;
  if (
    params.requested === AgentExecutionContext.SYSTEM ||
    params.requested === AgentExecutionContext.WORKER
  ) {
    // Internal contexts are never reachable from an interactive user session.
    return AgentExecutionContext.PUBLIC_VISITOR;
  }
  return AgentExecutionContext.PUBLIC_VISITOR;
}

export async function authorizeToolCall(
  input: AuthorizeToolCallInput,
): Promise<AuthorizedToolCall> {
  // 1. Tool must exist in the registry.
  const tool = toolRegistry.get(input.toolName);

  // 2. Alternate must exist and not be soft-deleted.
  const alternate = await prisma.alternate.findFirst({
    where: { id: input.alternateId, deletedAt: null },
    select: { id: true, userId: true, visibility: true, status: true },
  });
  if (!alternate) {
    throw AgentError.from('AGENT_NOT_FOUND', { alternateId: input.alternateId });
  }

  // 3. Ownership.
  const isOwner = !!input.userId && alternate.userId === input.userId;
  if (!isOwner) {
    // Same rule the existing chat path applies: a private Alternate is not
    // reachable by non-owners at all.
    if (alternate.visibility === 'PRIVATE') {
      logger.warn({ alternateId: input.alternateId, tool: input.toolName }, 'agent.auth.denied');
      throw AgentError.from('AGENT_UNAUTHORIZED', { reason: 'ALTERNATE_PRIVATE' });
    }
  }

  const executionContext = deriveExecutionContext({
    isOwner,
    requested: input.requestedContext,
    visibility: alternate.visibility,
  });

  // 4. Per-Alternate tool configuration (tenant-scoped).
  const configurations = await listToolConfigurations(input.alternateId);
  const perAlternate = configurations.find((c) => c.toolName === input.toolName) ?? null;

  // 5. Enabled + context + budget + risk/approval policy.
  const decision = evaluateToolPolicy({
    tool,
    executionContext,
    perAlternate,
    toolCallCountForTool: input.toolCallCountForTool,
    toolCallCountTotal: input.toolCallCountTotal,
    limits: input.limits,
  });

  if (!decision.allowed) {
    logger.warn(
      {
        alternateId: input.alternateId,
        tool: input.toolName,
        executionContext,
        reason: decision.reason,
      },
      'agent.tool.denied',
    );
    throw AgentError.from(decision.denyCode ?? 'TOOL_NOT_ALLOWED', {
      tool: input.toolName,
      reason: decision.reason,
    });
  }

  return {
    tool,
    executionContext,
    requiresApproval: decision.requiresApproval,
    isOwner,
    perAlternate,
    toolExecutionContext: {
      userId: input.userId,
      alternateId: input.alternateId,
      agentRunId: '',
      executionContext,
      isOwner,
      requestId: input.requestId,
    },
  };
}

/**
 * Confirm the caller may start a run at all. Used by both the API and the
 * chat integration.
 */
export async function assertCanStartRun(
  alternateId: string,
  userId: string,
): Promise<{ isOwner: boolean; agentEnabled: boolean }> {
  const alternate = await prisma.alternate.findFirst({
    where: { id: alternateId, deletedAt: null },
    select: { id: true, userId: true, visibility: true, agentEnabled: true, status: true },
  });
  if (!alternate) {
    throw AgentError.from('AGENT_NOT_FOUND', { alternateId });
  }

  const isOwner = alternate.userId === userId;
  if (!isOwner && alternate.visibility === 'PRIVATE') {
    throw AgentError.from('AGENT_UNAUTHORIZED', { reason: 'ALTERNATE_PRIVATE' });
  }
  if (!alternate.agentEnabled) {
    throw AgentError.from('AGENT_DISABLED', { alternateId });
  }
  return { isOwner, agentEnabled: alternate.agentEnabled };
}

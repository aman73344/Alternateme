/**
 * Agent Repository
 *
 * Every query carries `alternateId` (+ `userId` where the row is user-owned).
 * Tenant constraints are part of the WHERE clause: records are never fetched
 * "all" and filtered in JavaScript.
 */

import { prisma } from '@/database';
import { logger } from '@/utils/logger';
import type { Prisma } from '@prisma/client';
import {
  AgentExecutionContext,
  AgentRunStatus,
  AgentStepStatus,
  AgentStepType,
  ApprovalStatus,
  ToolExecutionStatus,
} from './agent.types';

type Json = Prisma.InputJsonValue;

/* ------------------------------- agent runs ----------------------------- */

export interface CreateRunInput {
  alternateId: string;
  userId: string;
  conversationId?: string | null;
  executionContext: AgentExecutionContext;
  goal: string;
}

export async function createRun(input: CreateRunInput) {
  return prisma.agentRun.create({
    data: {
      alternateId: input.alternateId,
      userId: input.userId,
      conversationId: input.conversationId ?? null,
      executionContext: input.executionContext,
      goal: input.goal,
      status: AgentRunStatus.PENDING,
    },
  });
}

export async function markRunStarted(runId: string) {
  return prisma.agentRun.update({
    where: { id: runId },
    data: { status: AgentRunStatus.RUNNING, startedAt: new Date() },
  });
}

export async function updateRunProgress(
  runId: string,
  data: { stepCount?: number; toolCallCount?: number; llmCallCount?: number; tokenCount?: number },
) {
  return prisma.agentRun.update({ where: { id: runId }, data });
}

export async function completeRun(
  runId: string,
  data: { tokenCount?: number; stepCount?: number },
) {
  return prisma.agentRun.update({
    where: { id: runId },
    data: {
      status: AgentRunStatus.COMPLETED,
      completedAt: new Date(),
      ...(data.tokenCount !== undefined ? { tokenCount: data.tokenCount } : {}),
      ...(data.stepCount !== undefined ? { stepCount: data.stepCount } : {}),
    },
  });
}

/** Terminal transition. Records the failure code, never a raw stack trace. */
export async function failRun(
  runId: string,
  status: AgentRunStatus,
  failureCode: string,
  failureMessage: string,
) {
  return prisma.agentRun.update({
    where: { id: runId },
    data: { status, failureCode, failureMessage, completedAt: new Date() },
  });
}

export async function setRunWaitingForApproval(runId: string) {
  return prisma.agentRun.update({
    where: { id: runId },
    data: { status: AgentRunStatus.WAITING_FOR_APPROVAL },
  });
}

/** Tenant-scoped single fetch. Returns null for another tenant's run. */
export async function getRun(runId: string, alternateId: string) {
  return prisma.agentRun.findFirst({ where: { id: runId, alternateId } });
}

/** Owner-scoped fetch used for decisions that must only be made by the owner. */
export async function getOwnedRun(runId: string, alternateId: string, userId: string) {
  return prisma.agentRun.findFirst({ where: { id: runId, alternateId, userId } });
}

export interface ListRunsParams {
  alternateId: string;
  userId: string;
  status?: string;
  limit: number;
  skip: number;
}

export async function listRuns(params: ListRunsParams) {
  const where: Prisma.AgentRunWhereInput = {
    alternateId: params.alternateId,
    userId: params.userId,
    ...(params.status ? { status: params.status } : {}),
  };
  const [runs, totalCount] = await Promise.all([
    prisma.agentRun.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: params.limit,
      skip: params.skip,
    }),
    prisma.agentRun.count({ where }),
  ]);
  return { runs, totalCount };
}

/* --------------------------------- steps -------------------------------- */

export async function createStep(input: {
  agentRunId: string;
  stepNumber: number;
  type: AgentStepType;
  status: AgentStepStatus;
  toolName?: string | null;
  inputSummary?: string | null;
  outputSummary?: string | null;
}) {
  return prisma.agentStep.create({
    data: {
      agentRunId: input.agentRunId,
      stepNumber: input.stepNumber,
      type: input.type,
      status: input.status,
      toolName: input.toolName ?? null,
      inputSummary: input.inputSummary ?? null,
      outputSummary: input.outputSummary ?? null,
    },
  });
}

export async function updateStep(
  stepId: string,
  data: {
    status: AgentStepStatus;
    outputSummary?: string | null;
    durationMs?: number | null;
    errorCode?: string | null;
  },
) {
  return prisma.agentStep.update({
    where: { id: stepId },
    data: {
      status: data.status,
      ...(data.outputSummary !== undefined ? { outputSummary: data.outputSummary } : {}),
      ...(data.durationMs !== undefined ? { durationMs: data.durationMs } : {}),
      ...(data.errorCode !== undefined ? { errorCode: data.errorCode } : {}),
    },
  });
}

/* ----------------------------- tool executions --------------------------- */

export interface CreateToolExecutionInput {
  agentRunId: string;
  alternateId: string;
  userId: string;
  executionContext: AgentExecutionContext;
  toolName: string;
  riskLevel: string;
  idempotencyKey: string;
  input?: unknown;
  sanitizedInput?: unknown;
  approvalRequired: boolean;
}

export async function createToolExecution(input: CreateToolExecutionInput) {
  return prisma.toolExecution.create({
    data: {
      agentRunId: input.agentRunId,
      alternateId: input.alternateId,
      userId: input.userId,
      executionContext: input.executionContext,
      toolName: input.toolName,
      riskLevel: input.riskLevel,
      idempotencyKey: input.idempotencyKey,
      input: (input.input ?? undefined) as Json | undefined,
      sanitizedInput: (input.sanitizedInput ?? undefined) as Json | undefined,
      approvalRequired: input.approvalRequired,
      status: ToolExecutionStatus.AUTHORIZED,
    },
  });
}

export async function getToolExecution(executionId: string, alternateId: string) {
  return prisma.toolExecution.findFirst({ where: { id: executionId, alternateId } });
}

/**
 * Fetch by id alone. Used only on the approval-resume path, where the caller has
 * already been authorized against the owning Alternate and the decision itself
 * is re-verified against `status` before anything executes.
 */
export async function getToolExecutionById(executionId: string) {
  return prisma.toolExecution.findFirst({ where: { id: executionId } });
}

export async function updateToolExecution(
  executionId: string,
  data: {
    status?: ToolExecutionStatus;
    output?: unknown;
    outputSummary?: string | null;
    errorCode?: string | null;
    errorMessage?: string | null;
    attempts?: number;
    startedAt?: Date;
    completedAt?: Date;
    durationMs?: number;
  },
) {
  return prisma.toolExecution.update({
    where: { id: executionId },
    data: {
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.output !== undefined ? { output: data.output as Json } : {}),
      ...(data.outputSummary !== undefined ? { outputSummary: data.outputSummary } : {}),
      ...(data.errorCode !== undefined ? { errorCode: data.errorCode } : {}),
      ...(data.errorMessage !== undefined ? { errorMessage: data.errorMessage } : {}),
      ...(data.attempts !== undefined ? { attempts: data.attempts } : {}),
      ...(data.startedAt !== undefined ? { startedAt: data.startedAt } : {}),
      ...(data.completedAt !== undefined ? { completedAt: data.completedAt } : {}),
      ...(data.durationMs !== undefined ? { durationMs: data.durationMs } : {}),
    },
  });
}

/**
 * Idempotency lookup, scoped to Alternate + tool + key.
 * The unique index on those three columns is what actually prevents a
 * duplicate side effect; this read is only used to short-circuit the retry.
 */
export async function findExecutionByIdempotencyKey(
  alternateId: string,
  toolName: string,
  idempotencyKey: string,
) {
  return prisma.toolExecution.findFirst({
    where: { alternateId, toolName, idempotencyKey },
  });
}

export async function listToolExecutions(params: {
  agentRunId: string;
  alternateId: string;
  limit: number;
}) {
  return prisma.toolExecution.findMany({
    where: { agentRunId: params.agentRunId, alternateId: params.alternateId },
    orderBy: { createdAt: 'asc' },
    take: params.limit,
  });
}

/* ------------------------------- approvals ------------------------------ */

export interface CreateApprovalInput {
  agentRunId: string;
  toolExecutionId: string;
  alternateId: string;
  userId: string;
  toolName: string;
  riskLevel: string;
  reason: string;
  sanitizedActionSummary: string;
  expiresAt: Date;
}

export async function createApproval(input: CreateApprovalInput) {
  return prisma.approvalRequest.create({
    data: {
      agentRunId: input.agentRunId,
      toolExecutionId: input.toolExecutionId,
      alternateId: input.alternateId,
      userId: input.userId,
      toolName: input.toolName,
      riskLevel: input.riskLevel,
      reason: input.reason,
      sanitizedActionSummary: input.sanitizedActionSummary,
      expiresAt: input.expiresAt,
      status: ApprovalStatus.PENDING,
    },
  });
}

/** Owner-scoped: another tenant's approval is indistinguishable from missing. */
export async function getApproval(approvalId: string, alternateId: string, userId: string) {
  return prisma.approvalRequest.findFirst({ where: { id: approvalId, alternateId, userId } });
}

export async function getApprovalByExecution(toolExecutionId: string) {
  return prisma.approvalRequest.findFirst({ where: { toolExecutionId } });
}

/**
 * Conditional decision update. The `status: PENDING` predicate is what makes
 * approve/reject race-safe: a second decision matches no row.
 */
export async function decideApproval(input: {
  approvalId: string;
  approved: boolean;
  decidedBy: string;
  rejectionReason?: string;
}) {
  const now = new Date();
  return prisma.approvalRequest.updateMany({
    where: { id: input.approvalId, status: ApprovalStatus.PENDING, expiresAt: { gt: now } },
    data: input.approved
      ? { status: ApprovalStatus.APPROVED, approvedAt: now, decidedBy: input.decidedBy }
      : {
          status: ApprovalStatus.REJECTED,
          rejectedAt: now,
          decidedBy: input.decidedBy,
          rejectionReason: input.rejectionReason ?? null,
        },
  });
}

export async function markApprovalExecuted(approvalId: string) {
  return prisma.approvalRequest.updateMany({
    where: { id: approvalId, status: ApprovalStatus.APPROVED },
    data: { status: ApprovalStatus.EXECUTED, executedAt: new Date() },
  });
}

export async function cancelApproval(approvalId: string, reason: string) {
  return prisma.approvalRequest.updateMany({
    where: { id: approvalId, status: ApprovalStatus.PENDING },
    data: { status: ApprovalStatus.CANCELLED, rejectionReason: reason, rejectedAt: new Date() },
  });
}

/** Expire anything past its TTL so a stale request can never be actioned. */
export async function expireStaleApprovals(now = new Date()): Promise<number> {
  const result = await prisma.approvalRequest.updateMany({
    where: { status: ApprovalStatus.PENDING, expiresAt: { lte: now } },
    data: { status: ApprovalStatus.EXPIRED },
  });
  if (result.count > 0) {
    logger.warn({ count: result.count }, 'agent.approvals.expired');
  }
  return result.count;
}

export async function listApprovals(params: {
  alternateId: string;
  userId: string;
  status?: string;
  limit: number;
  skip: number;
}) {
  const where: Prisma.ApprovalRequestWhereInput = {
    alternateId: params.alternateId,
    userId: params.userId,
    ...(params.status ? { status: params.status } : {}),
  };
  const [approvals, totalCount] = await Promise.all([
    prisma.approvalRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: params.limit,
      skip: params.skip,
    }),
    prisma.approvalRequest.count({ where }),
  ]);
  return { approvals, totalCount };
}

/* --------------------------- tool configuration -------------------------- */

/** Per-Alternate tool configuration rows (tenant-scoped). */
export async function listToolConfigurations(alternateId: string) {
  const rows = await prisma.toolConfiguration.findMany({ where: { alternateId } });
  return rows.map((r) => ({
    toolName: r.toolName,
    isEnabled: r.isEnabled,
    allowedContexts: (r.allowedContexts as AgentExecutionContext[] | null) ?? null,
    maxCallsPerRun: r.maxCallsPerRun,
    requireApproval: r.requireApproval,
    config: (r.config as Record<string, unknown> | null) ?? null,
  }));
}

export async function upsertToolConfiguration(input: {
  alternateId: string;
  userId: string;
  toolName: string;
  isEnabled?: boolean;
  allowedContexts?: AgentExecutionContext[];
  maxCallsPerRun?: number | null;
  requireApproval?: boolean | null;
  config?: Record<string, unknown> | null;
}) {
  return prisma.toolConfiguration.upsert({
    where: {
      alternateId_toolName: { alternateId: input.alternateId, toolName: input.toolName },
    },
    create: {
      alternateId: input.alternateId,
      userId: input.userId,
      toolName: input.toolName,
      ...(input.isEnabled !== undefined ? { isEnabled: input.isEnabled } : {}),
      ...(input.allowedContexts !== undefined
        ? { allowedContexts: input.allowedContexts as unknown as Json }
        : {}),
      ...(input.maxCallsPerRun !== undefined ? { maxCallsPerRun: input.maxCallsPerRun } : {}),
      ...(input.requireApproval !== undefined ? { requireApproval: input.requireApproval } : {}),
      ...(input.config !== undefined ? { config: input.config as Json } : {}),
    },
    update: {
      ...(input.isEnabled !== undefined ? { isEnabled: input.isEnabled } : {}),
      ...(input.allowedContexts !== undefined
        ? { allowedContexts: input.allowedContexts as unknown as Json }
        : {}),
      ...(input.maxCallsPerRun !== undefined ? { maxCallsPerRun: input.maxCallsPerRun } : {}),
      ...(input.requireApproval !== undefined ? { requireApproval: input.requireApproval } : {}),
      ...(input.config !== undefined ? { config: input.config as Json } : {}),
    },
  });
}

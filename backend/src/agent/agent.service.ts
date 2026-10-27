/**
 * Agent Service
 *
 * The owner-facing API surface: start/list runs, inspect executions, and decide
 * approvals. Every read is tenant-scoped by `alternateId` (+ `userId` for
 * owner-only resources), so a second tenant sees nothing — not a 403, nothing.
 */

import { logger } from '@/utils/logger';
import { config } from '@/config';
import { prisma } from '@/database';
import { agentQueue } from '@/queues';
import { AgentError } from './agent.errors';
import { auditAgentEvent } from './agent.audit';
import {
  AgentRunStatus,
  AgentExecutionContext,
  ApprovalStatus,
  ToolExecutionStatus,
  type AgentLimits,
} from './agent.types';
import {
  cancelApproval,
  decideApproval,
  expireStaleApprovals,
  getApproval,
  getApprovalByExecution,
  getOwnedRun,
  listApprovals,
  listRuns,
  listToolConfigurations,
  listToolExecutions,
  markApprovalExecuted,
  upsertToolConfiguration,
} from './agent.repository';
import {
  agentOrchestrator,
  type AgentRunResult,
  type StartRunInput,
} from './orchestration/orchestrator.service';
import { executeApprovedCall } from './execution/execution.service';
import { resolveLimits } from './tools/tool-policy.service';
import { toolRegistry } from './tools';

export interface ListOptions {
  status?: string;
  page: number;
  limit: number;
}

export class AgentService {
  private readonly limits: AgentLimits = resolveLimits();

  /** True when the agent subsystem is switched on. */
  isEnabled(): boolean {
    return config.agent.enabled;
  }

  /**
   * Start a run. `asynchronous` queues the job on the existing BullMQ queue
   * instead of running inline; the run is never silently dropped.
   */
  async startRun(
    input: StartRunInput & { asynchronous?: boolean },
  ): Promise<AgentRunResult | { runId: string; status: AgentRunStatus; queued: true }> {
    if (!this.isEnabled()) {
      throw AgentError.from('AGENT_DISABLED', { reason: 'AGENT_ENABLED_FALSE' });
    }
    if (input.asynchronous && config.agent.asyncEnabled) {
      return this.enqueueRun(input);
    }
    return agentOrchestrator.run(input);
  }

  /** Queue a run, falling back to inline execution when the queue is absent. */
  private async enqueueRun(
    input: StartRunInput & { asynchronous?: boolean },
  ): Promise<{ runId: string; status: AgentRunStatus; queued: true }> {
    const queue = agentQueue();
    if (!queue) {
      logger.warn('agent.queue.unavailable_running_inline');
      const result = await agentOrchestrator.run(input);
      return { runId: result.runId, status: result.status, queued: true };
    }

    const job = await queue.add(
      'agent-run',
      {
        alternateId: input.alternateId,
        userId: input.userId,
        goal: input.goal,
        conversationId: input.conversationId,
        requestId: input.requestId,
      },
      {
        jobId: `agent-run-${input.alternateId}-${Date.now()}`,
        attempts: 2,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { age: 3600, count: 100 },
        removeOnFail: { age: 86400, count: 500 },
      },
    );

    logger.info({ jobId: job.id, alternateId: input.alternateId }, 'agent.run.queued');
    return { runId: job.id as string, status: AgentRunStatus.PENDING, queued: true };
  }

  async listRuns(alternateId: string, userId: string, options: ListOptions) {
    const { runs, totalCount } = await listRuns({
      alternateId,
      userId,
      status: options.status,
      limit: options.limit,
      skip: (options.page - 1) * options.limit,
    });
    return { runs, totalCount };
  }

  /** Owner-only: the run row is scoped to the owner that started it. */
  async getRunDetail(runId: string, alternateId: string, userId: string) {
    const run = await getOwnedRun(runId, alternateId, userId);
    if (!run) {
      throw AgentError.from('AGENT_NOT_FOUND', { runId });
    }
    return run;
  }

  async getRunExecutions(runId: string, alternateId: string, userId: string) {
    await this.getRunDetail(runId, alternateId, userId);
    return listToolExecutions({ agentRunId: runId, alternateId, limit: 200 });
  }

  async listPendingApprovals(alternateId: string, userId: string, options: ListOptions) {
    // Expire anything stale first so a caller never sees a dead request.
    await expireStaleApprovals();
    const { approvals, totalCount } = await listApprovals({
      alternateId,
      userId,
      status: options.status,
      limit: options.limit,
      skip: (options.page - 1) * options.limit,
    });
    return { approvals, totalCount };
  }

  /**
   * Approve a pending request. On approval the gated tool actually runs.
   * The decision is a conditional update, so a double-click cannot execute twice.
   */
  async approveToolCall(params: {
    approvalId: string;
    alternateId: string;
    userId: string;
    requestId?: string;
  }) {
    const approval = await getApproval(params.approvalId, params.alternateId, params.userId);
    if (!approval) {
      throw AgentError.from('TOOL_APPROVAL_NOT_FOUND', { approvalId: params.approvalId });
    }
    if (approval.status !== ApprovalStatus.PENDING) {
      throw AgentError.from('TOOL_APPROVAL_REJECTED', {
        status: approval.status,
        reason: 'ALREADY_DECIDED',
      });
    }
    if (approval.expiresAt.getTime() <= Date.now()) {
      await cancelApproval(approval.id, 'EXPIRED');
      throw AgentError.from('TOOL_APPROVAL_EXPIRED', { approvalId: approval.id });
    }

    const decision = await decideApproval({
      approvalId: approval.id,
      approved: true,
      decidedBy: params.userId,
    });
    if (decision.count === 0) {
      throw AgentError.from('TOOL_APPROVAL_REJECTED', { reason: 'DECISION_RACE_LOST' });
    }

    await auditAgentEvent({
      userId: params.userId,
      action: 'APPROVAL_GRANTED',
      entity: 'approval_request',
      entityId: approval.id,
      alternateId: params.alternateId,
      toolName: approval.toolName,
      requestId: params.requestId,
      metadata: { agentRunId: approval.agentRunId },
    });
    logger.info(
      { approvalId: approval.id, tool: approval.toolName, requestId: params.requestId },
      'approval_granted',
    );

    const outcome = await executeApprovedCall({
      toolExecutionId: approval.toolExecutionId,
      limits: this.limits,
      requestId: params.requestId,
    });
    await markApprovalExecuted(approval.id);

    return {
      approvalId: approval.id,
      toolExecutionId: approval.toolExecutionId,
      toolName: approval.toolName,
      status: ToolExecutionStatus.SUCCEEDED,
      result: outcome.kind === 'completed' ? outcome.result.summary : null,
    };
  }

  async rejectToolCall(params: {
    approvalId: string;
    alternateId: string;
    userId: string;
    reason?: string;
    requestId?: string;
  }) {
    const approval = await getApproval(params.approvalId, params.alternateId, params.userId);
    if (!approval) {
      throw AgentError.from('TOOL_APPROVAL_NOT_FOUND', { approvalId: params.approvalId });
    }

    const decision = await decideApproval({
      approvalId: approval.id,
      approved: false,
      decidedBy: params.userId,
      rejectionReason: params.reason,
    });
    if (decision.count === 0) {
      throw AgentError.from('TOOL_APPROVAL_REJECTED', { reason: 'ALREADY_DECIDED' });
    }

    // The awaiting execution is terminal too — it must never fire later.
    await prisma.toolExecution.updateMany({
      where: {
        id: approval.toolExecutionId,
        status: ToolExecutionStatus.WAITING_FOR_APPROVAL,
      },
      data: {
        status: ToolExecutionStatus.CANCELLED,
        errorCode: 'TOOL_APPROVAL_REJECTED',
        errorMessage: 'The owner rejected this action',
        completedAt: new Date(),
      },
    });

    await auditAgentEvent({
      userId: params.userId,
      action: 'APPROVAL_REJECTED',
      entity: 'approval_request',
      entityId: approval.id,
      alternateId: params.alternateId,
      toolName: approval.toolName,
      requestId: params.requestId,
      metadata: { agentRunId: approval.agentRunId },
    });
    logger.info(
      { approvalId: approval.id, tool: approval.toolName, requestId: params.requestId },
      'approval_rejected',
    );

    return { approvalId: approval.id, status: ApprovalStatus.REJECTED };
  }

  /** Owner-facing tool catalogue with this Alternate's overrides applied. */
  async listTools(alternateId: string) {
    const configurations = await listToolConfigurations(alternateId);
    return toolRegistry.listMetadata().map((meta) => {
      const cfg = configurations.find((c) => c.toolName === meta.name);
      return {
        ...meta,
        isEnabled: cfg ? cfg.isEnabled : true,
        maxCallsPerRun: cfg?.maxCallsPerRun ?? null,
        requireApprovalOverride: cfg?.requireApproval ?? null,
      };
    });
  }

  async configureTool(params: {
    alternateId: string;
    userId: string;
    toolName: string;
    isEnabled?: boolean;
    allowedContexts?: AgentExecutionContext[];
    maxCallsPerRun?: number | null;
    requireApproval?: boolean | null;
  }) {
    if (!toolRegistry.has(params.toolName)) {
      throw AgentError.from('TOOL_NOT_FOUND', { tool: params.toolName });
    }
    const row = await upsertToolConfiguration(params);

    await auditAgentEvent({
      userId: params.userId,
      action: 'AGENT_RUN_STARTED',
      entity: 'tool_configuration',
      entityId: row.id,
      alternateId: params.alternateId,
      toolName: params.toolName,
      metadata: { change: 'TOOL_CONFIGURATION_UPDATED' },
    });
    return row;
  }

  /** Internal helper used by the worker and tests. */
  async getApprovalForExecution(toolExecutionId: string) {
    return getApprovalByExecution(toolExecutionId);
  }
}

export const agentService = new AgentService();

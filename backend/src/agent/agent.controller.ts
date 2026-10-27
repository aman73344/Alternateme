/**
 * Agent Controller
 *
 * Thin HTTP adapter. All authorization, policy and orchestration decisions live
 * in the service layer — the controller never decides permission.
 */

import { Request, Response, NextFunction } from 'express';
import { agentService } from './agent.service';
import { apiResponse } from '@/utils/response';
import { ValidationError } from '@/utils/errors';
import { AgentExecutionContext } from './agent.types';
import {
  ApprovalDecisionSchema,
  ListAgentRunsQuerySchema,
  ListApprovalsQuerySchema,
  StartAgentRunSchema,
} from './tools/tool.schemas';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function requireUuid(value: string, field: string): string {
  if (!value || !UUID_PATTERN.test(value)) {
    throw new ValidationError(`Invalid ${field}`, [{ path: field, message: 'must be a UUID' }]);
  }
  return value;
}

function formatRun(run: Record<string, unknown>) {
  return {
    id: run.id,
    status: run.status,
    goal: run.goal,
    executionContext: run.executionContext,
    conversationId: run.conversationId,
    stepCount: run.stepCount,
    toolCallCount: run.toolCallCount,
    llmCallCount: run.llmCallCount,
    tokenCount: run.tokenCount,
    failureCode: run.failureCode,
    startedAt: run.startedAt,
    completedAt: run.completedAt,
    createdAt: run.createdAt,
  };
}

function formatExecution(execution: Record<string, unknown>) {
  // Never return the full stored payload; the summary is the safe projection.
  return {
    id: execution.id,
    toolName: execution.toolName,
    riskLevel: execution.riskLevel,
    status: execution.status,
    executionContext: execution.executionContext,
    approvalRequired: execution.approvalRequired,
    inputSummary: execution.sanitizedInput,
    outputSummary: execution.outputSummary,
    errorCode: execution.errorCode,
    attempts: execution.attempts,
    durationMs: execution.durationMs,
    createdAt: execution.createdAt,
  };
}

function formatApproval(approval: Record<string, unknown>) {
  return {
    id: approval.id,
    agentRunId: approval.agentRunId,
    toolExecutionId: approval.toolExecutionId,
    toolName: approval.toolName,
    riskLevel: approval.riskLevel,
    status: approval.status,
    reason: approval.reason,
    sanitizedActionSummary: approval.sanitizedActionSummary,
    expiresAt: approval.expiresAt,
    approvedAt: approval.approvedAt,
    rejectedAt: approval.rejectedAt,
    executedAt: approval.executedAt,
    createdAt: approval.createdAt,
  };
}

/** POST /alternates/:alternateId/agent/runs */
export async function startAgentRun(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const alternateId = requireUuid(req.params.alternateId, 'alternateId');
    const userId = req.authUser!.id;
    const body = StartAgentRunSchema.parse(req.body);

    const result = await agentService.startRun({
      alternateId,
      userId,
      goal: body.goal,
      conversationId: body.conversationId,
      asynchronous: body.asynchronous,
      requestId: req.id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    if ('queued' in result) {
      apiResponse.accepted(res, { runId: result.runId, status: result.status, queued: true });
      return;
    }
    apiResponse.success(res, formatRun(result as unknown as Record<string, unknown>));
  } catch (err) {
    next(err);
  }
}

/** GET /alternates/:alternateId/agent/runs */
export async function listAgentRuns(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const alternateId = requireUuid(req.params.alternateId, 'alternateId');
    const userId = req.authUser!.id;
    const query = ListAgentRunsQuerySchema.parse(req.query);

    const { runs, totalCount } = await agentService.listRuns(alternateId, userId, query);
    apiResponse.paginated(
      res,
      runs.map((r) => formatRun(r as unknown as Record<string, unknown>)),
      totalCount,
      query.page,
      query.limit,
    );
  } catch (err) {
    next(err);
  }
}

/** GET /alternates/:alternateId/agent/runs/:runId */
export async function getAgentRun(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const alternateId = requireUuid(req.params.alternateId, 'alternateId');
    const runId = requireUuid(req.params.runId, 'runId');
    const run = await agentService.getRunDetail(runId, alternateId, req.authUser!.id);
    apiResponse.success(res, formatRun(run as unknown as Record<string, unknown>));
  } catch (err) {
    next(err);
  }
}

/** GET /alternates/:alternateId/agent/runs/:runId/executions */
export async function getAgentRunExecutions(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const alternateId = requireUuid(req.params.alternateId, 'alternateId');
    const runId = requireUuid(req.params.runId, 'runId');
    const executions = await agentService.getRunExecutions(runId, alternateId, req.authUser!.id);
    apiResponse.success(
      res,
      executions.map((e) => formatExecution(e as unknown as Record<string, unknown>)),
    );
  } catch (err) {
    next(err);
  }
}

/** GET /alternates/:alternateId/agent/approvals */
export async function listAgentApprovals(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const alternateId = requireUuid(req.params.alternateId, 'alternateId');
    const userId = req.authUser!.id;
    const query = ListApprovalsQuerySchema.parse(req.query);

    const { approvals, totalCount } = await agentService.listPendingApprovals(
      alternateId,
      userId,
      query,
    );
    apiResponse.paginated(
      res,
      approvals.map((a) => formatApproval(a as unknown as Record<string, unknown>)),
      totalCount,
      query.page,
      query.limit,
    );
  } catch (err) {
    next(err);
  }
}

/** POST /alternates/:alternateId/agent/approvals/:approvalId/approve */
export async function approveAgentAction(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const alternateId = requireUuid(req.params.alternateId, 'alternateId');
    const approvalId = requireUuid(req.params.approvalId, 'approvalId');
    const result = await agentService.approveToolCall({
      approvalId,
      alternateId,
      userId: req.authUser!.id,
      requestId: req.id,
    });
    apiResponse.success(res, result);
  } catch (err) {
    next(err);
  }
}

/** POST /alternates/:alternateId/agent/approvals/:approvalId/reject */
export async function rejectAgentAction(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const alternateId = requireUuid(req.params.alternateId, 'alternateId');
    const approvalId = requireUuid(req.params.approvalId, 'approvalId');
    const body = ApprovalDecisionSchema.parse(req.body ?? {});
    const result = await agentService.rejectToolCall({
      approvalId,
      alternateId,
      userId: req.authUser!.id,
      reason: body.reason,
      requestId: req.id,
    });
    apiResponse.success(res, result);
  } catch (err) {
    next(err);
  }
}

/** GET /alternates/:alternateId/agent/tools */
export async function listAgentTools(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const alternateId = requireUuid(req.params.alternateId, 'alternateId');
    apiResponse.success(res, await agentService.listTools(alternateId));
  } catch (err) {
    next(err);
  }
}

/** PUT /alternates/:alternateId/agent/tools/:toolName */
export async function configureAgentTool(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const alternateId = requireUuid(req.params.alternateId, 'alternateId');
    const userId = req.authUser!.id;
    const { isEnabled, allowedContexts, maxCallsPerRun, requireApproval } = req.body ?? {};

    if (allowedContexts !== undefined && !Array.isArray(allowedContexts)) {
      throw new ValidationError('allowedContexts must be an array');
    }

    const row = await agentService.configureTool({
      alternateId,
      userId,
      toolName: req.params.toolName,
      isEnabled,
      allowedContexts: allowedContexts as AgentExecutionContext[] | undefined,
      maxCallsPerRun,
      requireApproval,
    });

    apiResponse.success(res, {
      id: row.id,
      toolName: row.toolName,
      isEnabled: row.isEnabled,
      maxCallsPerRun: row.maxCallsPerRun,
      requireApproval: row.requireApproval,
      updatedAt: row.updatedAt,
    });
  } catch (err) {
    next(err);
  }
}

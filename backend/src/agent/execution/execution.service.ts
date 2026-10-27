/**
 * Tool Execution Service
 *
 * One tool call, end to end:
 *   authorize → validate input → idempotency → approval gate → execute
 *   (timeout + retry) → validate/sanitize result → persist → audit
 *
 * Nothing in here trusts the model: arguments are re-parsed with the tool's own
 * schema, and results are treated as untrusted data before they are stored or
 * shown to the model.
 */

import { logger } from '@/utils/logger';
import { BaseError } from '@/utils/errors';
import { AGENT_DEFAULTS } from '../agent.constants';
import { AgentError } from '../agent.errors';
import { auditAgentEvent } from '../agent.audit';
import {
  AgentExecutionContext,
  ToolExecutionStatus,
  type AgentLimits,
  type SanitizedToolResult,
  type ToolExecutionContext,
} from '../agent.types';
import {
  createApproval,
  createToolExecution,
  findExecutionByIdempotencyKey,
  getToolExecutionById,
  updateToolExecution,
} from '../agent.repository';
import { authorizeToolCall } from '../tools/authorization.service';
import { sanitizeToolInput, sanitizeToolResult } from '../tools/tool-sanitizer';
import { toolRegistry, type RegisteredTool } from '../tools/tool.registry';
import { approvalExpiry, deriveIdempotencyKey } from './idempotency.service';
import { withRetry } from './retry-policy';

export interface ExecuteToolCallInput {
  agentRunId: string;
  alternateId: string;
  userId: string;
  requestedContext: AgentExecutionContext;
  toolName: string;
  rawArguments: unknown;
  limits: AgentLimits;
  toolCallCountForTool: number;
  toolCallCountTotal: number;
  requestId?: string;
}

export type ToolExecutionOutcome =
  | {
      kind: 'completed';
      executionId: string;
      toolName: string;
      result: SanitizedToolResult;
      durationMs: number;
      replayed: boolean;
    }
  | {
      kind: 'awaiting_approval';
      executionId: string;
      approvalId: string;
      toolName: string;
      reason: string;
    };

interface RunExecutionArgs {
  executionId: string;
  tool: RegisteredTool;
  toolContext: ToolExecutionContext;
  validatedArgs: unknown;
  limits: AgentLimits;
  audit: { userId: string; alternateId: string; agentRunId: string; requestId?: string };
  startedAt: number;
}

/** Reject a promise that outlives its budget without leaking the timer. */
async function withTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
  onTimeout: () => Error,
): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      fn(),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(onTimeout()), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function errorCode(err: unknown): string {
  if (err instanceof BaseError) return err.code;
  return 'AGENT_EXECUTION_FAILED';
}

/**
 * Execute one validated, authorized tool call.
 * Throws an `AgentError` for every terminal condition so the loop can decide
 * whether to continue, stop, or report.
 */
export async function executeToolCall(input: ExecuteToolCallInput): Promise<ToolExecutionOutcome> {
  const startedAt = Date.now();

  // 1. Authorization (server-side, non-bypassable).
  const authorized = await authorizeToolCall({
    alternateId: input.alternateId,
    userId: input.userId,
    toolName: input.toolName,
    requestedContext: input.requestedContext,
    toolCallCountForTool: input.toolCallCountForTool,
    toolCallCountTotal: input.toolCallCountTotal,
    limits: input.limits,
    requestId: input.requestId,
  });
  const { tool } = authorized;

  logger.info(
    {
      runId: input.agentRunId,
      alternateId: input.alternateId,
      tool: input.toolName,
      executionContext: authorized.executionContext,
      requestId: input.requestId,
    },
    'tool_authorized',
  );

  // 2. Input validation — the model's JSON is untrusted even when it "looks right".
  const parsed = tool.inputSchema.safeParse(input.rawArguments ?? {});
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => ({
      path: i.path.join('.'),
      message: i.message,
    }));
    logger.warn({ runId: input.agentRunId, tool: input.toolName, issues }, 'tool_denied');
    await auditAgentEvent({
      userId: input.userId,
      action: 'TOOL_EXECUTION_DENIED',
      entity: 'tool_execution',
      alternateId: input.alternateId,
      toolName: input.toolName,
      errorCode: 'TOOL_INVALID_INPUT',
      requestId: input.requestId,
      metadata: { agentRunId: input.agentRunId, reason: 'INVALID_INPUT' },
    });
    throw AgentError.from('TOOL_INVALID_INPUT', { tool: input.toolName, issues });
  }
  const validatedArgs = parsed.data;

  // 3. Idempotency — same (alternate, tool, args) executes once.
  const idempotencyKey = deriveIdempotencyKey(input.alternateId, input.toolName, validatedArgs);
  const existing = await findExecutionByIdempotencyKey(
    input.alternateId,
    input.toolName,
    idempotencyKey,
  );
  if (existing && existing.status === ToolExecutionStatus.SUCCEEDED) {
    logger.info(
      { runId: input.agentRunId, tool: input.toolName, executionId: existing.id },
      'tool.idempotent_replay',
    );
    const replayed = sanitizeToolResult(
      input.toolName,
      existing.output,
      input.limits.maxToolResultChars,
    );
    return {
      kind: 'completed',
      executionId: existing.id,
      toolName: input.toolName,
      result: replayed,
      durationMs: Date.now() - startedAt,
      replayed: true,
    };
  }

  // 4. Persist the attempt. Raw model output is deliberately NOT persisted —
  //    only the redacted form survives to the database.
  const sanitizedInput = sanitizeToolInput(validatedArgs);
  const execution = await createToolExecution({
    agentRunId: input.agentRunId,
    alternateId: input.alternateId,
    userId: input.userId,
    executionContext: authorized.executionContext,
    toolName: input.toolName,
    riskLevel: tool.riskLevel,
    idempotencyKey,
    sanitizedInput: sanitizedInput.sanitized,
    approvalRequired: authorized.requiresApproval,
  });

  await auditAgentEvent({
    userId: input.userId,
    action: 'TOOL_EXECUTION_REQUESTED',
    entity: 'tool_execution',
    entityId: execution.id,
    alternateId: input.alternateId,
    toolName: input.toolName,
    requestId: input.requestId,
    metadata: { agentRunId: input.agentRunId, riskLevel: tool.riskLevel },
  });

  // 5. Approval gate — the run stops here and waits for a human decision.
  if (authorized.requiresApproval) {
    const approval = await createApproval({
      agentRunId: input.agentRunId,
      toolExecutionId: execution.id,
      alternateId: input.alternateId,
      userId: input.userId,
      toolName: input.toolName,
      riskLevel: tool.riskLevel,
      reason: `Risk level ${tool.riskLevel} requires owner approval`,
      sanitizedActionSummary: sanitizedInput.summary,
      expiresAt: approvalExpiry(),
    });
    await updateToolExecution(execution.id, {
      status: ToolExecutionStatus.WAITING_FOR_APPROVAL,
    });
    await auditAgentEvent({
      userId: input.userId,
      action: 'APPROVAL_REQUESTED',
      entity: 'approval_request',
      entityId: approval.id,
      alternateId: input.alternateId,
      toolName: input.toolName,
      requestId: input.requestId,
      metadata: { agentRunId: input.agentRunId, riskLevel: tool.riskLevel },
    });
    logger.info(
      { runId: input.agentRunId, approvalId: approval.id, tool: input.toolName },
      'approval_requested',
    );
    return {
      kind: 'awaiting_approval',
      executionId: execution.id,
      approvalId: approval.id,
      toolName: input.toolName,
      reason: `Risk level ${tool.riskLevel} requires owner approval`,
    };
  }

  // 6. Execute.
  return runExecution({
    executionId: execution.id,
    tool,
    toolContext: { ...authorized.toolExecutionContext, agentRunId: input.agentRunId },
    validatedArgs,
    limits: input.limits,
    audit: {
      userId: input.userId,
      alternateId: input.alternateId,
      agentRunId: input.agentRunId,
      requestId: input.requestId,
    },
    startedAt,
  });
}

/** Execute an already-authorized call with timeout, retry and persistence. */
async function runExecution(args: RunExecutionArgs): Promise<ToolExecutionOutcome> {
  const { executionId, tool, toolContext, validatedArgs, limits, audit, startedAt } = args;
  const timeoutMs = tool.timeoutMs ?? limits.maxToolRuntimeMs;

  await updateToolExecution(executionId, {
    status: ToolExecutionStatus.RUNNING,
    startedAt: new Date(startedAt),
  });
  logger.info({ runId: audit.agentRunId, tool: tool.name, executionId }, 'tool_started');

  try {
    const output = await withRetry(
      () =>
        withTimeout(
          () => tool.execute(toolContext, validatedArgs),
          timeoutMs,
          () => AgentError.from('TOOL_TIMEOUT', { tool: tool.name, timeoutMs }),
        ),
      {
        maxAttempts: AGENT_DEFAULTS.MAX_TOOL_ATTEMPTS,
        onRetry: ({ attempt, delayMs }) => {
          logger.warn(
            { runId: audit.agentRunId, tool: tool.name, attempt, delayMs },
            'tool.retry_scheduled',
          );
          void updateToolExecution(executionId, { attempts: attempt });
        },
      },
    );

    // Validate + sanitize before the result reaches the model or the database.
    const result = sanitizeToolResult(tool.name, output, limits.maxToolResultChars);
    const durationMs = Date.now() - startedAt;

    await updateToolExecution(executionId, {
      status: ToolExecutionStatus.SUCCEEDED,
      output: result.content,
      outputSummary: result.summary,
      completedAt: new Date(),
      durationMs,
      errorCode: null,
      errorMessage: null,
    });

    logger.info(
      { runId: audit.agentRunId, tool: tool.name, status: 'SUCCEEDED', durationMs },
      'tool_completed',
    );
    await auditAgentEvent({
      userId: audit.userId,
      action: 'TOOL_EXECUTED',
      entity: 'tool_execution',
      entityId: executionId,
      alternateId: audit.alternateId,
      toolName: tool.name,
      status: ToolExecutionStatus.SUCCEEDED,
      durationMs,
      requestId: audit.requestId,
      metadata: {
        agentRunId: audit.agentRunId,
        truncated: result.truncated,
        redacted: result.redacted,
        neutralised: result.neutralised,
      },
    });

    return {
      kind: 'completed',
      executionId,
      toolName: tool.name,
      result,
      durationMs,
      replayed: false,
    };
  } catch (err) {
    const durationMs = Date.now() - startedAt;
    const code = errorCode(err);
    const timedOut = code === 'TOOL_TIMEOUT';

    await updateToolExecution(executionId, {
      status: timedOut ? ToolExecutionStatus.TIMED_OUT : ToolExecutionStatus.FAILED,
      errorCode: code,
      // Safe message only — never a stack trace or raw provider payload.
      errorMessage: err instanceof AgentError ? err.safeMessage : 'Tool execution failed',
      completedAt: new Date(),
      durationMs,
    });

    logger.error(
      { runId: audit.agentRunId, tool: tool.name, errorCode: code, durationMs, err },
      timedOut ? 'tool_timeout' : 'tool_failed',
    );
    await auditAgentEvent({
      userId: audit.userId,
      action: 'TOOL_FAILED',
      entity: 'tool_execution',
      entityId: executionId,
      alternateId: audit.alternateId,
      toolName: tool.name,
      errorCode: code,
      durationMs,
      requestId: audit.requestId,
      metadata: { agentRunId: audit.agentRunId },
    });

    throw err instanceof AgentError
      ? err
      : AgentError.from('TOOL_EXECUTION_FAILED', { tool: tool.name, errorCode: code });
  }
}

/**
 * Continue an execution whose approval was granted.
 * Re-checks that the ToolExecution is genuinely awaiting approval before
 * running anything — an approval id alone is never sufficient.
 */
export async function executeApprovedCall(params: {
  toolExecutionId: string;
  limits: AgentLimits;
  requestId?: string;
}): Promise<ToolExecutionOutcome> {
  const execution = await getToolExecutionById(params.toolExecutionId);
  if (!execution) {
    throw AgentError.from('TOOL_APPROVAL_NOT_FOUND', { id: params.toolExecutionId });
  }
  if (execution.status !== ToolExecutionStatus.WAITING_FOR_APPROVAL) {
    throw AgentError.from('TOOL_EXECUTION_FAILED', {
      reason: 'EXECUTION_NOT_AWAITING_APPROVAL',
      status: execution.status,
    });
  }

  const tool = toolRegistry.get(execution.toolName);
  const executionContext = execution.executionContext as AgentExecutionContext;

  return runExecution({
    executionId: execution.id,
    tool,
    toolContext: {
      userId: execution.userId,
      alternateId: execution.alternateId,
      agentRunId: execution.agentRunId,
      executionContext,
      isOwner: executionContext === AgentExecutionContext.OWNER,
      requestId: params.requestId,
    },
    // The tool was already validated once, before the approval was requested.
    validatedArgs: execution.sanitizedInput ?? {},
    limits: params.limits,
    audit: {
      userId: execution.userId,
      alternateId: execution.alternateId,
      agentRunId: execution.agentRunId,
      requestId: params.requestId,
    },
    startedAt: Date.now(),
  });
}

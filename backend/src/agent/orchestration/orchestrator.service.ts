/**
 * Agent Orchestrator
 *
 * The bounded execution loop. It is deliberately provider-agnostic: all model
 * access goes through the Phase 4 `LLMProvider` abstraction, and no OpenAI or
 * Anthropic detail appears in this file.
 *
 * The orchestrator coordinates. It does not decide permission — every tool call
 * is re-authorized inside `executeToolCall`, and the risk/approval decision is
 * made by the policy service.
 *
 * Loop:
 *   create run → load context → LLM call → tool call? → authorize → policy →
 *   approval? (wait) → execute → append result → repeat → final response
 */

import { logger } from '@/utils/logger';
import { BaseError } from '@/utils/errors';
import { createLLMProvider } from '@/rag/llm-provider';
import { providerService } from '@/ai-providers/provider.service';
import type { ChatMessage, LLMToolCall } from '@/rag/types';

import { AgentError } from '../agent.errors';
import { auditAgentEvent } from '../agent.audit';
import {
  AgentExecutionContext,
  AgentRunStatus,
  AgentStepStatus,
  AgentStepType,
  type AgentLimits,
} from '../agent.types';
import {
  completeRun,
  createRun,
  createStep,
  failRun,
  markRunStarted,
  setRunWaitingForApproval,
  updateRunProgress,
  updateStep,
} from '../agent.repository';
import { registerBuiltInTools, toolRegistry, toJsonSchema } from '../tools';
import { sanitizeToolResult } from '../tools/tool-sanitizer';
import { assertCanStartRun } from '../tools/authorization.service';
import { resolveLimits } from '../tools/tool-policy.service';
import { executeToolCall, type ToolExecutionOutcome } from '../execution/execution.service';
import { buildAgentMessages } from './agent-prompt';
import { loadAgentContext } from './context.service';

export interface StartRunInput {
  alternateId: string;
  userId: string;
  goal: string;
  conversationId?: string;
  requestId?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface AgentRunResult {
  runId: string;
  status: AgentRunStatus;
  content: string;
  sources: Array<{ title: string; url?: string; page?: number }>;
  stepCount: number;
  toolCallCount: number;
  /** Present when the run paused for a human decision. */
  pendingApproval?: { approvalId: string; toolName: string; reason: string };
}

/** Error class used to unwind the loop when a run reaches its failure state. */
class RunFailure extends Error {
  constructor(
    public readonly agentError: AgentError,
    public readonly runStatus: AgentRunStatus,
  ) {
    super(agentError.safeMessage);
    this.name = 'RunFailure';
  }
}

export class AgentOrchestrator {
  private readonly limits: AgentLimits = resolveLimits();

  /**
   * Execute a full agent run for a goal.
   * Conversation state is never held in an open transaction across an LLM or
   * tool call — each persistence step is its own query.
   */
  async run(input: StartRunInput): Promise<AgentRunResult> {
    registerBuiltInTools();

    // 1. Can this user start a run at all?
    const { isOwner } = await assertCanStartRun(input.alternateId, input.userId);
    const executionContext = isOwner
      ? AgentExecutionContext.OWNER
      : AgentExecutionContext.PUBLIC_VISITOR;

    // 2. Persist the run before any model work begins.
    const run = await createRun({
      alternateId: input.alternateId,
      userId: input.userId,
      conversationId: input.conversationId ?? null,
      executionContext,
      goal: input.goal,
    });
    await markRunStarted(run.id);

    const runStartedAt = Date.now();
    logger.info(
      {
        runId: run.id,
        alternateId: input.alternateId,
        executionContext,
        requestId: input.requestId,
      },
      'agent_run_started',
    );
    await auditAgentEvent({
      userId: input.userId,
      action: 'AGENT_RUN_STARTED',
      entity: 'agent_run',
      entityId: run.id,
      alternateId: input.alternateId,
      requestId: input.requestId,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      metadata: { executionContext },
    });

    try {
      return await this.executeLoop({ run, input, executionContext, runStartedAt });
    } catch (err) {
      return this.handleFailure(run.id, input, err, runStartedAt);
    }
  }

  /**
   * Which tools may be *offered* to the model for this context.
   * This is a UX filter only — the real gate is `authorizeToolCall` at call time.
   */
  private async resolveAllowedTools(alternateId: string, executionContext: AgentExecutionContext) {
    const { listToolConfigurations } = await import('../agent.repository');
    const { isContextPermitted } = await import('../tools/tool-policy.service');
    const configurations = await listToolConfigurations(alternateId);

    return toolRegistry
      .list()
      .filter((tool) => {
        const cfg = configurations.find((c) => c.toolName === tool.name) ?? null;
        if (cfg && !cfg.isEnabled) return false;
        return isContextPermitted(tool, executionContext, cfg).allowed;
      })
      .map((tool) => ({
        name: tool.name,
        description: tool.description,
        parameters: toJsonSchema(tool.inputSchema),
      }));
  }

  private assertWithinLimits(params: {
    stepCount: number;
    toolCallCount: number;
    llmCallCount: number;
    deadline: number;
  }): void {
    const { stepCount, toolCallCount, llmCallCount, deadline } = params;
    if (stepCount >= this.limits.maxSteps) {
      throw new RunFailure(
        AgentError.from('AGENT_MAX_STEPS', { stepCount }),
        AgentRunStatus.FAILED,
      );
    }
    if (toolCallCount >= this.limits.maxToolCalls) {
      throw new RunFailure(
        AgentError.from('AGENT_MAX_TOOL_CALLS', { toolCallCount }),
        AgentRunStatus.FAILED,
      );
    }
    if (llmCallCount >= this.limits.maxLlmCalls) {
      throw new RunFailure(
        AgentError.from('AGENT_MAX_LLM_CALLS', { llmCallCount }),
        AgentRunStatus.FAILED,
      );
    }
    if (Date.now() >= deadline) {
      throw new RunFailure(AgentError.from('AGENT_TIMEOUT', {}), AgentRunStatus.TIMED_OUT);
    }
  }

  private async executeLoop(params: {
    run: { id: string };
    input: StartRunInput;
    executionContext: AgentExecutionContext;
    runStartedAt: number;
  }): Promise<AgentRunResult> {
    const { run, input, executionContext, runStartedAt } = params;
    const limits = this.limits;
    const deadline = runStartedAt + limits.maxRuntimeMs;

    // Provider resolution (Phase 4 abstraction; keys are never logged here).
    const providerConfig = await providerService.getDecryptedApiKey(
      input.alternateId,
      input.userId,
    );
    if (!providerConfig) {
      throw new RunFailure(
        AgentError.from('AGENT_PROVIDER_UNAVAILABLE', { reason: 'NO_PROVIDER_CONFIGURED' }),
        AgentRunStatus.FAILED,
      );
    }
    const provider = createLLMProvider(providerConfig.provider as 'OPENAI' | 'ANTHROPIC');
    const model = providerConfig.defaultModel ?? 'gpt-4o';

    const context = await loadAgentContext({
      alternateId: input.alternateId,
      userId: input.userId,
      goal: input.goal,
      conversationId: input.conversationId,
      executionContext,
    });

    const allowedTools = await this.resolveAllowedTools(input.alternateId, executionContext);

    let stepCount = 0;
    let toolCallCount = 0;
    let llmCallCount = 0;
    let tokenCount = 0;
    const perToolCounts = new Map<string, number>();
    const toolResultBlocks: ChatMessage[] = [];
    let pendingToolResults: Array<{ toolCallId: string; name: string; content: string }> = [];

    for (;;) {
      this.assertWithinLimits({ stepCount, toolCallCount, llmCallCount, deadline });

      stepCount += 1;
      llmCallCount += 1;

      // --- LLM call -------------------------------------------------------
      const llmStep = await createStep({
        agentRunId: run.id,
        stepNumber: stepCount,
        type: AgentStepType.LLM_CALL,
        status: AgentStepStatus.STARTED,
      });
      const llmStartedAt = Date.now();

      let response;
      try {
        const messages = buildAgentMessages({
          base: context.messages,
          toolResults: toolResultBlocks,
          allowedTools,
          executionContext,
          maxContextTokens: limits.maxContextTokens,
        });

        response = await provider.generateChatCompletion({
          messages,
          model,
          temperature: 0.3,
          maxTokens: 1024,
          ...(allowedTools.length > 0 ? { tools: allowedTools, toolChoice: 'auto' as const } : {}),
          ...(pendingToolResults.length > 0 ? { toolResults: pendingToolResults } : {}),
        });
      } catch (err) {
        await updateStep(llmStep.id, {
          status: AgentStepStatus.FAILED,
          errorCode: 'AGENT_PROVIDER_UNAVAILABLE',
          durationMs: Date.now() - llmStartedAt,
        });
        throw new RunFailure(
          AgentError.from('AGENT_PROVIDER_UNAVAILABLE', { cause: (err as Error)?.message }),
          AgentRunStatus.FAILED,
        );
      }

      tokenCount += response.tokensUsed ?? 0;
      const toolCalls: LLMToolCall[] = response.toolCalls ?? [];

      await updateStep(llmStep.id, {
        status: AgentStepStatus.COMPLETED,
        durationMs: Date.now() - llmStartedAt,
        // Operational metadata only — never the raw response body.
        outputSummary:
          toolCalls.length > 0
            ? `requested ${toolCalls.length} tool call(s): ${toolCalls.map((c) => c.name).join(', ')}`
            : `final response (${response.content.length} chars)`,
      });
      await updateRunProgress(run.id, { stepCount, llmCallCount, tokenCount });

      // --- No tool call → final answer -------------------------------------
      if (toolCalls.length === 0) {
        await createStep({
          agentRunId: run.id,
          stepNumber: stepCount,
          type: AgentStepType.FINAL_RESPONSE,
          status: AgentStepStatus.COMPLETED,
          outputSummary: `final response (${response.content.length} chars)`,
        });

        await completeRun(run.id, { tokenCount, stepCount });
        const durationMs = Date.now() - runStartedAt;
        logger.info(
          { runId: run.id, alternateId: input.alternateId, stepCount, toolCallCount, durationMs },
          'agent_run_completed',
        );
        await auditAgentEvent({
          userId: input.userId,
          action: 'AGENT_RUN_COMPLETED',
          entity: 'agent_run',
          entityId: run.id,
          alternateId: input.alternateId,
          durationMs,
          requestId: input.requestId,
          metadata: { stepCount, toolCallCount, tokenCount },
        });

        return {
          runId: run.id,
          status: AgentRunStatus.COMPLETED,
          content: response.content,
          sources: context.citations.map((c) => ({
            title: c.title,
            url: c.url,
            page: c.page,
          })),
          stepCount,
          toolCallCount,
        };
      }

      // --- Tool calls ------------------------------------------------------
      const nextToolResults: Array<{ toolCallId: string; name: string; content: string }> = [];

      for (const call of toolCalls) {
        this.assertWithinLimits({ stepCount, toolCallCount, llmCallCount, deadline });
        toolCallCount += 1;

        const outcome = await this.handleToolCall({
          runId: run.id,
          input,
          executionContext,
          call,
          stepCount,
          perToolCounts,
          totalToolCalls: toolCallCount,
        });

        if (outcome.kind === 'awaiting_approval') {
          // The run pauses. A human decision is required before anything runs.
          await setRunWaitingForApproval(run.id);
          return {
            runId: run.id,
            status: AgentRunStatus.WAITING_FOR_APPROVAL,
            content: `This action needs your approval before I can continue: ${outcome.reason}`,
            sources: [],
            stepCount,
            toolCallCount,
            pendingApproval: {
              approvalId: outcome.approvalId,
              toolName: outcome.toolName,
              reason: outcome.reason,
            },
          };
        }

        nextToolResults.push({
          toolCallId: call.id,
          name: outcome.toolName,
          content: outcome.result.content,
        });
      }

      // Feed results back in as untrusted data and continue the loop.
      toolResultBlocks.push({
        role: 'SYSTEM',
        content: nextToolResults.map((r) => r.content).join('\n\n'),
      });
      pendingToolResults = nextToolResults;
      // __PART_B__
    }
  }

  /**
   * Execute one requested tool call. A tool failure becomes a safe,
   * model-readable outcome rather than killing the run — with one exception:
   * authorization/approval denials return an explicit refusal the model is told
   * not to retry, so it cannot talk its way around a denial.
   */
  private async handleToolCall(params: {
    runId: string;
    input: StartRunInput;
    executionContext: AgentExecutionContext;
    call: LLMToolCall;
    stepCount: number;
    perToolCounts: Map<string, number>;
    totalToolCalls: number;
  }): Promise<ToolExecutionOutcome> {
    const { runId, input, executionContext, call, stepCount, perToolCounts, totalToolCalls } =
      params;

    const toolStep = await createStep({
      agentRunId: runId,
      stepNumber: stepCount,
      type: AgentStepType.TOOL_CALL,
      status: AgentStepStatus.STARTED,
      toolName: call.name,
      inputSummary: `${call.name} requested`,
    });
    const stepStartedAt = Date.now();

    logger.info(
      { runId, alternateId: input.alternateId, tool: call.name, requestId: input.requestId },
      'tool_requested',
    );

    const countForTool = perToolCounts.get(call.name) ?? 0;

    try {
      const outcome = await executeToolCall({
        agentRunId: runId,
        alternateId: input.alternateId,
        userId: input.userId,
        requestedContext: executionContext,
        toolName: call.name,
        rawArguments: call.arguments,
        limits: this.limits,
        toolCallCountForTool: countForTool,
        toolCallCountTotal: totalToolCalls - 1,
        requestId: input.requestId,
      });

      perToolCounts.set(call.name, countForTool + 1);
      await updateStep(toolStep.id, {
        status: AgentStepStatus.COMPLETED,
        durationMs: Date.now() - stepStartedAt,
        outputSummary: outcome.kind === 'completed' ? outcome.result.summary : outcome.reason,
      });

      if (outcome.kind === 'awaiting_approval') {
        await createStep({
          agentRunId: runId,
          stepNumber: stepCount,
          type: AgentStepType.APPROVAL_WAIT,
          status: AgentStepStatus.STARTED,
          toolName: call.name,
          outputSummary: outcome.reason,
        });
      }

      return outcome;
    } catch (err) {
      const agentError =
        err instanceof AgentError
          ? err
          : AgentError.from('TOOL_EXECUTION_FAILED', { tool: call.name });

      await updateStep(toolStep.id, {
        status: AgentStepStatus.FAILED,
        durationMs: Date.now() - stepStartedAt,
        errorCode: agentError.code,
      });

      const refusal =
        agentError.code === 'TOOL_NOT_ALLOWED' ||
        agentError.code === 'AGENT_UNAUTHORIZED' ||
        agentError.code === 'TOOL_DISABLED' ||
        agentError.code === 'TOOL_NOT_FOUND';

      const safeContent = sanitizeToolResult(
        call.name,
        {
          ok: false,
          errorCode: agentError.code,
          // User-safe message only, never the internal diagnostic.
          message: agentError.safeMessage,
          guidance: refusal
            ? 'This capability is not permitted. Do not retry it and do not claim it happened.'
            : 'You may adjust the arguments and try once more, or answer without it.',
        },
        this.limits.maxToolResultChars,
      ).content;

      return {
        kind: 'completed',
        executionId: '',
        toolName: call.name,
        result: {
          toolName: call.name,
          content: safeContent,
          summary: `error: ${agentError.code}`,
          truncated: false,
          redacted: false,
          neutralised: false,
        },
        durationMs: Date.now() - stepStartedAt,
        replayed: false,
      };
    }
  }

  private async handleFailure(
    runId: string,
    input: StartRunInput,
    err: unknown,
    runStartedAt: number,
  ): Promise<AgentRunResult> {
    // Unwrap the loop's RunFailure so the persisted code/status match the cause.
    const unwrapped = err instanceof RunFailure ? err.agentError : err;
    const runStatus =
      err instanceof RunFailure
        ? err.runStatus
        : unwrapped instanceof AgentError && unwrapped.code === 'AGENT_TIMEOUT'
          ? AgentRunStatus.TIMED_OUT
          : AgentRunStatus.FAILED;

    const agentError =
      unwrapped instanceof AgentError
        ? unwrapped
        : unwrapped instanceof BaseError
          ? AgentError.from('AGENT_EXECUTION_FAILED', { cause: unwrapped.code })
          : AgentError.from('AGENT_EXECUTION_FAILED', { cause: 'UNKNOWN' });

    await failRun(runId, runStatus, agentError.code, agentError.safeMessage);
    logger.error(
      {
        runId,
        alternateId: input.alternateId,
        errorCode: agentError.code,
        durationMs: Date.now() - runStartedAt,
        err,
      },
      'agent_run_failed',
    );
    await auditAgentEvent({
      userId: input.userId,
      action: 'AGENT_RUN_FAILED',
      entity: 'agent_run',
      entityId: runId,
      alternateId: input.alternateId,
      errorCode: agentError.code,
      durationMs: Date.now() - runStartedAt,
      requestId: input.requestId,
    });

    // Failure isolation: the caller receives a safe message, and the
    // conversation is left intact for a retry or a normal (non-agent) answer.
    throw agentError;
  }
}

export const agentOrchestrator = new AgentOrchestrator();

/**
 * Phase 6 — agent loop / limits / approval-flow tests.
 *
 * These run the REAL orchestrator, the REAL execution service, the REAL
 * authorization service and the REAL policy. Only the database and the LLM
 * provider are faked, so the tests cover the actual control flow rather than a
 * re-implementation of it.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  alternateFindFirst: vi.fn(),
  createRun: vi.fn(),
  markRunStarted: vi.fn(),
  createStep: vi.fn(),
  updateStep: vi.fn(),
  updateRunProgress: vi.fn(),
  completeRun: vi.fn(),
  failRun: vi.fn(),
  setRunWaitingForApproval: vi.fn(),
  listToolConfigurations: vi.fn(),
  createToolExecution: vi.fn(),
  findExecutionByIdempotencyKey: vi.fn(),
  updateToolExecution: vi.fn(),
  createApproval: vi.fn(),
  getToolExecutionById: vi.fn(),
  createAuditLog: vi.fn(),
  ragRetrieve: vi.fn(),
  memoryRetrieve: vi.fn(),
  getRecentMessages: vi.fn(),
  loadPersona: vi.fn(),
  getDecryptedApiKey: vi.fn(),
  generateChatCompletion: vi.fn(),
}));

vi.mock('@/database', () => ({
  prisma: {
    alternate: { findFirst: mocks.alternateFindFirst },
    toolExecution: { updateMany: vi.fn(), findFirst: vi.fn() },
    approvalRequest: { updateMany: vi.fn(), findMany: vi.fn(), count: vi.fn() },
  },
}));

vi.mock('@/agent/agent.repository', () => ({
  createRun: mocks.createRun,
  markRunStarted: mocks.markRunStarted,
  createStep: mocks.createStep,
  updateStep: mocks.updateStep,
  updateRunProgress: mocks.updateRunProgress,
  completeRun: mocks.completeRun,
  failRun: mocks.failRun,
  setRunWaitingForApproval: mocks.setRunWaitingForApproval,
  listToolConfigurations: mocks.listToolConfigurations,
  createToolExecution: mocks.createToolExecution,
  findExecutionByIdempotencyKey: mocks.findExecutionByIdempotencyKey,
  updateToolExecution: mocks.updateToolExecution,
  createApproval: mocks.createApproval,
  getToolExecutionById: mocks.getToolExecutionById,
}));

vi.mock('@/auth/repositories/audit.repository', () => ({ createAuditLog: mocks.createAuditLog }));
vi.mock('@/rag/rag.service', () => ({ ragService: { retrieve: mocks.ragRetrieve } }));
vi.mock('@/memory/memory.retrieval', () => ({
  memoryRetrievalService: { retrieve: mocks.memoryRetrieve },
}));
vi.mock('@/chat/conversation.service', () => ({
  conversationService: { getRecentMessages: mocks.getRecentMessages },
}));
vi.mock('@/chat/chat.service', () => ({ loadPersona: mocks.loadPersona }));
vi.mock('@/ai-providers/provider.service', () => ({
  providerService: { getDecryptedApiKey: mocks.getDecryptedApiKey },
}));
vi.mock('@/rag/llm-provider', () => ({
  createLLMProvider: () => ({
    name: 'FAKE',
    generateChatCompletion: mocks.generateChatCompletion,
    getModelInfo: () => ({ name: 'fake', maxTokens: 1000 }),
    healthCheck: async () => true,
  }),
}));

import { agentOrchestrator } from '@/agent/orchestration/orchestrator.service';
import { AgentRunStatus } from '@/agent/agent.types';

const OWNER = '11111111-1111-4111-8111-111111111111';
const ALT = '33333333-3333-4333-8333-333333333333';
const RUN = '44444444-4444-4444-8444-444444444444';

function toolCall(id: string, name: string, args: unknown) {
  return { id, name, arguments: args };
}

function setAlternate(overrides: Record<string, unknown> = {}) {
  mocks.alternateFindFirst.mockResolvedValue({
    id: ALT,
    userId: OWNER,
    visibility: 'PUBLIC',
    status: 'PUBLISHED',
    agentEnabled: true,
    displayName: 'Ada',
    title: 'Engineer',
    bio: 'Builds things',
    ...overrides,
  });
}

describe('AgentOrchestrator loop', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    setAlternate();
    mocks.createRun.mockResolvedValue({ id: RUN });
    mocks.markRunStarted.mockResolvedValue({});
    mocks.createStep.mockImplementation(async (i: { stepNumber: number }) => ({
      id: `step-${i.stepNumber}`,
    }));
    mocks.updateStep.mockResolvedValue({});
    mocks.updateRunProgress.mockResolvedValue({});
    mocks.completeRun.mockResolvedValue({});
    mocks.failRun.mockResolvedValue({});
    mocks.setRunWaitingForApproval.mockResolvedValue({});
    mocks.listToolConfigurations.mockResolvedValue([]);
    mocks.createToolExecution.mockImplementation(async (i: Record<string, unknown>) => ({
      id: `exec-${i.toolName}`,
      ...i,
    }));
    mocks.findExecutionByIdempotencyKey.mockResolvedValue(null);
    mocks.updateToolExecution.mockResolvedValue({});
    mocks.createApproval.mockResolvedValue({ id: 'approval-1' });
    mocks.createAuditLog.mockResolvedValue({});

    mocks.ragRetrieve.mockResolvedValue({
      chunks: [],
      citations: [],
      hasRelevantContext: false,
      candidateCount: 0,
      finalCount: 0,
      query: 'q',
      normalizedQuery: 'q',
      latencyMs: 1,
    });
    mocks.memoryRetrieve.mockResolvedValue({
      memories: [],
      scores: [],
      tokenEstimate: 0,
      totalCount: 0,
    });
    mocks.getRecentMessages.mockResolvedValue([]);
    mocks.loadPersona.mockResolvedValue(null);
    mocks.getDecryptedApiKey.mockResolvedValue({ provider: 'OPENAI', defaultModel: 'gpt-4o' });
  });

  it('completes a run with no tool call', async () => {
    mocks.generateChatCompletion.mockResolvedValue({
      content: 'Hello, I am Ada.',
      model: 'gpt-4o',
      tokensUsed: 12,
    });

    const result = await agentOrchestrator.run({ alternateId: ALT, userId: OWNER, goal: 'hi' });

    expect(result.status).toBe(AgentRunStatus.COMPLETED);
    expect(result.content).toBe('Hello, I am Ada.');
    expect(result.toolCallCount).toBe(0);
    expect(mocks.completeRun).toHaveBeenCalledTimes(1);
    expect(mocks.failRun).not.toHaveBeenCalled();
  });

  it('executes a read-only tool and feeds the result back for a final answer', async () => {
    mocks.generateChatCompletion
      .mockResolvedValueOnce({
        content: '',
        model: 'gpt-4o',
        toolCalls: [toolCall('tc1', 'alternate_context', { includePersona: true })],
      })
      .mockResolvedValueOnce({ content: 'You are Ada, an engineer.', model: 'gpt-4o' });

    const result = await agentOrchestrator.run({
      alternateId: ALT,
      userId: OWNER,
      goal: 'who are you',
    });

    expect(result.status).toBe(AgentRunStatus.COMPLETED);
    expect(result.toolCallCount).toBe(1);
    expect(mocks.createToolExecution).toHaveBeenCalledTimes(1);
    // Two LLM turns: one to request the tool, one to answer with the result.
    expect(mocks.generateChatCompletion).toHaveBeenCalledTimes(2);
    const second = mocks.generateChatCompletion.mock.calls[1][0];
    expect(second.toolResults).toHaveLength(1);
    expect(second.toolResults[0].name).toBe('alternate_context');
  });

  it('stops the run when a tool requires approval and executes nothing', async () => {
    mocks.generateChatCompletion.mockResolvedValue({
      content: '',
      model: 'gpt-4o',
      toolCalls: [toolCall('tc1', 'sample_owner_action', { note: 'book the trip' })],
    });

    const result = await agentOrchestrator.run({
      alternateId: ALT,
      userId: OWNER,
      goal: 'book it',
    });

    expect(result.status).toBe(AgentRunStatus.WAITING_FOR_APPROVAL);
    expect(result.pendingApproval?.approvalId).toBe('approval-1');
    expect(result.pendingApproval?.toolName).toBe('sample_owner_action');
    expect(mocks.setRunWaitingForApproval).toHaveBeenCalledWith(RUN);
    // Nothing may reach SUCCEEDED before the human decision.
    const statuses = mocks.updateToolExecution.mock.calls.map((c) => c[1]?.status);
    expect(statuses).not.toContain('SUCCEEDED');
  });

  it('stops the run at the step limit instead of looping forever', async () => {
    // A model that never stops requesting tools must still be bounded.
    mocks.generateChatCompletion.mockResolvedValue({
      content: '',
      model: 'gpt-4o',
      toolCalls: [toolCall('tc', 'alternate_context', { includePersona: true })],
    });

    await expect(
      agentOrchestrator.run({ alternateId: ALT, userId: OWNER, goal: 'loop forever' }),
    ).rejects.toMatchObject({ code: 'AGENT_MAX_STEPS' });

    expect(mocks.failRun).toHaveBeenCalledTimes(1);
    expect(mocks.generateChatCompletion.mock.calls.length).toBeLessThanOrEqual(10);
  });

  it('fails the run when the provider is unavailable', async () => {
    mocks.getDecryptedApiKey.mockResolvedValue(null);
    await expect(
      agentOrchestrator.run({ alternateId: ALT, userId: OWNER, goal: 'hi' }),
    ).rejects.toMatchObject({ code: 'AGENT_PROVIDER_UNAVAILABLE' });
    expect(mocks.failRun).toHaveBeenCalledTimes(1);
  });

  it('fails the run when agent mode is disabled for the alternate', async () => {
    setAlternate({ agentEnabled: false });
    await expect(
      agentOrchestrator.run({ alternateId: ALT, userId: OWNER, goal: 'hi' }),
    ).rejects.toMatchObject({ code: 'AGENT_DISABLED' });
    // No run row may be created for a denied start.
    expect(mocks.createRun).not.toHaveBeenCalled();
  });

  it('denies a visitor the approval-gated tool and still returns a final answer', async () => {
    setAlternate({ userId: 'someone-else', title: null, bio: null });
    mocks.generateChatCompletion
      .mockResolvedValueOnce({
        content: '',
        model: 'gpt-4o',
        toolCalls: [toolCall('tc1', 'sample_owner_action', { note: 'do it' })],
      })
      .mockResolvedValueOnce({ content: 'I cannot do that.', model: 'gpt-4o' });

    const result = await agentOrchestrator.run({ alternateId: ALT, userId: OWNER, goal: 'do it' });

    expect(result.status).toBe(AgentRunStatus.COMPLETED);
    // The gated tool never executed and no approval was created.
    expect(mocks.createToolExecution).not.toHaveBeenCalled();
    expect(mocks.createApproval).not.toHaveBeenCalled();
  });

  it('records the run start and completion in the audit log', async () => {
    mocks.generateChatCompletion.mockResolvedValue({ content: 'ok', model: 'gpt-4o' });
    await agentOrchestrator.run({ alternateId: ALT, userId: OWNER, goal: 'hi' });

    const actions = mocks.createAuditLog.mock.calls.map((c) => c[0].action);
    expect(actions).toContain('AGENT_RUN_STARTED');
    expect(actions).toContain('AGENT_RUN_COMPLETED');
  });

  it('never persists raw model output, only the sanitized form', async () => {
    mocks.generateChatCompletion
      .mockResolvedValueOnce({
        content: '',
        model: 'gpt-4o',
        toolCalls: [
          toolCall('tc1', 'sample_owner_action', { note: 'api_key = "abcdefghijklmnopqrstuvwx"' }),
        ],
      })
      .mockResolvedValueOnce({ content: 'done', model: 'gpt-4o' });

    await agentOrchestrator.run({ alternateId: ALT, userId: OWNER, goal: 'act' });

    const created = mocks.createToolExecution.mock.calls[0][0];
    expect(created.input).toBeUndefined();
    expect(JSON.stringify(created.sanitizedInput)).not.toContain('abcdefghijklmnopqrstuvwx');
  });
});

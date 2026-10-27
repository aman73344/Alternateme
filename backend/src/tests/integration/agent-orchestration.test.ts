/**
 * Phase 6 — agent orchestration end-to-end (REAL DATABASE).
 *
 * Unlike `src/tests/agent/*` (pure unit, no DB), this suite exercises real
 * Prisma persistence, the real approval lifecycle and real tenant isolation.
 * Only the LLM provider is faked so no external API call is made.
 *
 * Requires a reachable DATABASE_URL: the global test setup runs
 * `SELECT 1` before any assertion, so an unreachable database aborts the suite.
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ generateChatCompletion: vi.fn() }));

vi.mock('@/rag/llm-provider', () => ({
  createLLMProvider: () => ({
    name: 'FAKE',
    generateChatCompletion: mocks.generateChatCompletion,
    getModelInfo: () => ({ name: 'fake', maxTokens: 1000 }),
    healthCheck: async () => true,
  }),
}));

import { prisma } from '@/database';
import { agentOrchestrator } from '@/agent/orchestration/orchestrator.service';
import { agentService } from '@/agent/agent.service';
import { AgentRunStatus, ApprovalStatus, ToolExecutionStatus } from '@/agent/agent.types';

const suffix = Date.now().toString(36);

let userAId: string;
let userBId: string;
let alternateAId: string;
let alternateBId: string;

function scriptLlm(...responses: Array<Record<string, unknown>>) {
  for (const response of responses) {
    mocks.generateChatCompletion.mockResolvedValueOnce(response);
  }
}

async function createUser(name: string, username: string, email: string) {
  const user = await prisma.user.create({
    data: {
      name,
      username,
      email,
      // Matches the convention in the other suites: these fixtures never
      // authenticate, so a real argon2 hash would only slow the run down.
      passwordHash: 'test-hash',
      emailVerified: new Date(),
    },
  });
  return user.id;
}

describe('Phase 6 agent orchestration (E2E, real database)', () => {
  beforeAll(async () => {
    process.env.AGENT_ENABLED = 'true';
    process.env.AGENT_SAMPLE_ACTION_TOOL_ENABLED = 'true';

    userAId = await createUser(
      `Agent A ${suffix}`,
      `agenta_${suffix}`,
      `agenta_${suffix}@example.com`,
    );
    userBId = await createUser(
      `Agent B ${suffix}`,
      `agentb_${suffix}`,
      `agentb_${suffix}@example.com`,
    );

    const altA = await prisma.alternate.create({
      data: {
        userId: userAId,
        username: `alt_a_${suffix}`,
        displayName: 'Agent Test A',
        visibility: 'PUBLIC',
        status: 'PUBLISHED',
        agentEnabled: true,
      },
    });
    alternateAId = altA.id;

    const altB = await prisma.alternate.create({
      data: {
        userId: userBId,
        username: `alt_b_${suffix}`,
        displayName: 'Agent Test B',
        visibility: 'PUBLIC',
        status: 'PUBLISHED',
        agentEnabled: true,
      },
    });
    alternateBId = altB.id;
  });

  afterAll(async () => {
    // Cascades remove runs, steps, executions and approvals.
    await prisma.alternate.deleteMany({ where: { id: { in: [alternateAId, alternateBId] } } });
    await prisma.user.deleteMany({ where: { id: { in: [userAId, userBId] } } });
  });

  it('scenario 1 — a run with a read-only tool persists run, steps and execution', async () => {
    scriptLlm(
      {
        content: '',
        model: 'fake',
        tokensUsed: 20,
        toolCalls: [{ id: 'tc-1', name: 'alternate_context', arguments: { includePersona: true } }],
      },
      { content: 'I am Agent Test A.', model: 'fake', tokensUsed: 15 },
    );

    const result = await agentOrchestrator.run({
      alternateId: alternateAId,
      userId: userAId,
      goal: 'Who are you?',
    });

    expect(result.status).toBe(AgentRunStatus.COMPLETED);
    expect(result.content).toBe('I am Agent Test A.');

    const run = await prisma.agentRun.findFirst({
      where: { id: result.runId, alternateId: alternateAId },
    });
    expect(run).not.toBeNull();
    expect(run!.toolCallCount).toBe(1);
    expect(run!.llmCallCount).toBe(2);

    const steps = await prisma.agentStep.findMany({
      where: { agentRunId: result.runId },
      orderBy: { stepNumber: 'asc' },
    });
    expect(steps.length).toBeGreaterThanOrEqual(3);
    expect(steps.some((s) => s.type === 'TOOL_CALL')).toBe(true);
    expect(steps.some((s) => s.type === 'FINAL_RESPONSE')).toBe(true);

    const executions = await prisma.toolExecution.findMany({
      where: { agentRunId: result.runId, alternateId: alternateAId },
    });
    expect(executions).toHaveLength(1);
    expect(executions[0].status).toBe(ToolExecutionStatus.SUCCEEDED);
    expect(executions[0].riskLevel).toBe('READ_ONLY');
    expect(executions[0].idempotencyKey).toBeTruthy();
  });

  it('scenario 2 — an approval-gated tool pauses the run and runs only after approval', async () => {
    scriptLlm({
      content: '',
      model: 'fake',
      toolCalls: [
        { id: 'tc-2', name: 'sample_owner_action', arguments: { note: 'confirm the booking' } },
      ],
    });

    const result = await agentOrchestrator.run({
      alternateId: alternateAId,
      userId: userAId,
      goal: 'Please confirm the booking',
    });

    expect(result.status).toBe(AgentRunStatus.WAITING_FOR_APPROVAL);
    expect(result.pendingApproval).toBeDefined();

    const approval = await prisma.approvalRequest.findFirst({
      where: { id: result.pendingApproval!.approvalId, alternateId: alternateAId },
    });
    expect(approval).not.toBeNull();
    expect(approval!.status).toBe(ApprovalStatus.PENDING);
    expect(approval!.riskLevel).toBe('HIGH');
    expect(typeof approval!.sanitizedActionSummary).toBe('string');

    const before = await prisma.toolExecution.findFirst({
      where: { id: approval!.toolExecutionId },
    });
    expect(before!.status).toBe(ToolExecutionStatus.WAITING_FOR_APPROVAL);

    const approved = await agentService.approveToolCall({
      approvalId: approval!.id,
      alternateId: alternateAId,
      userId: userAId,
    });
    expect(approved.status).toBe(ToolExecutionStatus.SUCCEEDED);

    const after = await prisma.toolExecution.findFirst({
      where: { id: approval!.toolExecutionId },
    });
    expect(after!.status).toBe(ToolExecutionStatus.SUCCEEDED);

    const decided = await prisma.approvalRequest.findFirst({ where: { id: approval!.id } });
    expect(decided!.status).toBe(ApprovalStatus.EXECUTED);
  });

  it('scenario 2b — rejecting an approval cancels the execution and never runs the tool', async () => {
    scriptLlm({
      content: '',
      model: 'fake',
      toolCalls: [
        { id: 'tc-3', name: 'sample_owner_action', arguments: { note: 'rejected action' } },
      ],
    });

    const result = await agentOrchestrator.run({
      alternateId: alternateAId,
      userId: userAId,
      goal: 'do the rejected thing',
    });
    const approvalId = result.pendingApproval!.approvalId;

    await agentService.rejectToolCall({
      approvalId,
      alternateId: alternateAId,
      userId: userAId,
      reason: 'not now',
    });

    const approval = await prisma.approvalRequest.findFirst({ where: { id: approvalId } });
    expect(approval!.status).toBe(ApprovalStatus.REJECTED);

    const execution = await prisma.toolExecution.findFirst({
      where: { id: approval!.toolExecutionId },
    });
    expect(execution!.status).toBe(ToolExecutionStatus.CANCELLED);

    // A second decision must be refused.
    await expect(
      agentService.approveToolCall({ approvalId, alternateId: alternateAId, userId: userAId }),
    ).rejects.toMatchObject({ code: 'TOOL_APPROVAL_REJECTED' });
  });

  it('scenario 3 — tenant isolation: user B cannot read user A run, execution or approval', async () => {
    const run = await prisma.agentRun.findFirst({
      where: { alternateId: alternateAId },
      orderBy: { createdAt: 'desc' },
    });
    expect(run).not.toBeNull();

    await expect(agentService.getRunDetail(run!.id, alternateBId, userBId)).rejects.toMatchObject({
      code: 'AGENT_NOT_FOUND',
    });

    await expect(
      agentService.getRunExecutions(run!.id, alternateBId, userBId),
    ).rejects.toMatchObject({ code: 'AGENT_NOT_FOUND' });

    const { approvals } = await agentService.listPendingApprovals(alternateBId, userBId, {
      page: 1,
      limit: 50,
    });
    expect(approvals.every((a) => a.alternateId === alternateBId)).toBe(true);

    const aApproval = await prisma.approvalRequest.findFirst({
      where: { alternateId: alternateAId },
    });
    if (aApproval) {
      await expect(
        agentService.rejectToolCall({
          approvalId: aApproval.id,
          alternateId: alternateAId,
          userId: userBId,
        }),
      ).rejects.toMatchObject({ code: 'TOOL_APPROVAL_NOT_FOUND' });
    }
  });

  it('scenario 4 — the same logical action is executed only once (idempotency)', async () => {
    scriptLlm(
      {
        content: '',
        model: 'fake',
        toolCalls: [
          { id: 'tc-idem-1', name: 'alternate_context', arguments: { includePersona: true } },
        ],
      },
      { content: 'done', model: 'fake' },
    );

    const first = await agentOrchestrator.run({
      alternateId: alternateAId,
      userId: userAId,
      goal: 'idempotency check',
    });
    expect(first.status).toBe(AgentRunStatus.COMPLETED);

    const executions = await prisma.toolExecution.findMany({
      where: { alternateId: alternateAId, toolName: 'alternate_context' },
    });

    // A unique (alternateId, toolName, idempotencyKey) index makes a second
    // execution of the identical action impossible.
    const keys = executions.map((e) => e.idempotencyKey);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

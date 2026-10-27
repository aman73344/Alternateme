/**
 * Phase 6 — authorization and tenant-isolation unit tests.
 *
 * `@/database` is mocked so the REAL authorization service runs without a
 * database. This exercises the decision logic itself, not a re-implementation.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// vi.mock factories are hoisted above module-level consts, so the mock
// functions must be created with vi.hoisted() to be initialised in time.
const { findFirst, listToolConfigurations, createAuditLog } = vi.hoisted(() => ({
  findFirst: vi.fn(),
  listToolConfigurations: vi.fn(),
  createAuditLog: vi.fn(),
}));

vi.mock('@/database', () => ({
  prisma: { alternate: { findFirst } },
}));

vi.mock('@/agent/agent.repository', () => ({ listToolConfigurations }));

vi.mock('@/auth/repositories/audit.repository', () => ({ createAuditLog }));

import {
  authorizeToolCall,
  assertCanStartRun,
  deriveExecutionContext,
} from '@/agent/tools/authorization.service';
import { registerBuiltInTools } from '@/agent/tools';
import { AgentExecutionContext, ToolRiskLevel } from '@/agent/agent.types';

const LIMITS = {
  maxSteps: 8,
  maxToolCalls: 10,
  maxRuntimeMs: 60_000,
  maxToolRuntimeMs: 15_000,
  maxContextTokens: 8000,
  maxToolResultChars: 4000,
  maxLlmCalls: 12,
  maxToolCallsPerTool: 4,
};

const OWNER_ID = '11111111-1111-4111-8111-111111111111';
const VISITOR_ID = '22222222-2222-4222-8222-222222222222';
const ALT_ID = '33333333-3333-4333-8333-333333333333';

function baseInput(overrides: Record<string, unknown> = {}) {
  return {
    alternateId: ALT_ID,
    userId: OWNER_ID,
    toolName: 'knowledge_search',
    requestedContext: AgentExecutionContext.OWNER,
    toolCallCountForTool: 0,
    toolCallCountTotal: 0,
    limits: LIMITS,
    ...overrides,
  } as Parameters<typeof authorizeToolCall>[0];
}

function setAlternate(overrides: Record<string, unknown> = {}) {
  findFirst.mockResolvedValue({
    id: ALT_ID,
    userId: OWNER_ID,
    visibility: 'PUBLIC',
    status: 'PUBLISHED',
    ...overrides,
  });
}

function setConfig(rows: Array<Record<string, unknown>>) {
  listToolConfigurations.mockResolvedValue(rows);
}

describe('authorizeToolCall', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    registerBuiltInTools();
    setConfig([]);
    setAlternate();
  });

  it('allows the owner to use a read-only tool', async () => {
    const result = await authorizeToolCall(baseInput());
    expect(result.tool.name).toBe('knowledge_search');
    expect(result.isOwner).toBe(true);
    expect(result.executionContext).toBe(AgentExecutionContext.OWNER);
    expect(result.requiresApproval).toBe(false);
  });

  it('denies an unknown tool with TOOL_NOT_FOUND', async () => {
    await expect(authorizeToolCall(baseInput({ toolName: 'rm_rf' }))).rejects.toMatchObject({
      code: 'TOOL_NOT_FOUND',
    });
  });

  it('denies a non-owner on a PRIVATE alternate', async () => {
    setAlternate({ visibility: 'PRIVATE' });
    await expect(
      authorizeToolCall(
        baseInput({ userId: VISITOR_ID, requestedContext: AgentExecutionContext.PUBLIC_VISITOR }),
      ),
    ).rejects.toMatchObject({ code: 'AGENT_UNAUTHORIZED' });
  });

  it('downgrades a visitor who falsely claims OWNER to PUBLIC_VISITOR', async () => {
    const result = await authorizeToolCall(
      baseInput({ userId: VISITOR_ID, requestedContext: AgentExecutionContext.OWNER }),
    );
    expect(result.isOwner).toBe(false);
    expect(result.executionContext).toBe(AgentExecutionContext.PUBLIC_VISITOR);
  });

  it('downgrades a visitor claiming SYSTEM/WORKER context', async () => {
    const result = await authorizeToolCall(
      baseInput({ userId: VISITOR_ID, requestedContext: AgentExecutionContext.SYSTEM }),
    );
    expect(result.executionContext).toBe(AgentExecutionContext.PUBLIC_VISITOR);
  });

  it('denies a visitor the owner-only memory tool', async () => {
    await expect(
      authorizeToolCall(
        baseInput({
          userId: VISITOR_ID,
          toolName: 'memory_search',
          requestedContext: AgentExecutionContext.PUBLIC_VISITOR,
        }),
      ),
    ).rejects.toMatchObject({ code: 'TOOL_NOT_ALLOWED' });
  });

  it('denies a visitor the approval-gated sample action tool', async () => {
    await expect(
      authorizeToolCall(
        baseInput({
          userId: VISITOR_ID,
          toolName: 'sample_owner_action',
          requestedContext: AgentExecutionContext.PUBLIC_VISITOR,
        }),
      ),
    ).rejects.toMatchObject({ code: 'TOOL_NOT_ALLOWED' });
  });

  it('allows the owner the approval-gated tool but flags approval as required', async () => {
    const result = await authorizeToolCall(baseInput({ toolName: 'sample_owner_action' }));
    expect(result.requiresApproval).toBe(true);
    expect(result.tool.riskLevel).toBe(ToolRiskLevel.HIGH);
  });

  it('denies a tool disabled for this alternate', async () => {
    setConfig([
      {
        toolName: 'knowledge_search',
        isEnabled: false,
        allowedContexts: null,
        maxCallsPerRun: null,
        requireApproval: null,
        config: null,
      },
    ]);
    await expect(authorizeToolCall(baseInput())).rejects.toMatchObject({ code: 'TOOL_DISABLED' });
  });

  it('denies once the per-run tool budget is exhausted', async () => {
    await expect(
      authorizeToolCall(baseInput({ toolCallCountForTool: LIMITS.maxToolCallsPerTool })),
    ).rejects.toMatchObject({ code: 'TOOL_NOT_ALLOWED' });
  });

  it('applies a per-alternate approval override', async () => {
    setConfig([
      {
        toolName: 'knowledge_search',
        isEnabled: true,
        allowedContexts: null,
        maxCallsPerRun: null,
        requireApproval: true,
        config: null,
      },
    ]);
    expect((await authorizeToolCall(baseInput())).requiresApproval).toBe(true);
  });

  it('revokes visitor access when the alternate config excludes PUBLIC_VISITOR', async () => {
    setConfig([
      {
        toolName: 'knowledge_search',
        isEnabled: true,
        allowedContexts: [AgentExecutionContext.OWNER],
        maxCallsPerRun: null,
        requireApproval: null,
        config: null,
      },
    ]);
    await expect(
      authorizeToolCall(
        baseInput({ userId: VISITOR_ID, requestedContext: AgentExecutionContext.PUBLIC_VISITOR }),
      ),
    ).rejects.toMatchObject({ code: 'TOOL_NOT_ALLOWED' });
  });

  it('denies when the alternate does not exist', async () => {
    findFirst.mockResolvedValue(null);
    await expect(authorizeToolCall(baseInput())).rejects.toMatchObject({ code: 'AGENT_NOT_FOUND' });
  });
});

describe('deriveExecutionContext', () => {
  it('returns OWNER only for a real owner', () => {
    expect(
      deriveExecutionContext({
        isOwner: true,
        requested: AgentExecutionContext.PUBLIC_VISITOR,
        visibility: 'PUBLIC',
      }),
    ).toBe(AgentExecutionContext.OWNER);
  });

  it('never returns SYSTEM or WORKER for a non-owner', () => {
    for (const requested of [AgentExecutionContext.SYSTEM, AgentExecutionContext.WORKER]) {
      expect(deriveExecutionContext({ isOwner: false, requested, visibility: 'PUBLIC' })).toBe(
        AgentExecutionContext.PUBLIC_VISITOR,
      );
    }
  });
});

describe('assertCanStartRun', () => {
  beforeEach(() => vi.clearAllMocks());

  it('denies a run when agent mode is off for the alternate', async () => {
    setAlternate({ agentEnabled: false });
    await expect(assertCanStartRun(ALT_ID, OWNER_ID)).rejects.toMatchObject({
      code: 'AGENT_DISABLED',
    });
  });

  it('allows the owner when agent mode is on', async () => {
    setAlternate({ agentEnabled: true });
    await expect(assertCanStartRun(ALT_ID, OWNER_ID)).resolves.toEqual({
      isOwner: true,
      agentEnabled: true,
    });
  });

  it('denies a visitor on a private alternate', async () => {
    setAlternate({ agentEnabled: true, visibility: 'PRIVATE' });
    await expect(assertCanStartRun(ALT_ID, VISITOR_ID)).rejects.toMatchObject({
      code: 'AGENT_UNAUTHORIZED',
    });
  });
});

describe('tenant scoping', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    registerBuiltInTools();
    setConfig([]);
    setAlternate();
  });

  it('scopes the alternate lookup by id and soft-delete guard', async () => {
    await authorizeToolCall(baseInput());
    expect(findFirst).toHaveBeenCalledTimes(1);
    expect(findFirst.mock.calls[0][0].where).toEqual({ id: ALT_ID, deletedAt: null });
  });

  it('scopes tool configuration lookups by alternateId', async () => {
    await authorizeToolCall(baseInput());
    expect(listToolConfigurations).toHaveBeenCalledWith(ALT_ID);
  });
});

/**
 * Phase 6 — tool input validation unit tests.
 * Verifies the server-side contract is actually enforced, including the
 * "unexpected field" and "oversized input" rules.
 */

import { describe, it, expect } from 'vitest';
import {
  KnowledgeSearchInputSchema,
  MemorySearchInputSchema,
  ConversationContextInputSchema,
  AlternateContextInputSchema,
  SampleOwnerActionInputSchema,
} from '@/agent/tools/tool.schemas';
import { registerBuiltInTools, toolRegistry } from '@/agent/tools';

describe('tool input validation', () => {
  it('accepts valid knowledge_search arguments and applies defaults', () => {
    const parsed = KnowledgeSearchInputSchema.parse({ query: 'my work history' });
    expect(parsed.limit).toBe(5);
    expect(parsed.query).toBe('my work history');
  });

  it('rejects a missing required field', () => {
    const result = KnowledgeSearchInputSchema.safeParse({ limit: 3 });
    expect(result.success).toBe(false);
  });

  it('rejects wrong types', () => {
    expect(MemorySearchInputSchema.safeParse({ query: 42 }).success).toBe(false);
    expect(MemorySearchInputSchema.safeParse({ query: 'ok', limit: 'many' }).success).toBe(false);
  });

  it('REJECTS unexpected fields rather than stripping them', () => {
    const result = KnowledgeSearchInputSchema.safeParse({
      query: 'valid query',
      unexpectedField: 'injected',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(JSON.stringify(result.error.issues)).toMatch(/unexpected/i);
    }
  });

  it('rejects an oversized query', () => {
    const result = MemorySearchInputSchema.safeParse({ query: 'x'.repeat(501) });
    expect(result.success).toBe(false);
  });

  it('rejects an out-of-range limit', () => {
    expect(KnowledgeSearchInputSchema.safeParse({ query: 'ok query', limit: 999 }).success).toBe(
      false,
    );
    expect(ConversationContextInputSchema.safeParse({ limit: 0 }).success).toBe(false);
  });

  it('rejects an invalid UUID sourceId', () => {
    const result = KnowledgeSearchInputSchema.safeParse({
      query: 'valid query',
      sourceId: 'not-a-uuid',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a non-enum value for includeRole', () => {
    expect(ConversationContextInputSchema.safeParse({ includeRole: 'EVERYONE' }).success).toBe(
      false,
    );
  });

  it('rejects an empty note for the approval-gated tool', () => {
    expect(SampleOwnerActionInputSchema.safeParse({ note: '   ' }).success).toBe(false);
  });

  it('accepts valid alternate context arguments', () => {
    expect(AlternateContextInputSchema.parse({}).includePersona).toBe(true);
  });

  it('advertises strict JSON Schema to the model for every built-in tool', () => {
    registerBuiltInTools();
    const definitions = toolRegistry.listDefinitionsForModel();
    expect(definitions.length).toBeGreaterThanOrEqual(4);
    for (const def of definitions) {
      expect(def.parameters).toMatchObject({ type: 'object', additionalProperties: false });
    }
  });

  it('registers only read-only tools plus the opt-in sample action tool', () => {
    registerBuiltInTools();
    const names = toolRegistry.listMetadata().map((m) => m.name);
    expect(names).toContain('knowledge_search');
    expect(names).toContain('memory_search');
    expect(names).toContain('conversation_context');
    expect(names).toContain('alternate_context');
    // Enabled via AGENT_SAMPLE_ACTION_TOOL_ENABLED in the test env.
    expect(names).toContain('sample_owner_action');
  });
});

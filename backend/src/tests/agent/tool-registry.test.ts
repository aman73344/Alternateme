/**
 * Phase 6 — ToolRegistry unit tests.
 * No database required.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { z } from 'zod';
import { ToolRegistry, toJsonSchema } from '@/agent/tools/tool.registry';
import { AgentError } from '@/agent/agent.errors';
import { ToolRiskLevel, type AgentTool } from '@/agent/agent.types';

function makeTool<TInput = { q: string }, TOutput = { ok: boolean }>(
  overrides: Partial<AgentTool<TInput, TOutput>> = {},
): AgentTool<TInput, TOutput> {
  return {
    name: 'demo_tool',
    description: 'A demo tool for registry tests',
    inputSchema: z.object({ q: z.string() }) as unknown as z.ZodType<TInput>,
    riskLevel: ToolRiskLevel.READ_ONLY,
    sideEffecting: false,
    allowPublicVisitor: true,
    async execute() {
      return { ok: true } as TOutput;
    },
    ...overrides,
  };
}

describe('ToolRegistry', () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    registry = new ToolRegistry();
  });

  it('registers a tool and finds it by name', () => {
    registry.register(makeTool());
    expect(registry.has('demo_tool')).toBe(true);
    expect(registry.get('demo_tool').riskLevel).toBe(ToolRiskLevel.READ_ONLY);
  });

  it('lists tools and their metadata', () => {
    registry.register(makeTool());
    registry.register(makeTool({ name: 'second_tool' }));
    const metadata = registry.listMetadata();
    expect(metadata).toHaveLength(2);
    expect(metadata.map((m) => m.name).sort()).toEqual(['demo_tool', 'second_tool']);
  });

  it('rejects a duplicate tool name', () => {
    registry.register(makeTool());
    expect(() => registry.register(makeTool())).toThrow(/Duplicate tool name/);
  });

  it('rejects an unknown tool with TOOL_NOT_FOUND', () => {
    expect(() => registry.get('nope')).toThrow(AgentError);
    try {
      registry.get('nope');
    } catch (err) {
      expect((err as AgentError).code).toBe('TOOL_NOT_FOUND');
    }
  });

  it('rejects invalid tool names', () => {
    expect(() => registry.register(makeTool({ name: 'BadName' }))).toThrow(/Invalid tool name/);
    expect(() => registry.register(makeTool({ name: 'has-dash' }))).toThrow(/Invalid tool name/);
  });

  it('unregisters a tool', () => {
    registry.register(makeTool());
    expect(registry.unregister('demo_tool')).toBe(true);
    expect(registry.has('demo_tool')).toBe(false);
    expect(registry.unregister('demo_tool')).toBe(false);
  });

  it('exposes JSON Schema for the model without internal fields', () => {
    registry.register(
      makeTool<{ query: string; limit: number }, { ok: boolean }>({
        inputSchema: z.object({
          query: z.string().min(1),
          limit: z.number().int().max(5).default(3),
        }),
      }),
    );
    const [definition] = registry.listDefinitionsForModel();
    expect(definition.name).toBe('demo_tool');
    expect(definition.parameters).toMatchObject({ type: 'object' });
    // Risk level, timeouts and handlers must never be advertised to the model.
    expect(definition).not.toHaveProperty('riskLevel');
    expect(definition).not.toHaveProperty('timeoutMs');
    expect(definition).not.toHaveProperty('execute');
  });

  it('generates strict schemas (unexpected properties rejected)', () => {
    const schema = toJsonSchema(z.object({ a: z.string() }));
    expect(schema.additionalProperties).toBe(false);
  });
});

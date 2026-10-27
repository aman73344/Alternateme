/**
 * ToolRegistry
 *
 * Registration and lookup only. The registry deliberately holds NO
 * authorization logic: whether a tool may run is decided by
 * `authorization.service.ts` and `tool-policy.service.ts`. Keeping the two
 * separate is what stops "the model asked for it" from becoming permission.
 */

import { z } from 'zod';
import { logger } from '@/utils/logger';
import { AgentError } from '../agent.errors';
import {
  ToolRiskLevel,
  type AgentTool,
  type ToolMetadata,
  type ToolExecutionContext,
} from '../agent.types';

export interface ToolDefinitionForModel {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

/**
 * Type-erased view held by the registry. Input typing is recovered per call by
 * parsing with the tool's own schema before `execute` is reached, so erasure
 * here cannot weaken validation.
 */
export interface RegisteredTool {
  name: string;
  description: string;
  inputSchema: z.ZodType;
  riskLevel: ToolRiskLevel;
  sideEffecting: boolean;
  allowPublicVisitor: boolean;
  timeoutMs?: number;
  execute(context: ToolExecutionContext, input: unknown): Promise<unknown>;
}

const TOOL_NAME_PATTERN = /^[a-z][a-z0-9_]{1,63}$/;

export class ToolRegistry {
  private readonly tools = new Map<string, RegisteredTool>();

  /** Register a concrete tool, erasing its generics behind the safe boundary. */
  register<TInput, TOutput>(tool: AgentTool<TInput, TOutput>): void {
    if (!TOOL_NAME_PATTERN.test(tool.name)) {
      throw new Error(
        `Invalid tool name "${tool.name}": must match ${TOOL_NAME_PATTERN} (lower_snake_case)`,
      );
    }
    if (this.tools.has(tool.name)) {
      throw new Error(`Duplicate tool name "${tool.name}"`);
    }
    if (!tool.description || tool.description.length > 500) {
      throw new Error(`Tool "${tool.name}" needs a description of 1-500 characters`);
    }

    const adapter: RegisteredTool = {
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema as unknown as z.ZodType,
      riskLevel: tool.riskLevel,
      sideEffecting: tool.sideEffecting,
      allowPublicVisitor: tool.allowPublicVisitor,
      ...(tool.timeoutMs !== undefined ? { timeoutMs: tool.timeoutMs } : {}),
      execute: (context, input) => tool.execute(context, input as TInput),
    };

    this.tools.set(tool.name, adapter);
    logger.info({ tool: tool.name, riskLevel: tool.riskLevel }, 'agent.tool.registered');
  }

  /** Remove a tool. Returns true when one was actually removed. */
  unregister(name: string): boolean {
    const removed = this.tools.delete(name);
    if (removed) logger.info({ tool: name }, 'agent.tool.unregistered');
    return removed;
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  /** Look up a tool or fail with TOOL_NOT_FOUND. */
  get(name: string): RegisteredTool {
    const tool = this.tools.get(name);
    if (!tool) {
      throw AgentError.from('TOOL_NOT_FOUND', { tool: name });
    }
    return tool;
  }

  list(): RegisteredTool[] {
    return Array.from(this.tools.values());
  }

  listMetadata(): ToolMetadata[] {
    return this.list().map((t) => ({
      name: t.name,
      description: t.description,
      riskLevel: t.riskLevel,
    }));
  }

  /**
   * Provider-neutral tool contracts for the LLM. The JSON Schema is derived
   * from the tool's own Zod schema, so the model can never be told a contract
   * the server does not enforce. Internal fields (risk, timeouts, handlers)
   * are not exposed.
   */
  listDefinitionsForModel(): ToolDefinitionForModel[] {
    return this.list().map((t) => ({
      name: t.name,
      description: t.description,
      parameters: toJsonSchema(t.inputSchema),
    }));
  }

  clear(): void {
    this.tools.clear();
  }
}

/** Convert a Zod schema to a plain JSON Schema object for provider payloads. */
export function toJsonSchema(schema: z.ZodType): Record<string, unknown> {
  const generated = z.toJSONSchema(schema, { io: 'input' }) as Record<string, unknown>;
  // Providers only need the shape of the object.
  delete generated.$schema;
  // Zod's input-mode JSON Schema omits this, but our tool schemas are `.strict()`
  // and reject unknown keys server-side. Advertising it keeps the model honest.
  if (generated.type === 'object') {
    generated.additionalProperties = false;
  }
  return generated;
}

export const toolRegistry = new ToolRegistry();

/**
 * MemorySearchTool
 *
 * Wraps the Phase 5 `memoryRetrievalService`. It never searches memories
 * itself: no separate embedding, ranking or persistence path is added.
 *
 * Owner-only by construction. Phase 5 memories are the owner's personal
 * context (`MemoryVisibility.PRIVATE`), so this tool refuses PUBLIC_VISITOR
 * runs even if the registry were misconfigured.
 */

import { memoryRetrievalService } from '@/memory/memory.retrieval';
import { config } from '@/config';
import { prisma } from '@/database';
import { AGENT_TOOL_NAMES } from '../agent.constants';
import { AgentError } from '../agent.errors';
import {
  AgentExecutionContext,
  ToolRiskLevel,
  type AgentTool,
  type ToolExecutionContext,
} from '../agent.types';
import { MemorySearchInputSchema } from './tool.schemas';

export interface MemorySearchOutput {
  enabled: boolean;
  results: Array<{ type: string; content: string; importance: number }>;
  matchedCount: number;
}

export const memorySearchTool: AgentTool<{ query: string; limit: number }, MemorySearchOutput> = {
  name: AGENT_TOOL_NAMES.MEMORY_SEARCH,
  description:
    "Search the owner's stored personal memories (durable facts and preferences) " +
    'for information relevant to the question. Owner-only; read-only.',
  inputSchema: MemorySearchInputSchema,
  riskLevel: ToolRiskLevel.READ_ONLY,
  sideEffecting: false,
  // Personal context must never leak to a visitor.
  allowPublicVisitor: false,

  async execute(context: ToolExecutionContext, input) {
    if (context.executionContext === AgentExecutionContext.PUBLIC_VISITOR) {
      throw AgentError.from('TOOL_NOT_ALLOWED', { tool: this.name, reason: 'OWNER_ONLY_TOOL' });
    }
    if (!context.userId) {
      throw AgentError.from('TOOL_NOT_ALLOWED', { tool: this.name, reason: 'MISSING_USER_ID' });
    }
    if (config.memory?.enabled === false) {
      return { enabled: false, results: [], matchedCount: 0 };
    }

    // Respect the owner's own memory toggle for this Alternate.
    const alternate = await prisma.alternate.findFirst({
      where: { id: context.alternateId, userId: context.userId, deletedAt: null },
      select: { memoryEnabled: true },
    });
    if (!alternate?.memoryEnabled) {
      return { enabled: false, results: [], matchedCount: 0 };
    }

    const result = await memoryRetrievalService.retrieve({
      alternateId: context.alternateId,
      userId: context.userId,
      query: input.query,
      limit: input.limit,
      // Owner context: private memories are in scope.
      includePrivate: true,
    });

    return {
      enabled: true,
      matchedCount: result.totalCount,
      results: result.memories.slice(0, input.limit).map((m) => ({
        type: m.type,
        content: m.content.slice(0, 500),
        importance: m.importance,
      })),
    };
  },
};

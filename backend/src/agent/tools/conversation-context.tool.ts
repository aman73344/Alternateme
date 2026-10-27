/**
 * ConversationContextTool
 *
 * Returns recent messages for the conversation the run belongs to. The query is
 * tenant-scoped by both conversationId and alternateId, and a visitor is
 * additionally confined to their own conversation.
 */

import { prisma } from '@/database';
import { AGENT_TOOL_NAMES } from '../agent.constants';
import { AgentError } from '../agent.errors';
import {
  AgentExecutionContext,
  ToolRiskLevel,
  type AgentTool,
  type ToolExecutionContext,
} from '../agent.types';
import { ConversationContextInputSchema } from './tool.schemas';

export interface ConversationContextOutput {
  conversationFound: boolean;
  messages: Array<{ role: string; content: string; createdAt: string }>;
  matchedCount: number;
}

export const conversationContextTool: AgentTool<
  { limit: number; includeRole: 'USER' | 'ASSISTANT' | 'BOTH' },
  ConversationContextOutput
> = {
  name: AGENT_TOOL_NAMES.CONVERSATION_CONTEXT,
  description:
    'Read the recent messages of the current conversation to resolve references ' +
    'like "that" or "the previous message". Read-only.',
  inputSchema: ConversationContextInputSchema,
  riskLevel: ToolRiskLevel.READ_ONLY,
  sideEffecting: false,
  allowPublicVisitor: true,

  async execute(context: ToolExecutionContext, input) {
    if (!context.conversationId) {
      return { conversationFound: false, messages: [], matchedCount: 0 };
    }

    // Tenant isolation is in the WHERE clause, never a post-filter.
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: context.conversationId,
        alternateId: context.alternateId,
        ...(context.executionContext === AgentExecutionContext.PUBLIC_VISITOR && context.userId
          ? { userId: context.userId }
          : {}),
      },
      select: { id: true },
    });
    if (!conversation) {
      throw AgentError.from('TOOL_NOT_ALLOWED', {
        tool: this.name,
        reason: 'CONVERSATION_NOT_VISIBLE',
      });
    }

    const messages = await prisma.message.findMany({
      where: {
        conversationId: conversation.id,
        ...(input.includeRole === 'BOTH' ? {} : { role: input.includeRole }),
      },
      orderBy: { createdAt: 'desc' },
      take: input.limit,
      select: { role: true, content: true, createdAt: true },
    });

    const ordered = messages.reverse();
    return {
      conversationFound: true,
      matchedCount: ordered.length,
      messages: ordered.map((m) => ({
        role: m.role,
        content: m.content.slice(0, 1000),
        createdAt: m.createdAt.toISOString(),
      })),
    };
  },
};

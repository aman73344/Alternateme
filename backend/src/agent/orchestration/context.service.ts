/**
 * Agent Context Service
 *
 * Assembles the starting context for a run by *reusing* the Phase 4/5
 * pipeline: `ragService` for retrieval, `memoryRetrievalService` for memory,
 * `conversationService` for history and `promptBuilder` for prompt assembly.
 * No Phase 6 code re-implements embedding, ranking, reranking or citations.
 */

import { config } from '@/config';
import { logger } from '@/utils/logger';
import { prisma } from '@/database';
import { ragService } from '@/rag/rag.service';
import { promptBuilder } from '@/rag/prompt-builder';
import type { ChatMessage, SourceCitation } from '@/rag/types';
import { memoryRetrievalService } from '@/memory/memory.retrieval';
import { conversationService } from '@/chat/conversation.service';
import { loadPersona } from '@/chat/chat.service';
import { AgentExecutionContext } from '../agent.types';

export interface AgentContextResult {
  messages: ChatMessage[];
  citations: SourceCitation[];
  memoryUsed: boolean;
  knowledgeUsed: boolean;
}

export interface LoadAgentContextParams {
  alternateId: string;
  userId: string;
  goal: string;
  conversationId?: string;
  executionContext: AgentExecutionContext;
}

/**
 * Build the base prompt for a run.
 * Memory is owner-only and failure-tolerant: a retrieval error degrades to
 * "no memory" rather than failing the run.
 */
export async function loadAgentContext(
  params: LoadAgentContextParams,
): Promise<AgentContextResult> {
  const { alternateId, userId, goal, conversationId, executionContext } = params;
  const isOwner = executionContext === AgentExecutionContext.OWNER;

  const alternate = await prisma.alternate.findFirst({
    where: { id: alternateId, deletedAt: null },
    select: { displayName: true, title: true, bio: true, userId: true },
  });
  if (!alternate) {
    throw new Error(`Alternate ${alternateId} not found while assembling agent context`);
  }

  // RAG + memory run in parallel, exactly as the existing chat path does.
  const [ragResult, memoryContext] = await Promise.all([
    ragService.retrieve(goal, alternateId, isOwner ? userId : alternate.userId),
    isOwner ? retrieveOwnerMemory(goal, alternateId, userId) : Promise.resolve(null),
  ]);

  const recentMessages = conversationId
    ? await conversationService.getRecentMessages(conversationId, userId, 10)
    : [];

  const persona = await loadPersona(alternateId);

  const messages = promptBuilder.buildPrompt(
    {
      displayName: alternate.displayName,
      title: alternate.title ?? undefined,
      bio: alternate.bio ?? undefined,
    },
    persona,
    ragResult.hasRelevantContext ? ragResult.chunks.map((c) => c.content).join('\n\n') : '',
    recentMessages,
    goal,
    memoryContext ?? undefined,
  );

  return {
    messages,
    citations: ragResult.citations,
    memoryUsed: !!memoryContext,
    knowledgeUsed: ragResult.hasRelevantContext,
  };
}

/** Owner-only memory retrieval; failures degrade to no memory context. */
async function retrieveOwnerMemory(
  query: string,
  alternateId: string,
  userId: string,
): Promise<string | null> {
  try {
    if (config.memory?.enabled === false) return null;
    const alternate = await prisma.alternate.findFirst({
      where: { id: alternateId, userId, deletedAt: null },
      select: { memoryEnabled: true },
    });
    if (!alternate?.memoryEnabled) return null;

    const result = await memoryRetrievalService.retrieve({
      alternateId,
      userId,
      query,
      includePrivate: true,
    });
    if (!result?.memories?.length || !result.formattedContext) return null;
    return result.formattedContext;
  } catch (err) {
    logger.warn({ err, alternateId }, 'agent.context.memory_unavailable');
    return null;
  }
}

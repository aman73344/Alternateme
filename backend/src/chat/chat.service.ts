/**
 * ChatService — Orchestrates the chat flow.
 *
 * Phase 5 integration:
 * - Runs memory retrieval alongside RAG retrieval (parallel)
 * - Passes memory context to the prompt builder (labeled as DATA)
 * - Queues async memory extraction after the response is returned
 * - Chat remains available even if memory retrieval/extraction fails
 */

import { prisma } from '@/database';
import { logger } from '@/utils/logger';
import { config } from '@/config';
import { ragService } from '../rag/rag.service';
import { promptBuilder, PersonaConfig } from '../rag/prompt-builder';
import { createLLMProvider } from '../rag/llm-provider';
import { providerService } from '@/ai-providers/provider.service';
import { conversationService } from './conversation.service';
import { memoryRetrievalService } from '@/memory/memory.retrieval';
import { memoryExtractionQueue } from '@/queues';
import type { ChatRequest, ChatResponse } from '../rag/types';
import { NotFoundError, AuthorizationError, BusinessError } from '@/utils/errors';

/** Load the persona for an alternate, mapped to PersonaConfig. */
async function loadPersona(alternateId: string): Promise<PersonaConfig | null> {
  const persona = await prisma.persona.findUnique({
    where: { alternateId },
  });
  if (!persona) return null;
  return {
    tone: persona.tone ?? undefined,
    writingStyle: persona.writingStyle ?? undefined,
    personality: persona.personality ?? undefined,
    instructions: persona.instructions ?? undefined,
    boundaries: persona.boundaries ?? undefined,
    refusalBehavior: persona.refusalBehavior ?? undefined,
  };
}

/**
 * Queue async memory extraction — NEVER on the critical path.
 * Returns silently when extraction or queues are disabled.
 */
function queueMemoryExtraction(params: {
  conversationId: string;
  messageId: string;
  alternateId: string;
  userId: string;
  messageContent: string;
}): void {
  try {
    if (config.memory?.extraction?.enabled === false) return;
    if (config.redis?.enabled === false) return;
    const queue = memoryExtractionQueue();
    if (!queue) return;

    void queue.add(
      'extract',
      {
        conversationId: params.conversationId,
        messageId: params.messageId,
        alternateId: params.alternateId,
        userId: params.userId,
        messageContent: params.messageContent,
      },
      {
        // Idempotency: one extraction job per assistant message
        jobId: `mem-extract-${params.messageId}`,
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
      },
    );
  } catch (err) {
    logger.warn({ err, conversationId: params.conversationId }, 'Failed to queue memory extraction');
  }
}

export class ChatService {
  async sendMessage(alternateId: string, userId: string, request: ChatRequest): Promise<ChatResponse> {
    const startTime = Date.now();

    // 1. Load + authorize alternate
    const alternate = await prisma.alternate.findUnique({ where: { id: alternateId } });
    if (!alternate || alternate.deletedAt) {
      throw new NotFoundError('Alternate not found');
    }
    const isOwner = alternate.userId === userId;
    if (!isOwner && alternate.visibility === 'PRIVATE') {
      throw new AuthorizationError('You do not have access to this alternate');
    }

    // 2. Load or create conversation
    let conversation = await prisma.conversation.findFirst({
      where: { alternateId, userId },
      orderBy: { updatedAt: 'desc' },
    });
    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          alternateId,
          userId,
          title: request.message.slice(0, 100),
          channel: 'CHAT',
        },
      });
    }

    // 3. Persist user message
    const userMessage = await conversationService.addMessage({
      conversationId: conversation.id,
      role: 'USER',
      content: request.message,
    });

    // 4. Persona + provider config (required for LLM)
    const persona = await loadPersona(alternateId);
    const providerConfig = await providerService.getDecryptedApiKey(alternateId, userId);
    if (!providerConfig) {
      throw new BusinessError('No AI provider configured for this alternate', 'NO_PROVIDER_CONFIGURED');
    }

    // 5. RAG + Memory retrieval in parallel (memory failure must not break chat)
    const [ragResult, memoryContext] = await Promise.all([
      ragService.retrieve(request.message, alternateId, userId),
      this.retrieveMemoryContext(request.message, alternateId),
    ]);

    const recentMessages = await conversationService.getRecentMessages(conversation.id, userId, 10);

    // 6. Context assembly — memories labeled as DATA, distinct from knowledge
    const messages = promptBuilder.buildPrompt(
      {
        displayName: alternate.displayName,
        title: alternate.title ?? undefined,
        bio: alternate.bio ?? undefined,
      },
      persona,
      ragResult.hasRelevantContext
        ? ragResult.chunks.map((c) => c.content).join('\n\n')
        : '',
      recentMessages,
      request.message,
      memoryContext ?? undefined,
    );

    // 7. LLM call
    let llmResponse: { content: string; tokensUsed?: number; model: string };
    try {
      const provider = createLLMProvider(providerConfig.provider as 'OPENAI' | 'ANTHROPIC');
      const response = await provider.generateChatCompletion({
        messages,
        model: providerConfig.defaultModel ?? 'gpt-4o',
        temperature: 0.7,
        maxTokens: 1024,
      });
      llmResponse = {
        content: response.content ?? '',
        tokensUsed: response.tokensUsed,
        model: response.model ?? 'gpt-4o',
      };
    } catch (err) {
      logger.error({ err, alternateId }, 'LLM call failed');
      throw new BusinessError('Failed to generate response. Please try again.', 'LLM_ERROR');
    }

    // 8. Persist assistant message
    const assistantMessage = await conversationService.addMessage({
      conversationId: conversation.id,
      role: 'ASSISTANT',
      content: llmResponse.content,
      tokensUsed: llmResponse.tokensUsed,
      modelUsed: llmResponse.model,
      latencyMs: Date.now() - startTime,
      sources: ragResult.citations.map((c) => ({
        title: c.title,
        url: c.url,
        page: c.page,
      })),
    });

    // 9. Queue async memory extraction (non-blocking, after response data is persisted)
    queueMemoryExtraction({
      conversationId: conversation.id,
      messageId: userMessage.id,
      alternateId,
      userId,
      messageContent: request.message,
    });

    logger.info(
      {
        conversationId: conversation.id,
        alternateId,
        memoryContext: memoryContext ? 'present' : 'none',
        totalLatencyMs: Date.now() - startTime,
      },
      'Chat response generated',
    );

    // 10. Response
    return {
      conversationId: conversation.id,
      message: {
        id: assistantMessage.id,
        role: 'ASSISTANT',
        content: llmResponse.content,
        createdAt: assistantMessage.createdAt,
      },
      sources: ragResult.citations.map((c) => ({
        title: c.title,
        url: c.url,
        page: c.page,
      })),
    };
  }

  /**
   * Retrieve formatted memory context for the prompt.
   * Owner-only personal context; failures are swallowed (memory is an enhancement).
   */
  private async retrieveMemoryContext(
    query: string,
    alternateId: string,
  ): Promise<string | null> {
    try {
      if (config.memory?.enabled === false) return null;
      const alternate = await prisma.alternate.findUnique({
        where: { id: alternateId },
        select: { memoryEnabled: true, userId: true },
      });
      if (!alternate?.memoryEnabled) return null;

      const result = await memoryRetrievalService.retrieve({
        alternateId,
        userId: alternate.userId,
        query,
        includePrivate: true,
      });
      if (!result?.memories?.length || !result.formattedContext) return null;

      return result.formattedContext;
    } catch (err) {
      logger.warn({ err, alternateId }, 'Memory retrieval failed; continuing without memory');
      return null;
    }
  }

  /**
   * Debug the RAG + Memory pipeline for a query (development only).
   * Returns safe diagnostics — never API keys, vectors, or full private content.
   */
  async debugRetrieval(
    alternateId: string,
    userId: string,
    query: string,
  ) {
    // Ownership check
    const alternate = await prisma.alternate.findFirst({
      where: { id: alternateId, userId, deletedAt: null },
    });
    if (!alternate) {
      throw new NotFoundError('Alternate not found or access denied');
    }

    const [ragResult, memoryResult] = await Promise.all([
      ragService.retrieve(query, alternateId, userId),
      this.retrieveMemoryContext(query, alternateId),
    ]);

    return {
      query,
      rag: {
        candidateCount: ragResult.candidateCount,
        finalCount: ragResult.finalCount,
        hasRelevantContext: ragResult.hasRelevantContext,
        chunks: ragResult.chunks.map((c) => ({
          id: c.id,
          sourceId: c.sourceId,
          documentId: c.documentId,
          similarity: c.similarity,
          rerankScore: c.rerankScore,
          preview: c.content.slice(0, 200),
        })),
        citations: ragResult.citations,
        latencyMs: ragResult.latencyMs,
      },
      memory: memoryResult
        ? { present: true, preview: memoryResult.slice(0, 800) }
        : { present: false },
    };
  }
}

export const chatService = new ChatService();

/**
 * ChatService — Orchestrates the chat flow.
 */

import { prisma } from '@/database';
import { logger } from '@/utils/logger';
import { NotFoundError, BusinessError } from '@/utils/errors';
import { config } from '@/config';
import { ragService } from '../rag/rag.service';
import { promptBuilder, PersonaConfig } from '../rag/prompt-builder';
import { createLLMProvider } from '../rag/llm-provider';
import { providerService } from '@/ai-providers/provider.service';
import { conversationService } from './conversation.service';
import type { ChatRequest, ChatResponse } from '../rag/types';

export class ChatService {
  /**
   * Process a chat message and return the AI response.
   */
  async sendMessage(
    alternateId: string,
    userId: string,
    request: ChatRequest
  ): Promise<ChatResponse> {
    const startTime = Date.now();

    const alternate = await prisma.alternate.findFirst({
      where: { id: alternateId, userId, deletedAt: null },
    });

    if (!alternate) {
      throw new NotFoundError('Alternate not found or access denied');
    }

    if (!request.message || request.message.trim().length === 0) {
      throw new BusinessError('Message cannot be empty', 'INVALID_MESSAGE');
    }

    if (request.message.length > 10000) {
      throw new BusinessError('Message too long (max 10000 characters)', 'MESSAGE_TOO_LONG');
    }

    let conversation;
    if (request.conversationId) {
      conversation = await conversationService.getConversation(request.conversationId, userId);
    } else {
      conversation = await conversationService.createConversation({
        alternateId,
        userId,
      });
    }

    await conversationService.addMessage({
      conversationId: conversation.id,
      role: 'USER',
      content: request.message,
    });

    const persona = await this.loadPersona(alternateId, userId);
    const providerConfig = await providerService.getDecryptedApiKey(alternateId, userId);

    const retrievalResult = await ragService.retrieve(
      request.message,
      alternateId,
      userId
    );

    const conversationHistory = await conversationService.getRecentMessages(
      conversation.id,
      userId,
      parseInt(process.env.MAX_CONVERSATION_MESSAGES || '10', 10)
    );

    const messages = promptBuilder.buildPrompt(
      {
        displayName: alternate.displayName,
        title: alternate.title || undefined,
        bio: alternate.bio || undefined,
      },
      persona,
      '',
      conversationHistory,
      request.message
    );

    if (retrievalResult.hasRelevantContext) {
      const knowledgeContext = retrievalResult.chunks
        .map((chunk) => chunk.content)
        .join('\n\n');

      const userMsgIndex = messages.findIndex((m) => m.role === 'USER');
      if (userMsgIndex > 0) {
        messages.splice(userMsgIndex, 0, {
          role: 'SYSTEM',
          content: `Retrieved knowledge:\n\n${knowledgeContext}\n\nUse this information to inform your response.`,
        });
      }
    }

    const llmStartTime = Date.now();
    let llmResponse: { content: string; tokensUsed?: number; model: string };

    try {
      const provider = createLLMProvider(providerConfig.provider as 'OPENAI' | 'ANTHROPIC');
      const response = await provider.generateChatCompletion({
        messages,
        model: providerConfig.defaultModel ?? config.ai.openai.model,
        temperature: 0.7,
        maxTokens: 1024,
      });

      llmResponse = {
        content: response.content,
        tokensUsed: response.tokensUsed,
        model: response.model,
      };
    } catch (error) {
      logger.error({ error, alternateId }, 'LLM call failed');
      throw new BusinessError('Failed to generate response. Please try again.', 'LLM_ERROR');
    }

    const llmLatencyMs = Date.now() - llmStartTime;

    const assistantMessage = await conversationService.addMessage({
      conversationId: conversation.id,
      role: 'ASSISTANT',
      content: llmResponse.content,
      tokensUsed: llmResponse.tokensUsed,
      modelUsed: llmResponse.model,
      latencyMs: llmLatencyMs,
      sources: retrievalResult.citations.map((c) => ({
        title: c.title,
        url: c.url,
        page: c.page,
      })),
    });

    logger.info({
      conversationId: conversation.id,
      alternateId,
      retrievalCount: retrievalResult.finalCount,
      llmLatencyMs,
      totalLatencyMs: Date.now() - startTime,
    }, 'Chat response generated');

    return {
      conversationId: conversation.id,
      message: {
        id: assistantMessage.id,
        role: 'ASSISTANT',
        content: assistantMessage.content,
        createdAt: assistantMessage.createdAt,
      },
      sources: retrievalResult.citations.map((c) => ({
        title: c.title,
        url: c.url,
        page: c.page,
      })),
    };
  }

  private async loadPersona(alternateId: string, userId: string): Promise<PersonaConfig | null> {
    const persona = await prisma.persona.findFirst({
      where: { alternateId, userId },
    });

    if (!persona) {
      return null;
    }

    return {
      tone: persona.tone || undefined,
      writingStyle: persona.writingStyle || undefined,
      personality: persona.personality || undefined,
      instructions: persona.instructions || undefined,
      boundaries: persona.boundaries || undefined,
      refusalBehavior: persona.refusalBehavior || undefined,
    };
  }

  /**
   * Debug endpoint for RAG pipeline.
   */
  async debugRetrieval(
    alternateId: string,
    userId: string,
    query: string
  ) {
    const alternate = await prisma.alternate.findFirst({
      where: { id: alternateId, userId, deletedAt: null },
    });

    if (!alternate) {
      throw new NotFoundError('Alternate not found or access denied');
    }

    const retrievalResult = await ragService.retrieve(query, alternateId, userId);

    return {
      query: retrievalResult.query,
      normalizedQuery: retrievalResult.normalizedQuery,
      candidateCount: retrievalResult.candidateCount,
      retrievedChunks: retrievalResult.chunks.map((chunk) => ({
        id: chunk.id,
        content: chunk.content.slice(0, 200) + (chunk.content.length > 200 ? '...' : ''),
        similarity: chunk.similarity,
        rerankScore: chunk.rerankScore,
        sourceId: chunk.sourceId,
        documentId: chunk.documentId,
      })),
      scores: {
        similarity: retrievalResult.chunks.map((c) => c.similarity),
        rerank: retrievalResult.chunks.map((c) => c.rerankScore),
      },
      sources: retrievalResult.citations,
      hasRelevantContext: retrievalResult.hasRelevantContext,
      latencyMs: retrievalResult.latencyMs,
    };
  }
}

export const chatService = new ChatService();

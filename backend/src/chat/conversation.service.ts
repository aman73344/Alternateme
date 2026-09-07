/**
 * ConversationService — Manages conversations and messages.
 * 
 * Responsibilities:
 * - Create and retrieve conversations
 * - Persist user and assistant messages
 * - Retrieve conversation history
 * - Enforce ownership validation
 * 
 * Uses the existing Conversation and Message models from the Prisma schema.
 */

import { prisma } from '@/database';
import { logger } from '@/utils/logger';
import { NotFoundError } from '@/utils/errors';
import type { ChatMessage } from '../rag/types';

export interface CreateConversationInput {
  alternateId: string;
  userId: string;
  title?: string;
}

export interface AddMessageInput {
  conversationId: string;
  role: 'USER' | 'ASSISTANT' | 'SYSTEM';
  content: string;
  tokensUsed?: number;
  modelUsed?: string;
  latencyMs?: number;
  sources?: Array<{
    title: string;
    url?: string;
    page?: number;
  }>;
}

export class ConversationService {
  /**
   * Create a new conversation.
   */
  async createConversation(input: CreateConversationInput) {
    const conversation = await prisma.conversation.create({
      data: {
        alternateId: input.alternateId,
        userId: input.userId,
        title: input.title || 'New Conversation',
        channel: 'CHAT',
        messageCount: 0,
      },
    });

    logger.info({
      conversationId: conversation.id,
      alternateId: input.alternateId,
      userId: input.userId,
    }, 'Conversation created');

    return conversation;
  }

  /**
   * Get a conversation by ID, validating ownership.
   */
  async getConversation(conversationId: string, userId: string) {
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        userId,
      },
    });

    if (!conversation) {
      throw new NotFoundError('Conversation not found or access denied');
    }

    return conversation;
  }

  /**
   * Get all conversations for an alternate.
   */
  async getConversationsByAlternate(alternateId: string, userId: string) {
    return prisma.conversation.findMany({
      where: {
        alternateId,
        userId,
      },
      orderBy: {
        updatedAt: 'desc',
      },
      select: {
        id: true,
        title: true,
        messageCount: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  /**
   * Get messages for a conversation.
   */
  async getMessages(conversationId: string, userId: string) {
    // Validate ownership first
    await this.getConversation(conversationId, userId);

    return prisma.message.findMany({
      where: {
        conversationId,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
  }

  /**
   * Get recent messages for context window.
   */
  async getRecentMessages(conversationId: string, userId: string, limit: number = 10): Promise<ChatMessage[]> {
    // Validate ownership first
    await this.getConversation(conversationId, userId);

    const messages = await prisma.message.findMany({
      where: {
        conversationId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
    });

    // Reverse to get chronological order
    return messages.reverse().map((m) => ({
      role: m.role as ChatMessage['role'],
      content: m.content,
    }));
  }

  /**
   * Add a message to a conversation.
   */
  async addMessage(input: AddMessageInput) {
    const message = await prisma.message.create({
      data: {
        conversationId: input.conversationId,
        role: input.role,
        content: input.content,
        tokensUsed: input.tokensUsed,
        modelUsed: input.modelUsed,
        latencyMs: input.latencyMs,
        sources: input.sources as any,
      },
    });

    // Update conversation message count and timestamp
    await prisma.conversation.update({
      where: { id: input.conversationId },
      data: {
        messageCount: { increment: 1 },
        updatedAt: new Date(),
      },
    });

    return message;
  }

  /**
   * Delete a conversation and its messages.
   */
  async deleteConversation(conversationId: string, userId: string) {
    await this.getConversation(conversationId, userId);

    await prisma.conversation.delete({
      where: { id: conversationId },
    });

    logger.info({ conversationId, userId }, 'Conversation deleted');
  }

  /**
   * Update conversation title.
   */
  async updateTitle(conversationId: string, userId: string, title: string) {
    await this.getConversation(conversationId, userId);

    return prisma.conversation.update({
      where: { id: conversationId },
      data: { title },
    });
  }
}

export const conversationService = new ConversationService();

/**
 * ChatController — HTTP layer for chat endpoints.
 * 
 * Endpoints:
 * - POST /alternates/:alternateId/chat — Send a message
 * - GET /alternates/:alternateId/conversations — List conversations
 * - GET /alternates/:alternateId/conversations/:conversationId — Get conversation with messages
 * - DELETE /alternates/:alternateId/conversations/:conversationId — Delete conversation
 * - POST /alternates/:alternateId/rag/debug — Debug RAG pipeline (dev only)
 */

import { Request, Response, NextFunction } from 'express';
import { chatService } from './chat.service';
import { conversationService } from './conversation.service';

export class ChatController {
  /**
   * POST /alternates/:alternateId/chat
   * Send a chat message and receive an AI response.
   */
  async sendMessage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { alternateId } = req.params;
      const userId = req.authUser?.id;
      const { conversationId, message } = req.body;

      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      if (!message || typeof message !== 'string') {
        res.status(400).json({ error: 'Message is required' });
        return;
      }

      const response = await chatService.sendMessage(alternateId, userId, {
        conversationId,
        message,
      });

      res.status(200).json({
        data: response,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /alternates/:alternateId/conversations
   * List all conversations for an alternate.
   */
  async listConversations(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { alternateId } = req.params;
      const userId = req.authUser?.id;

      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const conversations = await conversationService.getConversationsByAlternate(
        alternateId,
        userId
      );

      res.status(200).json({
        data: conversations,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /alternates/:alternateId/conversations/:conversationId
   * Get a conversation with its messages.
   */
  async getConversation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { conversationId } = req.params;
      const userId = req.authUser?.id;

      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const conversation = await conversationService.getConversation(conversationId, userId);
      const messages = await conversationService.getMessages(conversationId, userId);

      res.status(200).json({
        data: {
          ...conversation,
          messages,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /alternates/:alternateId/conversations/:conversationId
   * Delete a conversation.
   */
  async deleteConversation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { conversationId } = req.params;
      const userId = req.authUser?.id;

      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      await conversationService.deleteConversation(conversationId, userId);

      res.status(200).json({
        data: { success: true },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /alternates/:alternateId/rag/debug
   * Debug the RAG pipeline (development only).
   */
  async debugRag(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { alternateId } = req.params;
      const userId = req.authUser?.id;
      const { query } = req.body;

      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      if (!query || typeof query !== 'string') {
        res.status(400).json({ error: 'Query is required' });
        return;
      }

      // Only allow in development/debug mode
      if (process.env.NODE_ENV === 'production' && process.env.ENABLE_RAG_DEBUG !== 'true') {
        res.status(403).json({ error: 'Debug endpoint disabled in production' });
        return;
      }

      const debugInfo = await chatService.debugRetrieval(alternateId, userId, query);

      res.status(200).json({
        data: debugInfo,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /alternates/:alternateId/memory/debug
   * Debug the Memory pipeline (development only).
   */
  async debugMemory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { alternateId } = req.params;
      const userId = req.authUser?.id;
      const { query } = req.body;

      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      if (!query || typeof query !== 'string') {
        res.status(400).json({ error: 'Query is required' });
        return;
      }

      if (process.env.NODE_ENV === 'production' && process.env.ENABLE_MEMORY_DEBUG !== 'true') {
        res.status(403).json({ error: 'Memory debug endpoint disabled in production' });
        return;
      }

      const { memoryRetrievalService } = await import('@/memory/memory.retrieval');
      const memoryResult = await memoryRetrievalService.retrieve({
        query,
        alternateId,
        userId,
        limit: parseInt(process.env.MEMORY_TOP_K || '10', 10),
        minScore: parseFloat(process.env.MEMORY_MIN_SCORE || '0.3'),
        includePrivate: true,
      });

      res.status(200).json({
        data: {
          query,
          resultCount: memoryResult.memories.length,
          memories: memoryResult.memories.map((m) => ({
            id: m.id,
            type: m.type,
            content: m.content,
            importance: m.importance,
            confidence: m.confidence,
            sourceType: m.sourceType,
            status: m.status,
            similarity: (m as any).similarity ?? null,
          })),
          formattedContext: memoryResult.formattedContext,
          tokenEstimate: memoryResult.tokenEstimate,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}

export const chatController = new ChatController();

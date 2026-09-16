/**
 * Chat Routes — API endpoints for chat functionality.
 * 
 * All routes require authentication and alternate ownership validation.
 */

import { Router, Router as ExpressRouter } from 'express';
import { chatController } from './chat.controller';
import { authenticate } from '@/auth/middlewares/auth.middleware';
import { requireAlternateOwnership } from '@/middlewares/ownership';
import rateLimit from 'express-rate-limit';

const router: ExpressRouter = Router();

// Apply authentication to all chat routes
router.use(authenticate);

// Rate limiting for chat endpoint
const chatRateLimiter = rateLimit({
  windowMs: parseInt(process.env.CHAT_RATE_LIMIT_WINDOW_MS || '60000', 10),
  max: parseInt(process.env.CHAT_RATE_LIMIT_MAX || '30', 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_ERROR',
      message: 'Too many chat messages, please try again later.',
    },
  },
});

/**
 * POST /alternates/:alternateId/chat
 * Send a chat message.
 */
router.post(
  '/:alternateId/chat',
  chatRateLimiter,
  requireAlternateOwnership,
  chatController.sendMessage.bind(chatController)
);

/**
 * GET /alternates/:alternateId/conversations
 * List conversations for an alternate.
 */
router.get(
  '/:alternateId/conversations',
  requireAlternateOwnership,
  chatController.listConversations.bind(chatController)
);

/**
 * GET /alternates/:alternateId/conversations/:conversationId
 * Get a conversation with messages.
 */
router.get(
  '/:alternateId/conversations/:conversationId',
  requireAlternateOwnership,
  chatController.getConversation.bind(chatController)
);

/**
 * DELETE /alternates/:alternateId/conversations/:conversationId
 * Delete a conversation.
 */
router.delete(
  '/:alternateId/conversations/:conversationId',
  requireAlternateOwnership,
  chatController.deleteConversation.bind(chatController)
);

/**
 * POST /alternates/:alternateId/rag/debug
 * Debug RAG pipeline (development only).
 */
router.post(
  '/:alternateId/rag/debug',
  requireAlternateOwnership,
  chatController.debugRag.bind(chatController)
);

/**
 * POST /alternates/:alternateId/memory/debug
 * Debug Memory pipeline (development only).
 */
router.post(
  '/:alternateId/memory/debug',
  requireAlternateOwnership,
  chatController.debugMemory.bind(chatController),
);

export { router as chatRouter };

/**
 * Conversation Summary Repository
 *
 * Manages summaries for long conversations to bound context.
 */

import { prisma } from '@/database';

/** Create or update a conversation summary. */
export async function upsertConversationSummary(
  conversationId: string,
  alternateId: string,
  userId: string,
  summary: string,
  messageRangeStart: number,
  messageRangeEnd: number,
  tokenCount: number,
) {
  return prisma.conversationSummary.upsert({
    where: { conversationId, alternateId, userId },
    update: {
      summary,
      messageRangeStart,
      messageRangeEnd,
      tokenCount,
      updatedAt: new Date(),
    },
    create: {
      conversationId,
      alternateId,
      userId,
      summary,
      messageRangeStart,
      messageRangeEnd,
      tokenCount,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });
}

/** Find a conversation summary by conversation ID. */
export async function findConversationSummary(
  conversationId: string,
  alternateId: string,
  userId: string,
) {
  return prisma.conversationSummary.findFirst({
    where: { conversationId, alternateId, userId },
  });
}

/** Delete a conversation summary. */
export async function deleteConversationSummary(
  conversationId: string,
  alternateId: string,
  userId: string,
): Promise<boolean> {
  const result = await prisma.conversationSummary.deleteMany({
    where: { conversationId, alternateId, userId },
  });
  return result.count > 0;
}

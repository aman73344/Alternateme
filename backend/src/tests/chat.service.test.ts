/**
 * Chat Service Tests - Conversation and Message Management
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/database';
import { conversationService } from '@/chat/conversation.service';

let testUserId: string;
let testAlternateId: string;
let otherUserId: string;

describe('Chat Service - Conversations', () => {
  beforeAll(async () => {
    const testUser = await prisma.user.create({
      data: {
        email: `chat-test-${Date.now()}@test.com`,
        username: `chattest${Date.now()}`,
        passwordHash: 'test-hash',
        emailVerified: true,
      },
    });
    testUserId = testUser.id;

    const testAlternate = await prisma.alternate.create({
      data: {
        userId: testUserId,
        username: `chat-test-${Date.now()}`,
        displayName: 'Chat Test Alternate',
      },
    });
    testAlternateId = testAlternate.id;

    const otherUser = await prisma.user.create({
      data: {
        email: `chat-other-${Date.now()}@test.com`,
        username: `chatother${Date.now()}`,
        passwordHash: 'test-hash',
        emailVerified: true,
      },
    });
    otherUserId = otherUser.id;
  });

  afterAll(async () => {
    await prisma.message.deleteMany({
      where: { conversation: { alternateId: testAlternateId } },
    });
    await prisma.conversation.deleteMany({
      where: { alternateId: testAlternateId },
    });
    await prisma.alternate.deleteMany({
      where: { id: testAlternateId },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [testUserId, otherUserId] } },
    });
  });

  it('should create a new conversation', async () => {
    const conversation = await conversationService.createConversation({
      alternateId: testAlternateId,
      userId: testUserId,
      title: 'Test Conversation',
    });

    expect(conversation).toBeDefined();
    expect(conversation.alternateId).toBe(testAlternateId);
    expect(conversation.userId).toBe(testUserId);
  });

  it('should retrieve conversation by ID', async () => {
    const created = await conversationService.createConversation({
      alternateId: testAlternateId,
      userId: testUserId,
    });

    const retrieved = await conversationService.getConversation(created.id, testUserId);
    expect(retrieved.id).toBe(created.id);
  });

  it('should prevent cross-user conversation access', async () => {
    const created = await conversationService.createConversation({
      alternateId: testAlternateId,
      userId: testUserId,
    });

    await expect(
      conversationService.getConversation(created.id, otherUserId)
    ).rejects.toThrow();
  });

  it('should list conversations for an alternate', async () => {
    const conversations = await conversationService.getConversationsByAlternate(
      testAlternateId,
      testUserId
    );

    expect(conversations.length).toBeGreaterThan(0);
  });

  it('should delete a conversation', async () => {
    const created = await conversationService.createConversation({
      alternateId: testAlternateId,
      userId: testUserId,
    });

    await conversationService.deleteConversation(created.id, testUserId);

    await expect(
      conversationService.getConversation(created.id, testUserId)
    ).rejects.toThrow();
  });

  it('should add and retrieve messages', async () => {
    const conversation = await conversationService.createConversation({
      alternateId: testAlternateId,
      userId: testUserId,
    });

    await conversationService.addMessage({
      conversationId: conversation.id,
      role: 'USER',
      content: 'Hello',
    });

    await conversationService.addMessage({
      conversationId: conversation.id,
      role: 'ASSISTANT',
      content: 'Hi there!',
    });

    const messages = await conversationService.getMessages(conversation.id, testUserId);
    expect(messages.length).toBe(2);
    expect(messages[0].content).toBe('Hello');
    expect(messages[1].content).toBe('Hi there!');
  });
});

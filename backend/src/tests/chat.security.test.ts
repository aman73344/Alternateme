/**
 * Chat Security Tests
 *
 * Tests security aspects of the chat system:
 * - Unauthorized access prevention
 * - Cross-user data isolation
 * - Input validation
 * - API key protection
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/database';
import { chatService } from '@/chat/chat.service';

let testUserId: string;
let testAlternateId: string;
let otherUserId: string;

describe('Chat Security', () => {
  beforeAll(async () => {
    const testUser = await prisma.user.create({
      data: {
        email: `chat-sec-${Date.now()}@test.com`,
        username: `chatsec${Date.now()}`,
        passwordHash: 'test-hash',
        emailVerified: new Date(),
      },
    });
    testUserId = testUser.id;

    const testAlternate = await prisma.alternate.create({
      data: {
        userId: testUserId,
        username: `chat-sec-alt-${Date.now()}`,
        displayName: 'Security Test Alternate',
      },
    });
    testAlternateId = testAlternate.id;

    await prisma.aIProviderConfig.create({
      data: {
        userId: testUserId,
        alternateId: testAlternateId,
        provider: 'OPENAI',
        encryptedApiKey: 'encrypted-test-key',
        defaultModel: 'gpt-4o',
        status: 'PENDING',
      },
    });

    const otherUser = await prisma.user.create({
      data: {
        email: `chat-sec-other-${Date.now()}@test.com`,
        username: `chatsecother${Date.now()}`,
        passwordHash: 'test-hash',
        emailVerified: new Date(),
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
    await prisma.aIProviderConfig.deleteMany({
      where: { alternateId: testAlternateId },
    });
    await prisma.alternate.deleteMany({
      where: { id: testAlternateId },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [testUserId, otherUserId] } },
    });
  });

  it('should reject empty messages', async () => {
    await expect(
      chatService.sendMessage(testAlternateId, testUserId, {
        message: '',
      })
    ).rejects.toThrow();
  });

  it('should reject messages that are too long', async () => {
    const longMessage = 'a'.repeat(10001);

    await expect(
      chatService.sendMessage(testAlternateId, testUserId, {
        message: longMessage,
      })
    ).rejects.toThrow();
  });

  it('should prevent unauthorized user from chatting with alternate', async () => {
    await expect(
      chatService.sendMessage(testAlternateId, otherUserId, {
        message: 'Hello',
      })
    ).rejects.toThrow();
  });

  it('should validate message type', async () => {
    await expect(
      chatService.sendMessage(testAlternateId, testUserId, {
        message: 123 as any,
      })
    ).rejects.toThrow();
  });
});

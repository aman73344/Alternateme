/**
 * Memory Repository — Core CRUD functions
 */

import { prisma } from '@/database';
import {
  MemoryType,
  MemoryStatus,
  MemoryVisibility,
  MemorySourceType,
  CreateMemoryInput,
  UpdateMemoryInput,
  Memory,
} from './memory.types';
import { normalizeContent } from './memory.policy';

function toMemory(prismaMemory: any): Memory {
  return {
    id: prismaMemory.id,
    alternateId: prismaMemory.alternateId,
    userId: prismaMemory.userId,
    type: prismaMemory.type as MemoryType,
    content: prismaMemory.content,
    normalizedContent: prismaMemory.normalizedContent,
    importance: prismaMemory.importance,
    confidence: prismaMemory.confidence,
    sourceType: prismaMemory.sourceType as MemorySourceType,
    sourceConversationId: prismaMemory.sourceConversationId,
    sourceMessageId: prismaMemory.sourceMessageId,
    status: prismaMemory.status as MemoryStatus,
    visibility: prismaMemory.visibility as MemoryVisibility,
    isExtracted: prismaMemory.isExtracted,
    expiresAt: prismaMemory.expiresAt,
    lastAccessedAt: prismaMemory.lastAccessedAt,
    lastReinforcedAt: prismaMemory.lastReinforcedAt,
    reinforcementCount: prismaMemory.reinforcementCount,
    supersededById: prismaMemory.supersededById,
    createdAt: prismaMemory.createdAt,
    updatedAt: prismaMemory.updatedAt,
  };
}

export { toMemory };

/** Create a new memory record. */
export async function createMemory(input: CreateMemoryInput): Promise<Memory> {
  const normalized = normalizeContent(input.content);
  const memory = await prisma.memory.create({
    data: {
      alternateId: input.alternateId,
      userId: input.userId,
      type: input.type,
      content: input.content,
      normalizedContent: normalized,
      sourceType: input.sourceType,
      importance: input.importance,
      confidence: input.confidence,
      sourceConversationId: input.sourceConversationId,
      sourceMessageId: input.sourceMessageId,
      visibility: input.visibility ?? MemoryVisibility.PRIVATE,
      status: MemoryStatus.ACTIVE,
      isExtracted: true,
      expiresAt: input.expiresAt,
      lastAccessedAt: new Date(),
      lastReinforcedAt: new Date(),
      reinforcementCount: 0,
    },
  });
  return toMemory(memory);
}

/** Update a memory. */
export async function updateMemory(
  memoryId: string, alternateId: string, userId: string, input: UpdateMemoryInput,
): Promise<Memory> {
  const memory = await prisma.memory.update({
    where: { id: memoryId, alternateId, userId },
    data: {
      ...input,
      normalizedContent: input.content ? normalizeContent(input.content) : undefined,
    },
  });
  return toMemory(memory);
}

/** Find a memory by ID. */
export async function findMemoryById(
  memoryId: string, alternateId: string, userId: string,
): Promise<Memory | null> {
  const memory = await prisma.memory.findFirst({ where: { id: memoryId, alternateId, userId } });
  return memory ? toMemory(memory) : null;
}

/** Find existing memory by source message. */
export async function findExistingBySourceMessage(
  alternateId: string, userId: string, sourceMessageId: string, type: MemoryType,
): Promise<Memory | null> {
  const memory = await prisma.memory.findFirst({
    where: {
      alternateId, userId, sourceMessageId, type,
      status: { in: [MemoryStatus.ACTIVE, MemoryStatus.SUPERSEDED] },
    },
    orderBy: { createdAt: 'desc' },
  });
  return memory ? toMemory(memory) : null;
}

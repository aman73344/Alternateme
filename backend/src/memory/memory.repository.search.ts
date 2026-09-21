/**
 * Memory Repository — Search, retrieval, and lifecycle functions
 */

import { prisma } from '@/database';
import {
  MemoryType,
  MemoryStatus,
  MemoryVisibility,
  Memory,
} from './memory.types';
import { toMemory } from './memory.repository';
import { NotFoundError } from '@/utils/errors';

/** Find existing memory by normalized content. */
export async function findExistingByNormalizedContent(
  alternateId: string, userId: string, normalizedContent: string, type: MemoryType,
): Promise<Memory | null> {
  const memory = await prisma.memory.findFirst({
    where: {
      alternateId, userId, normalizedContent, type,
      status: { in: [MemoryStatus.ACTIVE, MemoryStatus.SUPERSEDED] },
    },
  });
  return memory ? toMemory(memory) : null;
}

/** Check if a memory exists. */
export async function memoryExists(
  memoryId: string, alternateId: string, userId: string,
): Promise<boolean> {
  const count = await prisma.memory.count({ where: { id: memoryId, alternateId, userId } });
  return count > 0;
}

/** Soft delete a memory and its embedding. */
export async function deleteMemory(
  memoryId: string, alternateId: string, userId: string,
): Promise<boolean> {
  try {
    // Verify the memory belongs to this tenant BEFORE deleting the embedding
    const existing = await prisma.memory.findUnique({
      where: { id: memoryId, alternateId, userId },
      select: { id: true },
    });
    if (!existing) throw new NotFoundError('Memory not found');

    // Delete the embedding first (if exists), then soft delete the memory
    const { deleteMemoryEmbedding } = await import('./memory-embedding.repository');
    await deleteMemoryEmbedding(memoryId);

    await prisma.memory.update({
      where: { id: memoryId, alternateId, userId },
      data: { status: MemoryStatus.DELETED, updatedAt: new Date() },
    });
    return true;
  } catch (err: any) {
    if (err instanceof NotFoundError) throw err;
    if (err.code === 'P2025') throw new NotFoundError('Memory not found');
    throw err;
  }
}export async function supersedeMemory(
  memoryId: string, alternateId: string, userId: string, supersededById?: string,
): Promise<Memory> {
  const memory = await prisma.memory.update({
    where: { id: memoryId, alternateId, userId },
    data: {
      status: MemoryStatus.SUPERSEDED,
      supersededById: supersededById ?? null,
      updatedAt: new Date(),
    },
  });
  return toMemory(memory);
}

/** Reinforce an existing memory. */
export async function reinforceMemory(
  memoryId: string, alternateId: string, userId: string,
): Promise<Memory> {
  const current = await prisma.memory.findUnique({
    where: { id: memoryId }, select: { confidence: true },
  });
  const updated = await prisma.memory.update({
    where: { id: memoryId, alternateId, userId },
    data: {
      lastReinforcedAt: new Date(),
      reinforcementCount: { increment: 1 },
      confidence: Math.min((current?.confidence ?? 0.5) + 0.05, 1.0),
    },
  });
  return toMemory(updated);
}

/** Update lastAccessedAt for retrieved memories. */
export async function updateAccessTimestamps(memoryIds: string[]): Promise<void> {
  if (memoryIds.length === 0) return;
  await prisma.memory.updateMany({
    where: { id: { in: memoryIds } },
    data: { lastAccessedAt: new Date() },
  });
}

/** Search memories for list API and retrieval. */
export async function searchMemories(params: {
  alternateId: string;
  userId: string;
  types?: MemoryType[];
  statuses?: MemoryStatus[];
  search?: string;
  includePrivate?: boolean;
  page?: number;
  limit?: number;
  sort?: 'createdAt' | 'updatedAt' | 'importance' | 'lastAccessedAt';
  sortOrder?: 'asc' | 'desc';
}): Promise<{ memories: Memory[]; totalCount: number }> {
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(params.limit ?? 20, 100);
  const skip = (page - 1) * limit;
  const sortField = params.sort ?? 'createdAt';
  const sortOrder = params.sortOrder ?? 'desc';

      const where: any = {
    alternateId: params.alternateId,
    userId: params.userId,
    // Only retrieve ACTIVE memories by default (excludes DELETED, ARCHIVED, EXPIRED, SUPERSEDED)
    status: params.statuses && params.statuses.length > 0
      ? { in: params.statuses }
      : MemoryStatus.ACTIVE,
    // Default visibility: only ALTERNATE unless explicitly including private
    visibility: params.includePrivate ? undefined : MemoryVisibility.ALTERNATE,
  };

  if (params.types && params.types.length > 0) where.type = { in: params.types };

  // Build AND conditions for expiry and search
  const andConditions: any[] = [
    // Exclude expired memories (null = never expires, OR future date)
    { OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }] },
  ];

  if (params.search) {
    andConditions.push({
      OR: [
        { content: { contains: params.search, mode: 'insensitive' } },
        { normalizedContent: { contains: params.search.toLowerCase(), mode: 'insensitive' } },
      ],
    });
  }

  where.AND = andConditions;

  // Remove undefined visibility (when includePrivate is true)
  if (where.visibility === undefined) delete where.visibility;

  const [memories, totalCount] = await Promise.all([
    prisma.memory.findMany({ where, orderBy: { [sortField]: sortOrder }, skip, take: limit }),
    prisma.memory.count({ where }),
  ]);

  return { memories: memories.map(toMemory), totalCount };
}

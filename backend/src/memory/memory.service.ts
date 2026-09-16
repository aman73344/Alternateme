/**
 * Memory Service
 *
 * High-level orchestration of memory operations:
 * - Creating/updating memories
 * - Retrieving relevant memories
 * - Forgetting/superseding memories
 * - Managing memory lifecycle
 */

import { logger } from '@/utils/logger';
import { prisma } from '@/database';
import {
  Memory,
  UpdateMemoryInput,
  MemoryType,
  MemoryStatus,
} from './memory.types';
import {
  findMemoryById,
  updateMemory,
} from './memory.repository';
import {
  searchMemories as searchMemoriesDb,
  deleteMemory,
  reinforceMemory,
} from './memory.repository.search';

export class MemoryService {
  private static instance: MemoryService;

  static getInstance(): MemoryService {
    if (!MemoryService.instance) {
      MemoryService.instance = new MemoryService();
    }
    return MemoryService.instance;
  }

  /** Get a single memory by ID (with ownership check). */
  async getMemory(
    memoryId: string,
    alternateId: string,
    userId: string,
  ): Promise<Memory | null> {
    const memory = await findMemoryById(memoryId, alternateId, userId);
    if (memory) {
      logger.info({ memoryId, alternateId }, 'memory.retrieved');
    }
    return memory;
  }

  /** List memories with filtering and pagination. */
  async listMemories(alternateId: string, userId: string, params: {
    types?: MemoryType[];
    statuses?: MemoryStatus[];
    search?: string;
    page?: number;
    limit?: number;
    sort?: 'createdAt' | 'updatedAt' | 'importance' | 'lastAccessedAt';
    sortOrder?: 'asc' | 'desc';
  }) {
    return searchMemoriesDb({ alternateId, userId, ...params });
  }

  /** Update a memory. */
  async updateMemory(
    memoryId: string,
    alternateId: string,
    userId: string,
    input: UpdateMemoryInput,
  ): Promise<Memory> {
    const memory = await updateMemory(memoryId, alternateId, userId, input);
    logger.info({ memoryId, alternateId }, 'memory.updated');
    return memory;
  }

  /** Delete a memory (soft delete). */
  async deleteMemory(
    memoryId: string,
    alternateId: string,
    userId: string,
  ): Promise<void> {
    await deleteMemory(memoryId, alternateId, userId);
    // Also remove the embedding
    const { deleteMemoryEmbedding } = await import('./memory-embedding.repository');
    await deleteMemoryEmbedding(memoryId);
    logger.info({ memoryId, alternateId }, 'memory.deleted');
  }

  /** Forget a memory — archive + supersede (owner-initiated "forget this"). */
  async forgetMemory(
    memoryId: string,
    alternateId: string,
    userId: string,
  ): Promise<void> {
    await deleteMemory(memoryId, alternateId, userId);
    const { deleteMemoryEmbedding } = await import('./memory-embedding.repository');
    await deleteMemoryEmbedding(memoryId);
    logger.info({ memoryId, alternateId }, 'memory.forgotten');
  }

  /** Archive a memory (retained for audit, not retrieved). */
  async archiveMemory(
    memoryId: string,
    alternateId: string,
    userId: string,
  ): Promise<Memory> {
    const memory = await updateMemory(memoryId, alternateId, userId, {
      status: MemoryStatus.ARCHIVED,
    });
    logger.info({ memoryId, alternateId }, 'memory.archived');
    return memory;
  }

  /** Confirm a memory (explicit user confirmation) — boost confidence. */
  async confirmMemory(
    memoryId: string,
    alternateId: string,
    userId: string,
  ): Promise<Memory> {
    const memory = await reinforceMemory(memoryId, alternateId, userId);
    logger.info({ memoryId, alternateId }, 'memory.confirmed');
    return memory;
  }

  /** Check if memory is enabled for this alternate. */
  async isMemoryEnabled(alternateId: string): Promise<boolean> {
    const alternate = await prisma.alternate.findUnique({
      where: { id: alternateId },
      select: { memoryEnabled: true },
    });
    return alternate?.memoryEnabled ?? false;
  }
}

export const memoryService = MemoryService.getInstance();

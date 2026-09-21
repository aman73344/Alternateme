import { randomUUID } from 'crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/database';
import { createMemory } from '@/memory/memory.repository';
import { memoryService } from '@/memory/memory.service';
import { memoryRetrievalService } from '@/memory/memory.retrieval';
import { upsertMemoryEmbedding, memoryEmbeddingExists } from '@/memory/memory-embedding.repository';
import { retrieveByVector } from '@/memory/memory.repository.vector';
import { MemorySourceType, MemoryStatus, MemoryType, MemoryVisibility } from '@/memory/memory.types';

// Real PostgreSQL assertions: an empty result must not masquerade as vector isolation.
describe('Phase 5 memory persistence and retrieval', () => {
  const userIds: string[] = [];
  const alternateIds: string[] = [];
  const vector = Array.from({ length: 1536 }, (_, i) => i === 0 ? 1 : 0);
  const marker = `memory-${randomUUID()}`;

  beforeAll(async () => {
    for (let i = 0; i < 2; i++) {
      const suffix = randomUUID();
      const user = await prisma.user.create({ data: {
        email: `${suffix}@memory.test`, username: suffix, emailVerified: new Date(),
      } });
      userIds.push(user.id);
      const alternate = await prisma.alternate.create({ data: {
        userId: user.id, username: randomUUID(), displayName: 'Memory regression', memoryEnabled: true,
      } });
      alternateIds.push(alternate.id);
    }
  });

  afterAll(async () => {
    // Never run an unscoped cleanup if setup fails.
    if (userIds.length) await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  });

  const create = (tenant = 0, content = marker) => createMemory({
    alternateId: alternateIds[tenant], userId: userIds[tenant], content,
    type: MemoryType.FACT, sourceType: MemorySourceType.EXPLICIT,
    importance: 0.9, confidence: 0.9, visibility: MemoryVisibility.ALTERNATE,
  });

  it('filters lexical results by lifecycle, privacy, type and tenant before pagination', async () => {
    const active = await create();
    const privateMemory = await create();
    await prisma.memory.update({ where: { id: privateMemory.id }, data: { visibility: 'PRIVATE' } });
    for (const status of [MemoryStatus.DELETED, MemoryStatus.ARCHIVED, MemoryStatus.EXPIRED, MemoryStatus.SUPERSEDED]) {
      const memory = await create();
      await prisma.memory.update({ where: { id: memory.id }, data: { status } });
    }
    const expired = await create();
    await prisma.memory.update({ where: { id: expired.id }, data: { expiresAt: new Date(0) } });
    const preference = await create();
    await prisma.memory.update({ where: { id: preference.id }, data: { type: 'PREFERENCE' } });
    await create(1);
    const result = await memoryRetrievalService.retrieve({
      alternateId: alternateIds[0], userId: userIds[0], queryText: marker,
      queryEmbedding: [], includePrivate: false, types: [MemoryType.FACT], minScore: 0,
    });
    expect(result.memories.map(m => m.id)).toEqual([active.id]);
  });

  it('inserts a vector with an ID, upserts without duplication and isolates tenants', async () => {
    const own = await create(0, 'Vector owner');
    const other = await create(1, 'Vector other tenant');
    for (const m of [own, other]) {
      await upsertMemoryEmbedding(m.id, m.alternateId, m.userId, vector);
    }
    await upsertMemoryEmbedding(own.id, own.alternateId, own.userId, vector);
    expect(await prisma.memoryEmbedding.count({ where: { memoryId: own.id } })).toBe(1);
    const results = await retrieveByVector(alternateIds[0], userIds[0], vector, { minScore: 0.99 });
    expect(results.map(m => m.id)).toEqual([own.id]);
    expect(await retrieveByVector(alternateIds[0], userIds[1], vector, { minScore: 0 })).toEqual([]);
    await expect(memoryService.deleteMemory(own.id, alternateIds[1], userIds[1])).rejects.toThrow();
    expect(await memoryEmbeddingExists(own.id)).toBe(true);
    await memoryService.deleteMemory(own.id, alternateIds[0], userIds[0]);
    expect(await memoryEmbeddingExists(own.id)).toBe(false);
    expect(await retrieveByVector(alternateIds[0], userIds[0], vector, { minScore: 0 })).toEqual([]);
    // A delayed job must not resurrect a deleted memory's embedding.
    await upsertMemoryEmbedding(own.id, own.alternateId, own.userId, vector);
    expect(await memoryEmbeddingExists(own.id)).toBe(false);
  });
});

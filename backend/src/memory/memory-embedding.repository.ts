/**
 * Memory Embedding Repository
 *
 * Manages vector embeddings for memories. Tenant-scoped via alternateId + userId.
 *
 * The vector column is a pgvector type, so it CANNOT be written through Prisma's
 * typed client. All vector writes use parameterized raw SQL.
 */

import { randomUUID } from 'crypto';
import { prisma } from '@/database';

export interface MemoryEmbedRow {
  id: string;
  memoryId: string;
  alternateId: string;
  userId: string;
  model: string;
  dimensions: number;
  createdAt: Date;
  updatedAt: Date;
}

/** Store or update a memory embedding (upsert on unique memoryId). */
export async function upsertMemoryEmbedding(
  memoryId: string,
  alternateId: string,
  userId: string,
  embedding: number[],
  model: string = 'text-embedding-3-small',
): Promise<MemoryEmbedRow | null> {
  // Validate all values are finite numbers to prevent injection
  const safeValues = embedding.map((v) => {
    const num = Number(v);
    if (!Number.isFinite(num)) throw new Error('Invalid embedding value: non-finite number');
    return num;
  });
  const vectorLiteral = `[${safeValues.join(',')}]`;
  const safeModel = model.replace(/'/g, '');

  // Only allow embedding for ACTIVE memories
  const memCheck = await prisma.memory.findUnique({ where: { id: memoryId, alternateId, userId, status: { in: ['ACTIVE', 'SUPERSEDED'] } }, select: { id: true } });
  if (!memCheck) return null;

  type ResultRow = {
    id: string;
    memoryId: string;
    alternateId: string;
    userId: string;
    model: string;
    dimensions: number;
    createdAt: Date;
    updatedAt: Date;
  };

  const inserted = await prisma.$queryRawUnsafe<ResultRow[]>(`
    INSERT INTO "memory_embeddings" ("id", "memoryId", "alternateId", "userId", "vector", "model", "dimensions", "createdAt", "updatedAt")
     VALUES ('${randomUUID()}'::uuid, '${memoryId}'::uuid, '${alternateId}'::uuid, '${userId}'::uuid, '${vectorLiteral}'::vector, '${safeModel}', ${embedding.length}, NOW(), NOW())
     ON CONFLICT ("memoryId")
     DO UPDATE SET
       "vector" = '${vectorLiteral}'::vector,
       "model" = '${safeModel}',
       "dimensions" = ${embedding.length},
       "updatedAt" = NOW()
     RETURNING "id", "memoryId", "alternateId", "userId", "model", "dimensions", "createdAt", "updatedAt"`);

  return inserted[0] ?? null;
}

/** Delete a memory embedding. */
export async function deleteMemoryEmbedding(memoryId: string): Promise<void> {
  await prisma.memoryEmbedding.deleteMany({ where: { memoryId } });
}

/** Check whether a memory embedding exists. */
export async function memoryEmbeddingExists(memoryId: string): Promise<boolean> {
  const count = await prisma.memoryEmbedding.count({ where: { memoryId } });
  return count > 0;
}

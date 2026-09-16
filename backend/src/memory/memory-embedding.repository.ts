/**
 * Memory Embedding Repository
 *
 * Manages vector embeddings for memories. Tenant-scoped via alternateId + userId.
 *
 * The `vector` column is a pgvector `Unsupported("vector(1536)")` field, so it
 * CANNOT be written through Prisma's typed client. All vector writes use
 * parameterized raw SQL (same pattern as RAG's knowledge-chunk repository).
 */

import { prisma } from '@/database';

/** Store or update a memory embedding (upsert on unique memoryId). */
export async function upsertMemoryEmbedding(
  memoryId: string,
  alternateId: string,
  userId: string,
  embedding: number[],
  model: string = 'text-embedding-3-small',
): Promise<void> {
  // pgvector accepts '[1,2,3]' text with an explicit ::vector cast
  const vectorStr = `[${embedding.map((v) => Number(v)).join(',')}]`;

  await prisma.$executeRawUnsafe(
    `INSERT INTO "memory_embeddings" ("memoryId", "alternateId", "userId", "vector", "model", "dimensions", "createdAt", "updatedAt")
     VALUES ($1::uuid, $2::uuid, $3::uuid, $4::vector, $5, $6, NOW(), NOW())
     ON CONFLICT ("memoryId")
     DO UPDATE SET
       "vector" = $4::vector,
       "model" = $5,
       "dimensions" = $6,
       "updatedAt" = NOW()`,
    memoryId,
    alternateId,
    userId,
    vectorStr,
    model,
    embedding.length,
  );
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

/**
 * Memory Repository — Vector retrieval functions
 *
 * Uses $queryRawUnsafe with parameterized queries (matching the pattern
 * in rag/vector.repository.ts). Tenant filtering happens at the SQL level.
 */

import { prisma } from '@/database';
import { logger } from '@/utils/logger';
import {
  MemoryType,
  Memory,
} from './memory.types';
import { toMemory } from './memory.repository';
import { MEMORY_DEFAULTS } from './memory.constants';

/**
 * Retrieve memories by vector similarity — tenant-scoped at SQL level.
 */
export async function retrieveByVector(
  alternateId: string,
  userId: string,
  queryEmbedding: number[],
  params: {
    limit?: number;
    minScore?: number;
    includePrivate?: boolean;
    types?: MemoryType[];
  },
): Promise<Array<Memory & { similarity: number }>> {
  const limit = params.limit ?? MEMORY_DEFAULTS.TOP_K;
  const minScore = params.minScore ?? MEMORY_DEFAULTS.MIN_SCORE;

  const queryParams: unknown[] = [queryEmbedding, alternateId, userId, minScore];
  let paramIndex = 5;

  const visibilityClause = params.includePrivate
    ? ''
    : `AND m.visibility = 'ALTERNATE'`;

  let typesClause = '';
  if (params.types && params.types.length > 0) {
    typesClause = `AND m.type = ANY($${paramIndex++}::text[])`;
    queryParams.push(params.types);
  }

  queryParams.push(limit);

  const query = `
    SELECT
      m.id, m."alternateId", m."userId", m.type, m.content,
      m."normalizedContent", m.importance, m.confidence, m."sourceType",
      m."sourceConversationId", m."sourceMessageId", m.status, m.visibility,
      m."isExtracted", m."expiresAt", m."lastAccessedAt", m."lastReinforcedAt",
      m."reinforcementCount", m."supersededById", m."createdAt", m."updatedAt",
      1 - (me.vector <=> $1::vector) AS similarity
    FROM "memories" m
    JOIN "memory_embeddings" me ON me."memoryId" = m.id
    WHERE m."alternateId" = $2::uuid
      AND m."userId" = $3::uuid
      AND m.status = 'ACTIVE'
      AND (m."expiresAt" IS NULL OR m."expiresAt" > NOW())
      ${visibilityClause}
      ${typesClause}
      AND me.vector IS NOT NULL
      AND (1 - (me.vector <=> $1::vector)) >= $4
    ORDER BY similarity DESC, m.importance DESC
    LIMIT $${paramIndex}
  `;

  try {
    const results = await prisma.$queryRawUnsafe<Array<{
      id: string;
      alternateId: string;
      userId: string;
      type: string;
      content: string;
      normalizedContent: string;
      importance: number;
      confidence: number;
      sourceType: string;
      sourceConversationId: string | null;
      sourceMessageId: string | null;
      status: string;
      visibility: string;
      isExtracted: boolean;
      expiresAt: Date | null;
      lastAccessedAt: Date;
      lastReinforcedAt: Date;
      reinforcementCount: number;
      supersededById: string | null;
      createdAt: Date;
      updatedAt: Date;
      similarity: number;
    }>>(query, ...queryParams);

    return results.map((r) => ({ ...toMemory(r as any), similarity: Number(r.similarity) }));
  } catch (error) {
    logger.error({ error, alternateId, userId }, 'Memory vector search failed');
    return [];
  }
}

/**
 * Find semantic duplicates — tenant-scoped vector similarity check.
 */
export async function findSemanticDuplicates(
  alternateId: string,
  userId: string,
  embedding: number[],
  threshold: number = MEMORY_DEFAULTS.MAX_SIMILARITY_THRESHOLD,
  limit: number = 20,
): Promise<Memory[]> {
  const query = `
    SELECT
      m.id, m."alternateId", m."userId", m.type, m.content,
      m."normalizedContent", m.importance, m.confidence, m."sourceType",
      m."sourceConversationId", m."sourceMessageId", m.status, m.visibility,
      m."isExtracted", m."expiresAt", m."lastAccessedAt", m."lastReinforcedAt",
      m."reinforcementCount", m."supersededById", m."createdAt", m."updatedAt",
      1 - (me.vector <=> $1::vector) AS similarity
    FROM "memories" m
    JOIN "memory_embeddings" me ON me."memoryId" = m.id
    WHERE m."alternateId" = $2::uuid
      AND m."userId" = $3::uuid
      AND m.status = 'ACTIVE'
      AND me.vector IS NOT NULL
    ORDER BY similarity DESC
    LIMIT $4
  `;

  try {
    const results = await prisma.$queryRawUnsafe<Array<{
      id: string;
      alternateId: string;
      userId: string;
      type: string;
      content: string;
      normalizedContent: string;
      importance: number;
      confidence: number;
      sourceType: string;
      sourceConversationId: string | null;
      sourceMessageId: string | null;
      status: string;
      visibility: string;
      isExtracted: boolean;
      expiresAt: Date | null;
      lastAccessedAt: Date;
      lastReinforcedAt: Date;
      reinforcementCount: number;
      supersededById: string | null;
      createdAt: Date;
      updatedAt: Date;
      similarity: number;
    }>>(query, embedding, alternateId, userId, limit);

    return results
      .filter((r) => Number(r.similarity) > threshold)
      .map((m) => toMemory(m as any));
  } catch (error) {
    logger.error({ error, alternateId, userId }, 'Memory semantic duplicate search failed');
    return [];
  }
}

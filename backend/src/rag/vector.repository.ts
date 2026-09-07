/**
 * VectorRepository — PostgreSQL + pgvector search with multi-tenant filtering.
 * 
 * CRITICAL: Every retrieval operation MUST be scoped to:
 * - authenticated user
 * - specific Alternate
 * - current knowledge version
 * - active source/document/chunk
 * 
 * This repository enforces isolation at the database level.
 * Never allow User A to retrieve User B's knowledge.
 */

import { prisma } from '@/database';
import { logger } from '@/utils/logger';
import type { VectorSearchParams, RetrievedChunk } from './types';

export class VectorRepository {
  /**
   * Perform vector similarity search with multi-tenant filtering.
   * Uses cosine similarity for pgvector.
   */
  async searchSimilar(params: VectorSearchParams): Promise<RetrievedChunk[]> {
    const {
      alternateId,
      userId,
      queryEmbedding,
      topK,
      minSimilarity,
      knowledgeVersion,
      sourceId,
      documentId,
      sourceType,
      language,
    } = params;

    const vectorStr = `[${queryEmbedding.join(',')}]`;

    // Build WHERE conditions with parameterized queries for security
    const conditions: string[] = [
      'e."alternateId" = $1::uuid',
      'e."userId" = $2::uuid',
      'dc."isActive" = true',
      'ts."status" != \'DELETED\'',
      'kd."status" != \'DELETED\'',
    ];

    const queryParams: unknown[] = [alternateId, userId];
    let paramIndex = 3;

    if (knowledgeVersion !== undefined) {
      conditions.push(`e."version" = $${paramIndex}::int`);
      queryParams.push(knowledgeVersion);
      paramIndex++;
    }

    if (sourceId) {
      conditions.push(`e."sourceId" = $${paramIndex}::uuid`);
      queryParams.push(sourceId);
      paramIndex++;
    }

    if (documentId) {
      conditions.push(`e."documentId" = $${paramIndex}::uuid`);
      queryParams.push(documentId);
      paramIndex++;
    }

    if (sourceType) {
      conditions.push(`ts."type" = $${paramIndex}`);
      queryParams.push(sourceType);
      paramIndex++;
    }

    if (language) {
      conditions.push(`kd."language" = $${paramIndex}`);
      queryParams.push(language);
      paramIndex++;
    }

    conditions.push(`(1 - (e.vector <=> $${paramIndex}::vector)) >= $${paramIndex + 1}`);
    queryParams.push(vectorStr, minSimilarity);
    paramIndex += 2;
    queryParams.push(topK);

    const whereClause = conditions.join(' AND ');

    const query = `
      SELECT 
        dc."id",
        dc."content",
        dc."chunkIndex",
        dc."documentId",
        dc."sourceId",
        dc."alternateId",
        dc."version",
        dc."heading",
        dc."metadata",
        kd."title" as "documentTitle",
        ts."url" as "sourceUrl",
        ts."name" as "sourceName",
        (1 - (e.vector <=> $${paramIndex}::vector)) as similarity
      FROM "embeddings" e
      INNER JOIN "document_chunks" dc ON e."chunkId" = dc."id"
      INNER JOIN "knowledge_documents" kd ON e."documentId" = kd."id"
      INNER JOIN "training_sources" ts ON e."sourceId" = ts."id"
      WHERE ${whereClause}
      ORDER BY e.vector <=> $${paramIndex}::vector ASC
      LIMIT $${paramIndex + 1}
    `;

    try {
      const results = await prisma.$queryRawUnsafe<Array<{
        id: string;
        content: string;
        chunkIndex: number;
        documentId: string;
        sourceId: string;
        alternateId: string;
        version: number;
        heading: string | null;
        metadata: unknown;
        documentTitle: string;
        sourceUrl: string | null;
        sourceName: string;
        similarity: number;
      }>>(query, ...queryParams);

      return results.map((row) => ({
        id: row.id,
        content: row.content,
        chunkIndex: row.chunkIndex,
        documentId: row.documentId,
        sourceId: row.sourceId,
        alternateId: row.alternateId,
        version: row.version,
        heading: row.heading,
        metadata: row.metadata as Record<string, unknown> | null,
        similarity: Number(row.similarity),
      }));
    } catch (error) {
      logger.error({ error, alternateId, userId }, 'Vector search failed');
      return [];
    }
  }

  /**
   * Get the current active knowledge version for an alternate.
   */
  async getActiveKnowledgeVersion(alternateId: string): Promise<number | null> {
    const version = await prisma.knowledgeVersion.findFirst({
      where: {
        alternateId,
        status: 'ACTIVE',
      },
      select: { version: true },
      orderBy: { version: 'desc' },
    });

    return version?.version ?? null;
  }

  /**
   * Check if pgvector extension is available.
   */
  async isPgVectorAvailable(): Promise<boolean> {
    try {
      await prisma.$executeRawUnsafe(
        `SELECT 1 FROM pg_extension WHERE extname = 'vector'`
      );
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Count total embeddings for an alternate.
   */
  async countEmbeddings(alternateId: string): Promise<number> {
    const result = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      `SELECT COUNT(*)::bigint as count FROM "embeddings" WHERE "alternateId" = $1::uuid`,
      alternateId
    );
    return Number(result[0]?.count ?? 0);
  }
}

export const vectorRepository = new VectorRepository();

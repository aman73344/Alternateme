import { prisma } from '@/database';
import { logger } from '@/utils/logger';
import type { Prisma } from '@prisma/client';
import { assertUuid, safeFloat } from './knowledge.repository';

export interface ChunkRowInput {
  userId: string;
  alternateId: string;
  sourceId: string;
  documentId: string;
  version: number;
  chunkIndex: number;
  content: string;
  tokenCount: number;
  characterCount: number;
  heading?: string;
  metadata?: Record<string, unknown>;
}

export interface EmbeddingRowInput {
  id: string;
  userId: string;
  alternateId: string;
  sourceId: string;
  documentId: string;
  chunkId: string;
  version: number;
  model: string;
  dimensions: number;
  tokenCount?: number;
  vector: number[];
}

/** Persistence for DocumentChunk + Embedding (pgvector) rows. */
export class KnowledgeChunkRepository {
  async createChunks(rows: ChunkRowInput[]): Promise<void> {
    if (rows.length === 0) return;
    await prisma.documentChunk.createMany({
      data: rows.map((r) => ({
        userId: r.userId,
        alternateId: r.alternateId,
        sourceId: r.sourceId,
        documentId: r.documentId,
        version: r.version,
        chunkIndex: r.chunkIndex,
        content: r.content,
        tokenCount: r.tokenCount,
        characterCount: r.characterCount,
        heading: r.heading ?? null,
        metadata: (r.metadata ?? undefined) as any,
      })),
    });
  }

  async countChunks(where: {
    alternateId?: string;
    sourceId?: string;
    documentId?: string;
    version?: number;
    isActive?: boolean;
  }): Promise<number> {
    return prisma.documentChunk.count({ where: where as Prisma.DocumentChunkWhereInput });
  }

  async getChunkIdsForDocument(documentId: string, version: number): Promise<Array<{ id: string; chunkIndex: number }>> {
    return prisma.documentChunk.findMany({
      where: { documentId, version },
      select: { id: true, chunkIndex: true },
      orderBy: { chunkIndex: 'asc' },
    });
  }

  async getChunksForDocument(documentId: string, version: number): Promise<Array<{ id: string; content: string; chunkIndex: number }>> {
    return prisma.documentChunk.findMany({
      where: { documentId, version },
      select: { id: true, content: true, chunkIndex: true },
      orderBy: { chunkIndex: 'asc' },
    });
  }

  async insertEmbeddings(rows: EmbeddingRowInput[]): Promise<void> {
    if (rows.length === 0) return;
    const values = rows
      .map((r) => {
        const id = assertUuid(r.id, 'embedding.id');
        const userId = assertUuid(r.userId, 'embedding.userId');
        const alternateId = assertUuid(r.alternateId, 'embedding.alternateId');
        const sourceId = assertUuid(r.sourceId, 'embedding.sourceId');
        const documentId = assertUuid(r.documentId, 'embedding.documentId');
        const chunkId = assertUuid(r.chunkId, 'embedding.chunkId');
        const vector = r.vector.map(safeFloat).join(',');
        return `('${id}','${userId}','${alternateId}','${sourceId}','${documentId}','${chunkId}',${r.version},'${String(r.model).replace(/'/g, '')}',${r.dimensions},${
          r.tokenCount ?? 'NULL'
        },'[${vector}]'::vector,NOW())`;
      })
      .join(',');
    await prisma.$executeRawUnsafe(
      `INSERT INTO embeddings ("id","userId","alternateId","sourceId","documentId","chunkId","version","model","modelDimensions","tokenCount","vector","createdAt") VALUES ${values}`,
    );
  }

  async countEmbeddings(where: { alternateId?: string; sourceId?: string }): Promise<number> {
    if (!where.alternateId && !where.sourceId) return 0;
    const clause = where.sourceId ? '"sourceId" = $1::uuid' : '"alternateId" = $1::uuid';
    try {
      const [row] = await prisma.$queryRawUnsafe<Array<{ total: number }>>(
        `SELECT COUNT(*)::int AS total FROM embeddings WHERE ${clause}`,
        where.sourceId ?? where.alternateId,
      );
      return Number(row?.total ?? 0);
    } catch (err) {
      logger.warn({ err }, 'countEmbeddings failed');
      return 0;
    }
  }

  /** Whether the pgvector extension + embeddings table are usable. */
  async isPgvectorReady(): Promise<boolean> {
    try {
      await prisma.$executeRawUnsafe('SELECT 1 FROM pg_extension WHERE extname = \'vector\'');
      return true;
    } catch {
      return false;
    }
  }
}

export const knowledgeChunkRepository = new KnowledgeChunkRepository();
import { prisma } from '@/database';

export interface VersionInput {
  userId: string;
  alternateId: string;
  sourceId: string;
  documentId: string;
  version: number;
  chunkCount: number;
  checksum: string;
}

/**
 * KnowledgeVersioningRepository — the version chain for a source.
 * Only the ACTIVE version is retrieval-eligible at any time; older versions
 * are SUPERSEDED (kept for rollback/debugging) and never used by retrieval.
 */
export class KnowledgeVersioningRepository {
  async createVersion(input: VersionInput) {
    return prisma.knowledgeVersion.create({
      data: {
        userId: input.userId,
        alternateId: input.alternateId,
        sourceId: input.sourceId,
        documentId: input.documentId,
        version: input.version,
        status: 'PENDING',
        chunkCount: input.chunkCount,
        checksum: input.checksum,
      },
    });
  }

  async activateVersion(sourceId: string, version: number): Promise<void> {
    await prisma.$transaction([
      prisma.knowledgeVersion.updateMany({
        where: { sourceId, status: 'ACTIVE' },
        data: { status: 'SUPERSEDED', supersededAt: new Date() },
      }),
      prisma.knowledgeVersion.updateMany({
        where: { sourceId, version, status: 'PENDING' },
        data: { status: 'ACTIVE' },
      }),
    ]);
  }

  async failVersion(sourceId: string, version: number): Promise<void> {
    await prisma.knowledgeVersion.updateMany({
      where: { sourceId, version, status: 'PENDING' },
      data: { status: 'FAILED' },
    });
  }

  async getActiveVersion(sourceId: string) {
    return prisma.knowledgeVersion.findFirst({
      where: { sourceId, status: 'ACTIVE' },
      orderBy: { version: 'desc' },
    });
  }

  async getCurrentVersion(sourceId: string) {
    return prisma.knowledgeVersion.findFirst({
      where: { sourceId },
      orderBy: { version: 'desc' },
      include: { document: true },
    });
  }

  /** Exclude a source's whole knowledge tree from retrieval eligibility. */
  async softDeleteKnowledge(sourceId: string): Promise<void> {
    await prisma.$transaction([
      prisma.documentChunk.updateMany({
        where: { sourceId, isActive: true },
        data: { isActive: false },
      }),
      prisma.knowledgeVersion.updateMany({
        where: { sourceId, status: 'ACTIVE' },
        data: { status: 'SUPERSEDED', supersededAt: new Date() },
      }),
      prisma.knowledgeDocument.updateMany({
        where: { sourceId, status: { in: ['PENDING', 'PROCESSING', 'READY'] } },
        data: { status: 'DELETED' },
      }),
    ]);
  }

  /**
   * Phase 4 readiness: the retrieval-eligible chunks of an alternate/source.
   * Only rows whose document belongs to the ACTIVE knowledge version and that
   * are still marked active are eligible — deleted/inactive knowledge is
   * always excluded here, not in the (future) RAG layer.
   */
  async getRetrievalEligibleChunkRows(where: {
    alternateId?: string;
    sourceId?: string;
  }): Promise<
    Array<{
      id: string;
      alternateId: string;
      sourceId: string;
      documentId: string;
      version: number;
      chunkIndex: number;
      content: string;
    }>
  > {
    const chunks = await prisma.documentChunk.findMany({
      where: {
        ...(where.alternateId ? { alternateId: where.alternateId } : {}),
        ...(where.sourceId ? { sourceId: where.sourceId } : {}),
        isActive: true,
        document: { knowledgeVersion: { status: 'ACTIVE' } },
      },
      select: {
        id: true,
        alternateId: true,
        sourceId: true,
        documentId: true,
        version: true,
        chunkIndex: true,
        content: true,
      },
      orderBy: [{ chunkIndex: 'asc' }],
      take: 1000,
    });
    return chunks;
  }

  async countChunksByAlternate(alternateId: string): Promise<number> {
    return prisma.documentChunk.count({ where: { alternateId, isActive: true } });
  }
}

export const knowledgeVersioningRepository = new KnowledgeVersioningRepository();
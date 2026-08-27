import { prisma } from '@/database';
import { KnowledgeError } from './knowledge.errors';
import { knowledgeVersioningRepository } from './knowledge-versioning.repository';

export interface AlternateKnowledgeStatus {
  totalSources: number;
  readySources: number;
  processingSources: number;
  failedSources: number;
  totalDocuments: number;
  totalChunks: number;
  lastProcessedAt: string | null;
}

/**
 * KnowledgeStatusService — aggregates how much of an alternate's knowledge is
 * processed/ready. Never exposes internal infrastructure details or content.
 */
export class KnowledgeStatusService {
  async getStatus(alternateId: string, userId: string): Promise<AlternateKnowledgeStatus> {
    const alternate = await prisma.alternate.findFirst({
      where: { id: alternateId, userId, deletedAt: null },
      select: { id: true },
    });
    if (!alternate) throw new KnowledgeError('SOURCE_NOT_FOUND', { alternateId }, 'Alternate not found');

    const groups = await prisma.trainingSource.groupBy({
      by: ['status'],
      where: { alternateId },
      _count: { _all: true },
    });
    const statusCount: Record<string, number> = {};
    for (const g of groups) statusCount[g.status] = g._count._all;

    const readySources = statusCount.READY || 0;
    const processingSources =
      (statusCount.PENDING || 0) + (statusCount.PROCESSING || 0);

    const [totalDocuments, totalChunks] = await Promise.all([
      prisma.knowledgeDocument.count({
        where: { alternateId, status: { in: ['READY', 'PROCESSING', 'PENDING'] } },
      }),
      prisma.documentChunk.count({ where: { alternateId, isActive: true } }),
    ]);

    const lastSource = await prisma.trainingSource.findFirst({
      where: { alternateId, lastProcessedAt: { not: null } },
      orderBy: { lastProcessedAt: 'desc' },
      select: { lastProcessedAt: true },
    });

    return {
      totalSources: Object.values(statusCount).reduce((a, b) => a + b, 0),
      readySources,
      processingSources,
      failedSources: statusCount.FAILED || 0,
      totalDocuments,
      totalChunks,
      lastProcessedAt: lastSource?.lastProcessedAt?.toISOString() ?? null,
    };
  }

  // Phase 4 retrieval surface (counts only; no vectors yet).
  retrievalEligible(alternateId: string, sourceId?: string) {
    return knowledgeVersioningRepository.getRetrievalEligibleChunkRows({
      alternateId,
      sourceId,
    });
  }
}

export const knowledgeStatusService = new KnowledgeStatusService();
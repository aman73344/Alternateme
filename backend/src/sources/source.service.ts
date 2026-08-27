import { prisma } from '@/database';
import { createAuditLog } from '@/auth/repositories/audit.repository';
import { NotFoundError } from '@/utils/errors';
import { logger } from '@/utils/logger';
import { knowledgeIngestionQueue, knowledgeCleanupQueue } from '@/queues';
import { knowledgeRepository } from '@/knowledge/knowledge.repository';
import { knowledgeSourceRepository } from '@/knowledge/knowledge-source.repository';
import { knowledgeCleanupService } from '@/knowledge/knowledge-cleanup.service';
import { knowledgeStatusService } from '@/knowledge/knowledge-status.service';
import { storageProvider } from '@/storage';
import { validateUploadedFile } from '@/knowledge/file-validator';
import type { IngestionJobData } from '@/knowledge/knowledge.types';

export const sourceService = {
  /**
   * Create a TrainingSource (PENDING), persist an IngestionJob and enqueue it.
   * Heavy processing never happens here — the API returns PENDING immediately
   * and the worker does the rest asynchronously.
   */
  async createSource(userId: string, data: any) {
    const alternate = await prisma.alternate.findFirst({
      where: { id: data.alternateId, userId, deletedAt: null },
    });
    if (!alternate) {
      throw new NotFoundError('Alternate not found');
    }

    const storageInfo = data.type === 'FILE' ? await this.handleFileUpload(data) : {};

    const source = await prisma.trainingSource.create({
      data: {
        alternateId: data.alternateId,
        userId,
        type: data.type,
        name: data.name,
        url: data.url,
        fileName: data.fileName,
        mimeType: storageInfo.mimeType || data.mimeType,
        fileSize: storageInfo.fileSize || data.fileSize,
        origin: data.origin || 'MANUAL',
        status: 'PENDING',
        storageKey: storageInfo.storageKey,
        storageUrl: storageInfo.storageUrl,
        checksum: storageInfo.checksum,
      },
    });

    await createAuditLog({
      userId,
      action: 'SOURCE_ADDED',
      entity: 'TrainingSource',
      entityId: source.id,
      newValue: { name: source.name, type: source.type },
    });

    logger.info({ userId, alternateId: data.alternateId, sourceId: source.id }, 'Source created');

    const job = await knowledgeRepository.createJob({
      userId,
      alternateId: data.alternateId,
      sourceId: source.id,
      type: 'INGEST',
    });
    await this.enqueueIngestion({
      jobId: job.id,
      userId,
      alternateId: data.alternateId,
      sourceId: source.id,
    });

    return { ...source, jobId: job.id };
  },

  async getSources(alternateId: string, userId: string) {
    const alternate = await prisma.alternate.findFirst({
      where: { id: alternateId, userId, deletedAt: null },
    });
    if (!alternate) {
      throw new NotFoundError('Alternate not found');
    }
    return prisma.trainingSource.findMany({
      where: { alternateId, status: { not: 'DELETED' } },
      orderBy: { createdAt: 'desc' },
    });
  },

  /**
   * GET /alternates/:alternateId/sources/:sourceId — detailed status including
   * progress, latest error, chunk/doc counts and last-processed time. Never
   * exposes internal infrastructure details or private storage URLs.
   */
  async getSourceStatus(alternateId: string, sourceId: string, userId: string) {
    const source = await prisma.trainingSource.findFirst({
      where: { id: sourceId, alternateId, userId, status: { not: 'DELETED' } },
    });
    if (!source) throw new NotFoundError('Source not found');

    const latestJob = await prisma.ingestionJob.findFirst({
      where: { sourceId },
      orderBy: { createdAt: 'desc' },
      select: { progress: true, stage: true, status: true, errorCode: true, errorMessage: true, isRetryable: true },
    });

    const [documentCount, chunkCount] = await Promise.all([
      prisma.knowledgeDocument.count({ where: { sourceId } }),
      prisma.documentChunk.count({ where: { sourceId, isActive: true } }),
    ]);

    return {
      id: source.id,
      name: source.name,
      type: source.type,
      url: source.url,
      status: source.status,
      processingStage: source.processingStage,
      progress: latestJob?.progress ?? 0,
      jobStatus: latestJob?.status ?? null,
      error: latestJob?.errorCode
        ? { code: latestJob.errorCode, message: latestJob.errorMessage }
        : null,
      isRetryable: latestJob?.isRetryable ?? false,
      documentCount,
      chunkCount,
      version: source.currentVersion,
      lastProcessedAt: source.lastProcessedAt?.toISOString() ?? null,
      createdAt: source.createdAt.toISOString(),
    };
  },

  /**
   * POST /alternates/:alternateId/sources/:sourceId/reprocess — create a new
   * processing job/version without duplicating data (idempotency checksum still
   * applies unless force=true).
   */
  async reprocessSource(alternateId: string, sourceId: string, userId: string, opts: { force?: boolean } = {}) {
    const source = await prisma.trainingSource.findFirst({
      where: { id: sourceId, alternateId, userId, status: { not: 'DELETED' } },
    });
    if (!source) throw new NotFoundError('Source not found');

    const job = await knowledgeRepository.createJob({
      userId,
      alternateId,
      sourceId,
      version: (source.currentVersion || 0) + 1,
      type: 'REPROCESS',
      payload: { force: opts.force },
    });

    await this.enqueueIngestion({
      jobId: job.id,
      userId,
      alternateId,
      sourceId,
      version: job.version,
      force: opts.force,
    });

    logger.info({ userId, sourceId, jobId: job.id, force: opts.force }, 'Source reprocess queued');
    return { jobId: job.id, status: 'QUEUED', version: job.version };
  },

  /**
   * DELETE /alternates/:alternateId/sources/:sourceId — two-phase deletion:
   * mark DELETED + soft-delete knowledge synchronously, then enqueue the async
   * cleanup worker to physically purge vectors/chunks later.
   */
  async deleteSource(alternateId: string, sourceId: string, userId: string) {
    const source = await prisma.trainingSource.findFirst({
      where: { id: sourceId, alternateId, userId, status: { not: 'DELETED' } },
    });
    if (!source) throw new NotFoundError('Source not found');

    await knowledgeCleanupService.softDeleteSourceKnowledge(sourceId);
    await knowledgeSourceRepository.markSourceDeleted(sourceId);

    await createAuditLog({
      userId,
      action: 'SOURCE_DELETED',
      entity: 'TrainingSource',
      entityId: sourceId,
      oldValue: { name: source.name },
    });

    const q = knowledgeCleanupQueue();
    if (q) {
      await q.add('cleanup', { sourceId, userId, alternateId });
    } else {
      logger.warn({ sourceId }, 'Redis unavailable; knowledge purge deferred');
    }

    if (source.storageKey) {
      try {
        await storageProvider.delete(source.storageKey);
      } catch (err) {
        logger.warn({ sourceId, err }, 'Could not delete stored object (best-effort)');
      }
    }
  },

  /** Knowledge status aggregate for an alternate. */
  async getKnowledgeStatus(alternateId: string, userId: string) {
    return knowledgeStatusService.getStatus(alternateId, userId);
  },

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  async enqueueIngestion(data: IngestionJobData): Promise<void> {
    const q = knowledgeIngestionQueue();
    if (!q) {
      logger.warn({ sourceId: data.sourceId }, 'Redis not available; ingestion job queued in DB only');
      return;
    }
    await q.add('ingest', data, { attempts: 3, backoff: { type: 'exponential', delay: 2000 } });
  },

  /**
   * For FILE sources, store the uploaded bytes in object storage and record
   * the reference. Accepts either a pre-uploaded storageKey or base64 content.
   */
  async handleFileUpload(data: any) {
    if (data.storageKey) {
      return {
        storageKey: data.storageKey,
        storageUrl: data.storageUrl,
        checksum: data.checksum,
        mimeType: data.mimeType,
        fileSize: data.fileSize,
      };
    }
    if (!data.fileContent) return {};
    const buffer = Buffer.from(data.fileContent, 'base64');
    const validation = validateUploadedFile(buffer, data.fileName, data.mimeType);
    const uploaded = await storageProvider.upload(
      buffer,
      data.fileName || `source-${data.alternateId}`,
      validation.mimeType,
    );
    return {
      storageKey: uploaded.key,
      storageUrl: uploaded.url,
      checksum: validation.checksum,
      mimeType: validation.mimeType,
      fileSize: validation.size,
    };
  },
};
import { prisma } from '@/database';
import { KnowledgeError } from './knowledge.errors';

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function assertUuid(value: string, field: string): string {
  if (!UUID_RE.test(value)) throw new Error(`Invalid internal identifier for ${field}`);
  return value;
}

export function safeFloat(v: number): string {
  if (!Number.isFinite(v)) return '0';
  return String(v);
}

/**
 * KnowledgeRepository — the DB layer for the ingestion pipeline.
 * Every query is tenant-scoped (userId/alternateId) so knowledge cannot leak
 * across users. Controllers never touch these tables directly.
 */
export class KnowledgeRepository {
  // ------------------------------------------------------------------- jobs
  async createJob(input: {
    userId: string;
    alternateId: string;
    sourceId: string;
    version?: number;
    type?: string;
    maxAttempts?: number;
    payload?: Record<string, unknown>;
  }) {
    return prisma.ingestionJob.create({
      data: {
        userId: input.userId,
        alternateId: input.alternateId,
        sourceId: input.sourceId,
        version: input.version ?? 0,
        type: input.type ?? 'INGEST',
        status: 'QUEUED',
        maxAttempts: input.maxAttempts ?? 3,
        payload: (input.payload ?? undefined) as any,
      },
    });
  }

  async getJob(jobId: string) {
    const job = await prisma.ingestionJob.findUnique({
      where: { id: jobId },
      include: { source: true },
    });
    if (!job) throw new KnowledgeError('SOURCE_NOT_FOUND', { jobId }, 'Ingestion job not found');
    return job;
  }

  async updateJob(
    jobId: string,
    data: {
      status?: string;
      stage?: string | null;
      progress?: number;
      attempts?: number;
      startedAt?: Date | null;
      completedAt?: Date | null;
      failedAt?: Date | null;
      errorCode?: string | null;
      errorMessage?: string | null;
      result?: Record<string, unknown> | null;
      isRetryable?: boolean;
      documentId?: string | null;
    },
  ): Promise<void> {
    await prisma.ingestionJob.update({
      where: { id: jobId },
      data: {
        status: data.status as any,
        stage: data.stage,
        progress: data.progress,
        attempts: data.attempts,
        startedAt: data.startedAt,
        completedAt: data.completedAt,
        failedAt: data.failedAt,
        errorCode: data.errorCode,
        errorMessage: data.errorMessage,
        result: data.result as any,
        isRetryable: data.isRetryable,
        documentId: data.documentId,
      },
    });
  }

  async markJobStarted(jobId: string): Promise<void> {
    await this.updateJob(jobId, { status: 'PROCESSING', startedAt: new Date() });
  }

  async markJobStage(jobId: string, status: string, stage: string, progress: number): Promise<void> {
    await this.updateJob(jobId, { status, stage, progress });
  }

  async markJobFailed(
    jobId: string,
    errorCode: string,
    errorMessage: string,
    isRetryable: boolean,
    attempts: number,
  ): Promise<void> {
    await this.updateJob(jobId, {
      status: 'FAILED',
      failedAt: new Date(),
      errorCode,
      errorMessage,
      isRetryable,
      attempts,
    });
  }

  async markJobCompleted(jobId: string, result: Record<string, unknown>): Promise<void> {
    await this.updateJob(jobId, { status: 'COMPLETED', completedAt: new Date(), result });
  }
}

export const knowledgeRepository = new KnowledgeRepository();
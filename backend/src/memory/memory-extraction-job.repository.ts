/**
 * Memory Extraction Job Repository
 *
 * Manages the lifecycle of extraction jobs for idempotency and retry tracking.
 */

import { prisma } from '@/database';

export interface ExtractionJobResult {
  created: number;
  updated: number;
  skipped: number;
}

/** Create a new extraction job record. */
export async function createExtractionJob(data: {
  alternateId: string;
  userId: string;
  messageId: string;
  conversationId: string;
  status: string;
}) {
  return prisma.memoryExtractionJob.create({
    data: {
      alternateId: data.alternateId,
      userId: data.userId,
      messageId: data.messageId,
      conversationId: data.conversationId,
      status: data.status,
    },
  });
}

/** Mark a job as processing. */
export async function markExtractionJobProcessing(jobId: string) {
  return prisma.memoryExtractionJob.update({
    where: { id: jobId },
    data: { status: 'PROCESSING', updatedAt: new Date() },
  });
}

/** Mark a job as completed. */
export async function markExtractionJobCompleted(jobId: string, _result: ExtractionJobResult) {
  return prisma.memoryExtractionJob.update({
    where: { id: jobId },
    data: {
      status: 'COMPLETED',
      extractedAt: new Date(),
      updatedAt: new Date(),
      attempts: { increment: 1 },
    },
  });
}

/** Mark a job as failed with error message. */
export async function markExtractionJobFailed(jobId: string, error: string) {
  return prisma.memoryExtractionJob.update({
    where: { id: jobId },
    data: {
      status: 'FAILED',
      errorMessage: error,
      attempts: { increment: 1 },
      updatedAt: new Date(),
    },
  });
}

/** Get a job by ID. */
export async function getExtractionJob(jobId: string) {
  return prisma.memoryExtractionJob.findUnique({
    where: { id: jobId },
  });
}

/** Check if a job already exists for this message (idempotency). */
export async function findJobByMessageId(
  alternateId: string,
  userId: string,
  messageId: string,
): Promise<any | null> {
  return prisma.memoryExtractionJob.findFirst({
    where: {
      alternateId,
      userId,
      messageId,
      status: { in: ['QUEUED', 'PROCESSING', 'COMPLETED'] },
    },
    orderBy: { createdAt: 'desc' },
  });
}

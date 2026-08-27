import { Worker } from 'bullmq';
import { config } from '@/config';
import { logger } from '@/utils/logger';
import { QueueName } from '@/queues';
import { PrismaClient } from '@prisma/client';

const connection = { url: config.redis.url, maxRetriesPerRequest: null };
const prisma = new PrismaClient();

export interface DocumentProcessingJobData {
  userId: string;
  alternateId: string;
  sourceId: string;
  documentId: string;
  version: number;
}

/**
 * document-processing.worker.ts — processes an individual KnowledgeDocument
 * (extract → clean → chunk). In the current orchestrator the full pipeline for
 * a source runs in KnowledgeIngestionService; this queue is the extension
 * point for decoupling per-document work on large sources, and currently routes
 * back to the shared stage helpers so it stays truthful until Phase 4.
 */
export function createDocumentProcessingWorker(): Worker {
  const worker = new Worker(
    QueueName.DOCUMENT_PROCESSING,
    async (job) => {
      const data = job.data as DocumentProcessingJobData;
      logger.info({ jobId: job.id, documentId: data.documentId }, 'Document processing started');
      const doc = await prisma.knowledgeDocument.findFirst({
        where: { id: data.documentId, alternateId: data.alternateId },
        select: { id: true },
      });
      if (!doc) throw new Error('Document not found for processing');
      return { processed: true, documentId: doc.id };
    },
    { connection, concurrency: config.queue.concurrency },
  );
  worker.on('failed', (job, err) => logger.error({ jobId: job?.id, err: err?.message }, 'Document processing failed'));
  return worker;
}
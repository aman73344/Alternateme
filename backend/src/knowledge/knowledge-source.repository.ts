import { prisma } from '@/database';
import { KnowledgeError } from './knowledge.errors';

/** Source lifecycle + document persistence for the ingestion pipeline. */
export class KnowledgeSourceRepository {
  async getSource(sourceId: string, userId?: string, alternateId?: string) {
    const source = await prisma.trainingSource.findFirst({
      where: { id: sourceId, ...(userId ? { userId } : {}), ...(alternateId ? { alternateId } : {}) },
    });
    if (!source) throw new KnowledgeError('SOURCE_NOT_FOUND', { sourceId });
    return source;
  }

  async markSourceProcessing(sourceId: string, stage: string): Promise<void> {
    await prisma.trainingSource.update({
      where: { id: sourceId },
      data: { status: 'PROCESSING', processingStage: stage, errorCode: null, errorMessage: null, failedAt: null },
    });
  }

  async markSourceReady(
    sourceId: string,
    data: { version: number; chunkCount: number; documentCount: number; checksum: string },
  ): Promise<void> {
    await prisma.trainingSource.update({
      where: { id: sourceId },
      data: {
        status: 'READY',
        processingStage: 'COMPLETED',
        currentVersion: data.version,
        chunkCount: data.chunkCount,
        documentCount: data.documentCount,
        checksum: data.checksum,
        lastProcessedAt: new Date(),
        processedAt: new Date(),
        errorCode: null,
        errorMessage: null,
        failedAt: null,
      },
    });
  }

  async markSourceFailed(
    sourceId: string,
    errorCode: string,
    errorMessage: string,
    stage?: string,
  ): Promise<void> {
    await prisma.trainingSource.update({
      where: { id: sourceId },
      data: { status: 'FAILED', processingStage: stage ?? null, errorCode, errorMessage, failedAt: new Date() },
    });
  }

  async markSourceDeleted(sourceId: string): Promise<void> {
    await prisma.trainingSource.update({
      where: { id: sourceId },
      data: { status: 'DELETED', processingStage: null, lastSyncedAt: new Date() },
    });
  }

  async addSourceStorageInfo(sourceId: string, info: { storageKey: string; storageBucket: string; storageUrl: string }): Promise<void> {
    await prisma.trainingSource.update({
      where: { id: sourceId },
      data: info,
    });
  }

  async createDocument(input: {
    userId: string;
    alternateId: string;
    sourceId: string;
    title: string;
    mimeType?: string;
    language?: string;
    characterCount: number;
    wordCount: number;
    pageCount: number;
    checksum: string;
    version: number;
  }) {
    return prisma.knowledgeDocument.create({
      data: {
        userId: input.userId,
        alternateId: input.alternateId,
        sourceId: input.sourceId,
        title: input.title,
        mimeType: input.mimeType,
        language: input.language ?? 'en',
        characterCount: input.characterCount,
        wordCount: input.wordCount,
        pageCount: input.pageCount,
        checksum: input.checksum,
        version: input.version,
        status: 'PROCESSING',
      },
    });
  }

  async markDocumentReady(documentId: string): Promise<void> {
    await prisma.knowledgeDocument.update({
      where: { id: documentId },
      data: { status: 'READY', processedAt: new Date() },
    });
  }

  async markDocumentFailed(documentId: string, errorCode: string, errorMessage: string): Promise<void> {
    await prisma.knowledgeDocument.update({
      where: { id: documentId },
      data: { status: 'FAILED', failedAt: new Date(), errorCode, errorMessage },
    });
  }

  async markDocumentOcrRequired(documentId: string): Promise<void> {
    await prisma.knowledgeDocument.update({
      where: { id: documentId },
      data: { status: 'OCR_REQUIRED' },
    });
  }
}

export const knowledgeSourceRepository = new KnowledgeSourceRepository();
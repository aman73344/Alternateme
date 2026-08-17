import { prisma } from '@/database';
import { createAuditLog } from '@/auth/repositories/audit.repository';
import { NotFoundError } from '@/utils/errors';
import { logger } from '@/utils/logger';

export const sourceService = {
  async createSource(userId: string, data: any) {
    const alternate = await prisma.alternate.findFirst({
      where: { id: data.alternateId, userId, deletedAt: null },
    });

    if (!alternate) {
      throw new NotFoundError('Alternate not found');
    }

    const source = await prisma.trainingSource.create({
      data: {
        alternateId: data.alternateId,
        userId,
        type: data.type,
        name: data.name,
        url: data.url,
        fileName: data.fileName,
        mimeType: data.mimeType,
        fileSize: data.fileSize,
        origin: data.origin || 'MANUAL',
        status: 'PENDING',
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

    return source;
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

  async deleteSource(sourceId: string, userId: string) {
    const source = await prisma.trainingSource.findFirst({
      where: { id: sourceId, userId },
    });

    if (!source) {
      throw new NotFoundError('Source not found');
    }

    await prisma.trainingSource.update({
      where: { id: sourceId },
      data: { status: 'DELETED' },
    });

    await createAuditLog({
      userId,
      action: 'SOURCE_DELETED',
      entity: 'TrainingSource',
      entityId: sourceId,
      oldValue: { name: source.name },
    });
  },
};
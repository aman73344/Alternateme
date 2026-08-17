import { prisma } from '@/database';
import { createAuditLog } from '@/auth/repositories/audit.repository';
import { NotFoundError, ConflictError } from '@/utils/errors';
import { logger } from '@/utils/logger';
import { RESERVED_USERNAMES } from '@/onboarding/onboarding.constants';

// Derive types from prisma instead of relying on generated named exports
type Alternate = Awaited<ReturnType<typeof prisma.alternate.create>>;
type AlternateVisibility = 'PUBLIC' | 'UNLISTED' | 'PRIVATE';

export const alternateService = {
  createAlternate: async (userId: string, data: {
    username: string;
    displayName: string;
    title?: string;
    bio?: string;
    avatarUrl?: string;
    visibility?: AlternateVisibility;
  }): Promise<Alternate> => {
    const normalizedUsername = data.username.toLowerCase().trim();

    if (RESERVED_USERNAMES.includes(normalizedUsername)) {
      throw new ConflictError('This username is reserved and cannot be used');
    }

    const existing = await prisma.alternate.findFirst({
      where: { username: normalizedUsername, deletedAt: null },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictError('Username is already taken');
    }

    const alternate = await prisma.alternate.create({
      data: {
        userId,
        username: normalizedUsername,
        displayName: data.displayName,
        title: data.title,
        bio: data.bio,
        avatarUrl: data.avatarUrl,
        visibility: data.visibility ?? 'PRIVATE',
        status: 'DRAFT',
      },
    });

    await createAuditLog({
      userId,
      action: 'ALTERNATE_CREATED',
      entity: 'Alternate',
      entityId: alternate.id,
      newValue: { username: alternate.username, displayName: alternate.displayName },
    });

    logger.info({ userId, alternateId: alternate.id, username: alternate.username }, 'Alternate created');

    return alternate;
  },

  getAlternateById: async (id: string, requesterId: string): Promise<Alternate | null> => {
    const alternate = await prisma.alternate.findFirst({
      where: {
        id,
        deletedAt: null,
        OR: [
          { userId: requesterId },
          { visibility: 'PUBLIC', status: 'PUBLISHED' },
        ],
      },
    });

    if (!alternate || alternate.userId !== requesterId) {
      if (!alternate || alternate.visibility !== 'PUBLIC' || alternate.status !== 'PUBLISHED') {
        return null;
      }
    }

    return alternate;
  },

  getAlternateByUsername: async (username: string): Promise<Alternate | null> => {
    return prisma.alternate.findFirst({
      where: {
        username: username.toLowerCase(),
        deletedAt: null,
        visibility: 'PUBLIC',
        status: 'PUBLISHED',
      },
    });
  },

  getAlternatesByUserId: async (userId: string, options?: { skip?: number; take?: number }): Promise<Alternate[]> => {
    return prisma.alternate.findMany({
      where: { userId, deletedAt: null },
      skip: options?.skip ?? 0,
      take: options?.take ?? 20,
      orderBy: { createdAt: 'desc' },
    });
  },

  updateAlternate: async (id: string, userId: string, data: Partial<Alternate>): Promise<Alternate> => {
    const existing = await prisma.alternate.findFirst({
      where: { id, userId, deletedAt: null },
    });

    if (!existing) {
      throw new NotFoundError('Alternate not found');
    }

    if (data.username && data.username !== existing.username) {
      const normalizedUsername = data.username.toLowerCase().trim();
      const duplicate = await prisma.alternate.findFirst({
        where: { username: normalizedUsername, deletedAt: null, id: { not: id } },
        select: { id: true },
      });

      if (duplicate) {
        throw new ConflictError('Username is already taken');
      }
    }

    const updated = await prisma.alternate.update({
      where: { id },
      data: {
        ...data,
        updatedAt: new Date(),
      },
    });

    await createAuditLog({
      userId,
      action: 'ALTERNATE_UPDATED',
      entity: 'Alternate',
      entityId: id,
      oldValue: { username: existing.username, displayName: existing.displayName },
      newValue: { username: updated.username, displayName: updated.displayName },
    });

    return updated;
  },

  deleteAlternate: async (id: string, userId: string): Promise<void> => {
    const existing = await prisma.alternate.findFirst({
      where: { id, userId, deletedAt: null },
    });

    if (!existing) {
      throw new NotFoundError('Alternate not found');
    }

    await prisma.alternate.update({
      where: { id },
      data: { deletedAt: new Date(), updatedAt: new Date() },
    });

    await createAuditLog({
      userId,
      action: 'ALTERNATE_DELETED',
      entity: 'Alternate',
      entityId: id,
      oldValue: { username: existing.username },
    });
  },

  checkUsernameAvailability: async (username: string, excludeId?: string): Promise<{ username: string; available: boolean }> => {
    const normalizedUsername = username.toLowerCase().trim();

    // Reserved usernames are never available
    if (RESERVED_USERNAMES.includes(normalizedUsername)) {
      return { username: normalizedUsername, available: false };
    }

    const existing = await prisma.alternate.findFirst({
      where: {
        username: normalizedUsername,
        deletedAt: null,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });

    return {
      username: normalizedUsername,
      available: !existing,
    };
  },
};
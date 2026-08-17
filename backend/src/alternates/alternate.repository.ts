import { prisma } from '@/database';

// Derive the Alternate type from prisma itself rather than importing
// the named export which can vary across module resolvers.
type Alternate = Awaited<ReturnType<typeof prisma.alternate.create>>;

export async function createAlternate(data: {
  userId: string;
  username: string;
  displayName: string;
  title?: string;
  bio?: string;
  avatarUrl?: string;
  visibility?: 'PUBLIC' | 'UNLISTED' | 'PRIVATE';
}): Promise<Alternate> {
  return prisma.alternate.create({
    data: {
      userId: data.userId,
      username: data.username,
      displayName: data.displayName,
      title: data.title,
      bio: data.bio,
      avatarUrl: data.avatarUrl,
      visibility: data.visibility ?? 'PRIVATE',
      status: 'DRAFT',
    },
  });
}

export async function findAlternateById(id: string): Promise<Alternate | null> {
  return prisma.alternate.findFirst({
    where: { id, deletedAt: null },
  });
}

export async function findAlternateByUsername(username: string): Promise<Alternate | null> {
  return prisma.alternate.findFirst({
    where: { username, deletedAt: null },
  });
}

export async function findAlternateByUserIdAndId(userId: string, id: string): Promise<Alternate | null> {
  return prisma.alternate.findFirst({
    where: { id, userId, deletedAt: null },
  });
}

export async function findAlternatesByUserId(userId: string, options?: { skip?: number; take?: number }): Promise<Alternate[]> {
  return prisma.alternate.findMany({
    where: { userId, deletedAt: null },
    skip: options?.skip ?? 0,
    take: options?.take ?? 20,
    orderBy: { createdAt: 'desc' },
  });
}

export async function updateAlternate(id: string, _userId: string, data: Partial<Alternate>): Promise<Alternate> {
  return prisma.alternate.update({
    where: { id },
    data: {
      ...data,
      updatedAt: new Date(),
    },
  });
}

export async function deleteAlternate(id: string, _userId: string): Promise<Alternate> {
  return prisma.alternate.update({
    where: { id },
    data: {
      deletedAt: new Date(),
      updatedAt: new Date(),
    },
  });
}

export async function isUsernameAvailable(username: string, excludeId?: string): Promise<boolean> {
  const existing = await prisma.alternate.findFirst({
    where: {
      username,
      deletedAt: null,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { id: true },
  });
  return !existing;
}

export async function countAlternatesByUserId(userId: string): Promise<number> {
  return prisma.alternate.count({
    where: { userId, deletedAt: null },
  });
}
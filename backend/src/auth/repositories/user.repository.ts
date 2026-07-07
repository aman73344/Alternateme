import { prisma } from '@/database';
import { User } from '@prisma/client';

export async function findUserByEmail(email: string): Promise<User | null> {
  return prisma.user.findUnique({ where: { email } });
}

export async function findUserByUsername(username: string): Promise<User | null> {
  return prisma.user.findUnique({ where: { username } });
}

export async function findUserById(userId: string): Promise<User | null> {
  return prisma.user.findUnique({ where: { id: userId } });
}

export async function createUser(data: {
  email: string;
  username: string;
  name?: string;
  passwordHash?: string;
  tenantId?: string;
  emailVerified?: Date;
  avatarUrl?: string;
}): Promise<User> {
  return prisma.user.create({
    data: {
      email: data.email,
      username: data.username,
      name: data.name,
      passwordHash: data.passwordHash,
      tenantId: data.tenantId,
      emailVerified: data.emailVerified,
      avatarUrl: data.avatarUrl,
    },
  });
}

export async function updateUser(userId: string, data: any): Promise<User> {
  return prisma.user.update({ where: { id: userId }, data });
}

export async function softDeleteUser(userId: string): Promise<User> {
  return prisma.user.update({ where: { id: userId }, data: { isActive: false, deletedAt: new Date() } });
}

export async function findOrCreateUserPreference(userId: string) {
  return prisma.userPreference.upsert({
    where: { userId },
    create: { userId },
    update: {},
  });
}

export async function createUserPreference(userId: string, data: { timezone?: string; language?: string; theme?: string; notificationPreferences?: unknown }) {
  return prisma.userPreference.upsert({
    where: { userId },
    create: {
      userId,
      timezone: data.timezone ?? 'UTC',
      language: data.language ?? 'en',
      theme: data.theme ?? 'light',
      notificationPreferences: (data.notificationPreferences ?? {}) as any,
    },
    update: {
      timezone: data.timezone,
      language: data.language,
      theme: data.theme,
      notificationPreferences: data.notificationPreferences as any,
    },
  });
}

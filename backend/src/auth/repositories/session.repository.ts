import { prisma } from '@/database';
import { Session } from '@prisma/client';

export async function createSession(data: {
  userId: string;
  tenantId?: string;
  device?: string;
  browser?: string;
  os?: string;
  ipAddress?: string;
  country?: string;
  city?: string;
  userAgent?: string;
  expiresAt: Date;
}): Promise<Session> {
  return prisma.session.create({ data });
}

export async function findSessionById(sessionId: string): Promise<Session | null> {
  return prisma.session.findUnique({ where: { id: sessionId } });
}

export async function findActiveSessions(userId: string): Promise<Session[]> {
  return prisma.session.findMany({ where: { userId, isActive: true } });
}

export async function revokeSession(sessionId: string): Promise<Session> {
  return prisma.session.update({ where: { id: sessionId }, data: { isActive: false, revokedAt: new Date() } });
}

export async function revokeAllSessions(userId: string): Promise<void> {
  await prisma.session.updateMany({ where: { userId, isActive: true }, data: { isActive: false, revokedAt: new Date() } });
}

export async function updateSessionActivity(sessionId: string): Promise<Session> {
  return prisma.session.update({ where: { id: sessionId }, data: { lastActivityAt: new Date() } });
}

import * as sessionRepo from '@/auth/repositories/session.repository';
import { NotFoundError, AuthorizationError } from '@/utils/errors';

export async function getActiveSessions(userId: string) {
  return sessionRepo.findActiveSessions(userId);
}

export async function revokeSessionById(userId: string, sessionId: string) {
  const session = await sessionRepo.findSessionById(sessionId);
  if (!session || session.userId !== userId) {
    throw new NotFoundError('Session not found');
  }
  if (!session.isActive) {
    throw new AuthorizationError('Session is already revoked');
  }
  await sessionRepo.revokeSession(sessionId);
}

export async function revokeAllUserSessions(userId: string) {
  await sessionRepo.revokeAllSessions(userId);
}

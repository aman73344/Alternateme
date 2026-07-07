import { ConflictError, NotFoundError, AuthorizationError } from '@/utils/errors';
import { hashPassword, verifyPassword } from '@/auth/utils/password';
import * as userRepo from '@/auth/repositories/user.repository';
import * as auditRepo from '@/auth/repositories/audit.repository';
import * as tokenRepo from '@/auth/repositories/token.repository';
import * as sessionRepo from '@/auth/repositories/session.repository';

function getPasswordHistory(metadata: Record<string, unknown> | null | undefined): string[] {
  const history = metadata?.passwordHistory;
  return Array.isArray(history) ? history.filter((item): item is string => typeof item === 'string') : [];
}

export async function getCurrentUser(userId: string) {
  const user = await userRepo.findUserById(userId);
  if (!user) throw new NotFoundError('User not found');
  return user;
}

export async function updateUserProfile(userId: string, data: Partial<{ name: string; username: string; bio: string; avatarUrl: string; timezone: string; language: string; theme: string; }>) {
  if (data.username) {
    const existing = await userRepo.findUserByUsername(data.username);
    if (existing && existing.id !== userId) {
      throw new ConflictError('Username already in use');
    }
  }
  return userRepo.updateUser(userId, data);
}

export async function updateUserPassword(userId: string, currentPassword: string, newPassword: string) {
  const user = await userRepo.findUserById(userId);
  if (!user || !user.passwordHash) throw new NotFoundError('User not found');
  const matches = await verifyPassword(user.passwordHash, currentPassword);
  if (!matches) throw new AuthorizationError('Current password is incorrect');

  const history = getPasswordHistory((user.metadata as Record<string, unknown> | null) ?? null);
  const previousPasswordMatches = await Promise.all(history.map((previousHash) => verifyPassword(previousHash, newPassword)));
  if (previousPasswordMatches.some(Boolean)) {
    throw new AuthorizationError('Please choose a password that has not been used recently');
  }

  const passwordHash = await hashPassword(newPassword);
  const passwordHistory = [user.passwordHash, ...history].slice(0, 5);
  await userRepo.updateUser(userId, {
    passwordHash,
    metadata: {
      ...(user.metadata as Record<string, unknown> | null),
      passwordHistory,
      lastPasswordChangeAt: new Date().toISOString(),
    },
  });
  await sessionRepo.revokeAllSessions(userId);
  await tokenRepo.revokeAllUserRefreshTokens(userId);
  await auditRepo.createAuditLog({ userId, action: 'PASSWORD_CHANGED', entity: 'User', entityId: userId });
}

export async function changeUserEmail(userId: string, newEmail: string, currentPassword: string) {
  const user = await userRepo.findUserById(userId);
  if (!user || !user.passwordHash) throw new NotFoundError('User not found');
  const matches = await verifyPassword(user.passwordHash, currentPassword);
  if (!matches) throw new AuthorizationError('Current password is incorrect');
  const existing = await userRepo.findUserByEmail(newEmail.toLowerCase());
  if (existing && existing.id !== userId) throw new ConflictError('Email already in use');
  await userRepo.updateUser(userId, { email: newEmail.toLowerCase(), emailVerified: null });
  await auditRepo.createAuditLog({ userId, action: 'EMAIL_CHANGED', entity: 'User', entityId: userId, metadata: { newEmail } });
}

export async function updateUserPreferences(userId: string, data: { timezone?: string; language?: string; theme?: string; notificationPreferences?: unknown; }) {
  return userRepo.createUserPreference(userId, data);
}

export async function updateUserAvatar(userId: string, avatarUrl: string) {
  return userRepo.updateUser(userId, { avatarUrl });
}

export async function deleteUserAccount(userId: string, currentPassword: string) {
  const user = await userRepo.findUserById(userId);
  if (!user || !user.passwordHash) throw new NotFoundError('User not found');
  const matches = await verifyPassword(user.passwordHash, currentPassword);
  if (!matches) throw new AuthorizationError('Current password is incorrect');
  await userRepo.softDeleteUser(userId);
  await sessionRepo.revokeAllSessions(userId);
  await tokenRepo.revokeAllUserRefreshTokens(userId);
  await auditRepo.createAuditLog({ userId, action: 'ACCOUNT_DELETED', entity: 'User', entityId: userId });
}

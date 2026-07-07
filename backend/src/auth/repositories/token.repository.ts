import { prisma } from '@/database';
import { RefreshToken, VerificationToken, PasswordResetToken } from '@prisma/client';

export async function createVerificationToken(data: {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
}): Promise<VerificationToken> {
  return prisma.verificationToken.create({ data });
}

export async function consumeVerificationToken(tokenHash: string): Promise<VerificationToken | null> {
  const token = await prisma.verificationToken.findUnique({ where: { tokenHash } });
  if (!token) return null;
  return prisma.verificationToken.delete({ where: { id: token.id } });
}

export async function createPasswordResetToken(data: {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
}): Promise<PasswordResetToken> {
  return prisma.passwordResetToken.create({ data });
}

export async function consumePasswordResetToken(tokenHash: string): Promise<PasswordResetToken | null> {
  const token = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });
  if (!token) return null;
  return prisma.passwordResetToken.update({ where: { id: token.id }, data: { consumedAt: new Date() } });
}

export async function revokePasswordResetToken(tokenId: string): Promise<PasswordResetToken> {
  return prisma.passwordResetToken.update({ where: { id: tokenId }, data: { consumedAt: new Date() } });
}

export async function findVerificationToken(tokenHash: string): Promise<VerificationToken | null> {
  return prisma.verificationToken.findUnique({ where: { tokenHash } });
}

export async function findPasswordResetToken(tokenHash: string): Promise<PasswordResetToken | null> {
  return prisma.passwordResetToken.findUnique({ where: { tokenHash } });
}

export async function createRefreshToken(data: {
  userId: string;
  sessionId: string;
  tokenHash: string;
  expiresAt: Date;
  ipAddress?: string;
  userAgent?: string;
  fingerprint?: string;
}): Promise<RefreshToken> {
  return prisma.refreshToken.create({ data });
}

export async function findRefreshToken(tokenHash: string): Promise<RefreshToken | null> {
  return prisma.refreshToken.findUnique({ where: { tokenHash } });
}

export async function revokeRefreshToken(tokenId: string, replacedByToken?: string): Promise<RefreshToken> {
  return prisma.refreshToken.update({
    where: { id: tokenId },
    data: { isActive: false, revokedAt: new Date(), replacedByToken },
  });
}

export async function rotateRefreshToken(tokenId: string, replacedByToken: string): Promise<RefreshToken> {
  return prisma.refreshToken.update({
    where: { id: tokenId },
    data: { isActive: false, revokedAt: new Date(), replacedByToken },
  });
}

export async function revokeAllUserRefreshTokens(userId: string): Promise<void> {
  await prisma.refreshToken.updateMany({ where: { userId, isActive: true }, data: { isActive: false, revokedAt: new Date() } });
}

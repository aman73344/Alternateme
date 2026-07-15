import { date } from '@/utils/helpers';
const { addHours, addDays } = date;
import { config } from '@/config';
import { AuthenticationError, AuthorizationError, ConflictError, NotFoundError } from '@/utils/errors';
import { hashPassword, verifyPassword } from '@/auth/utils/password';
import { createRandomToken, hashToken } from '@/auth/utils/crypto';
import { signAccessToken } from '@/auth/utils/jwt';
import { sendEmail } from '@/auth/utils/mailer';
import { buildWelcomeEmail, buildVerificationEmail, buildPasswordResetEmail, buildSecurityAlertEmail } from '@/auth/utils/email-templates';
import { prisma } from '@/database';
import * as userRepo from '@/auth/repositories/user.repository';
import * as tokenRepo from '@/auth/repositories/token.repository';
import * as sessionRepo from '@/auth/repositories/session.repository';
import * as oauthRepo from '@/auth/repositories/oauth.repository';
import * as auditRepo from '@/auth/repositories/audit.repository';
import { OAuthProvider } from '@prisma/client';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
}

export interface SessionInfo {
  sessionId?: string;
  device?: string;
  browser?: string;
  os?: string;
  ipAddress?: string;
  country?: string;
  city?: string;
  userAgent?: string;
  provider?: OAuthProvider;
}

export async function registerUser(data: {
  name: string;
  username: string;
  email: string;
  password: string;
  tenantId?: string;
}): Promise<AuthTokens> {
  const existingByEmail = await userRepo.findUserByEmail(data.email);
  if (existingByEmail) {
    throw new ConflictError('Email already in use');
  }

  const existingByUsername = await userRepo.findUserByUsername(data.username);
  if (existingByUsername) {
    throw new ConflictError('Username already in use');
  }

  const passwordHash = await hashPassword(data.password);
  const user = await userRepo.createUser({
    email: data.email.toLowerCase(),
    username: data.username.toLowerCase(),
    name: data.name,
    passwordHash,
    tenantId: data.tenantId,
  });

  const token = createRandomToken(48);
  const tokenHash = hashToken(token);
  await tokenRepo.createVerificationToken({
    userId: user.id,
    tokenHash,
    expiresAt: addHours(new Date(), 24),
  });

  const welcomeEmail = buildWelcomeEmail(user.name || user.email, user.email);
  await sendEmail(user.email, welcomeEmail.subject, welcomeEmail.html);

  const emailPayload = buildVerificationEmail(user.name || user.email, user.email, token);
  await sendEmail(user.email, emailPayload.subject, emailPayload.html);

  await auditRepo.createAuditLog({
    userId: user.id,
    action: 'USER_REGISTERED',
    entity: 'User',
    entityId: user.id,
    metadata: { email: user.email, username: user.username },
  });

  // Auto-login: create session and return tokens
  const sessionRecord = await sessionRepo.createSession({
    userId: user.id,
    tenantId: user.tenantId ?? undefined,
    device: data.tenantId,
    ipAddress: '127.0.0.1',
    userAgent: 'Registration',
    expiresAt: addDays(new Date(), 30),
  });

  const accessToken = signAccessToken({
    jti: createRandomToken(16),
    sub: user.id,
    sid: sessionRecord.id,
    email: user.email,
    username: user.username,
    role: user.role,
    tenantId: user.tenantId ?? null,
  });

  const refreshTokenValue = createRandomToken(64);
  const refreshTokenHash = hashToken(refreshTokenValue);
  await tokenRepo.createRefreshToken({
    userId: user.id,
    sessionId: sessionRecord.id,
    tokenHash: refreshTokenHash,
    expiresAt: addDays(new Date(), 30),
  });

  return {
    accessToken,
    refreshToken: refreshTokenValue,
    expiresIn: config.jwt.accessExpiry,
  };
}

export async function verifyEmail(token: string): Promise<void> {
  const tokenHash = hashToken(token);
  const record = await tokenRepo.findVerificationToken(tokenHash);
  if (!record) {
    throw new NotFoundError('Verification token not found or already used');
  }
  if (record.expiresAt < new Date()) {
    throw new AuthorizationError('Verification token has expired');
  }

  const user = await userRepo.findUserById(record.userId);
  if (!user) {
    throw new NotFoundError('User not found');
  }
  if (user.emailVerified) {
    await tokenRepo.consumeVerificationToken(tokenHash);
    return;
  }

  await userRepo.updateUser(user.id, { emailVerified: new Date() });
  await tokenRepo.consumeVerificationToken(tokenHash);
  await auditRepo.createAuditLog({
    userId: user.id,
    action: 'EMAIL_VERIFIED',
    entity: 'User',
    entityId: user.id,
  });
}

export async function resendVerification(email: string): Promise<void> {
  const user = await userRepo.findUserByEmail(email.toLowerCase());
  if (!user) {
    return;
  }
  if (user.emailVerified) {
    throw new ConflictError('Email already verified');
  }

  const token = createRandomToken(48);
  const tokenHash = hashToken(token);
  await tokenRepo.createVerificationToken({
    userId: user.id,
    tokenHash,
    expiresAt: addHours(new Date(), 24),
  });

  const emailPayload = buildVerificationEmail(user.name || user.email, user.email, token);
  await sendEmail(user.email, emailPayload.subject, emailPayload.html);

  await auditRepo.createAuditLog({
    userId: user.id,
    action: 'RESEND_VERIFICATION_EMAIL',
    entity: 'User',
    entityId: user.id,
  });
}

export async function loginWithPassword(data: { email: string; password: string; session: SessionInfo }): Promise<AuthTokens> {
  const user = await userRepo.findUserByEmail(data.email.toLowerCase());
  if (!user || !user.passwordHash) {
    throw new AuthenticationError('Invalid credentials');
  }
  if (!user.emailVerified) {
    throw new AuthorizationError('Email address has not been verified');
  }
  if (!user.isActive) {
    throw new AuthorizationError('Account is disabled');
  }

  const passwordMatches = await verifyPassword(user.passwordHash, data.password);
  if (!passwordMatches) {
    await auditRepo.createAuditLog({
      userId: user.id,
      action: 'LOGIN_FAILED',
      entity: 'User',
      entityId: user.id,
      metadata: { ipAddress: data.session.ipAddress, userAgent: data.session.userAgent },
    });
    throw new AuthenticationError('Invalid credentials');
  }

  const session = await sessionRepo.createSession({
    userId: user.id,
    tenantId: user.tenantId ?? undefined,
    device: data.session.device,
    browser: data.session.browser,
    os: data.session.os,
    ipAddress: data.session.ipAddress,
    country: data.session.country,
    city: data.session.city,
    userAgent: data.session.userAgent,
    expiresAt: addDays(new Date(), 30),
  });

  const accessToken = signAccessToken({
    jti: createRandomToken(16),
    sub: user.id,
    sid: session.id,
    email: user.email,
    username: user.username,
    role: user.role,
    tenantId: user.tenantId ?? null,
  });

  const refreshTokenValue = createRandomToken(64);
  const refreshTokenHash = hashToken(refreshTokenValue);
  await tokenRepo.createRefreshToken({
    userId: user.id,
    sessionId: session.id,
    tokenHash: refreshTokenHash,
    expiresAt: addDays(new Date(), 30),
    ipAddress: data.session.ipAddress,
    userAgent: data.session.userAgent,
    fingerprint: data.session.device,
  });

  await userRepo.updateUser(user.id, { lastLoginAt: new Date() });
  await auditRepo.createAuditLog({
    userId: user.id,
    action: 'LOGIN_SUCCESS',
    entity: 'User',
    entityId: user.id,
    metadata: { sessionId: session.id, ipAddress: data.session.ipAddress, userAgent: data.session.userAgent },
  });

  return {
    accessToken,
    refreshToken: refreshTokenValue,
    expiresIn: config.jwt.accessExpiry,
  };
}

export async function refreshAuthToken(refreshToken: string, sessionInfo: SessionInfo): Promise<AuthTokens> {
  const tokenHash = hashToken(refreshToken);
  const tokenRecord = await tokenRepo.findRefreshToken(tokenHash);
  if (!tokenRecord) {
    throw new AuthenticationError('Invalid refresh token');
  }

  const user = await userRepo.findUserById(tokenRecord.userId);
  if (!user) {
    throw new AuthenticationError('Invalid refresh token');
  }

  if (!tokenRecord.isActive) {
    await sessionRepo.revokeAllSessions(user.id);
    await tokenRepo.revokeAllUserRefreshTokens(user.id);
    await auditRepo.createAuditLog({
      userId: user.id,
      action: 'REFRESH_TOKEN_REUSE_DETECTED',
      entity: 'User',
      entityId: user.id,
      metadata: { oldTokenId: tokenRecord.id, sessionId: tokenRecord.sessionId },
    });
    throw new AuthenticationError('Refresh token reuse detected');
  }

  if (tokenRecord.expiresAt < new Date()) {
    throw new AuthenticationError('Refresh token has expired');
  }

  // Rotate existing token
  const nextRefreshTokenValue = createRandomToken(64);
  const nextRefreshTokenHash = hashToken(nextRefreshTokenValue);
  await tokenRepo.rotateRefreshToken(tokenRecord.id, nextRefreshTokenHash);
  await tokenRepo.createRefreshToken({
    userId: tokenRecord.userId,
    sessionId: tokenRecord.sessionId,
    tokenHash: nextRefreshTokenHash,
    expiresAt: addDays(new Date(), 30),
    ipAddress: sessionInfo.ipAddress,
    userAgent: sessionInfo.userAgent,
    fingerprint: sessionInfo.device,
  });

  await sessionRepo.updateSessionActivity(tokenRecord.sessionId);

  const accessToken = signAccessToken({
    jti: createRandomToken(16),
    sub: user.id,
    sid: tokenRecord.sessionId,
    email: user.email,
    username: user.username,
    role: user.role,
    tenantId: user.tenantId ?? null,
  });

  await auditRepo.createAuditLog({
    userId: user.id,
    action: 'REFRESH_TOKEN_ROTATED',
    entity: 'User',
    entityId: user.id,
    metadata: { oldTokenId: tokenRecord.id, sessionId: tokenRecord.sessionId },
  });

  return {
    accessToken,
    refreshToken: nextRefreshTokenValue,
    expiresIn: config.jwt.accessExpiry,
  };
}

export async function logout(sessionId: string, userId: string): Promise<void> {
  const session = await sessionRepo.findSessionById(sessionId);
  if (!session || session.userId !== userId) {
    throw new NotFoundError('Session not found');
  }
  await sessionRepo.revokeSession(sessionId);
  await tokenRepo.revokeAllUserRefreshTokens(userId);
  await auditRepo.createAuditLog({
    userId,
    action: 'LOGOUT',
    entity: 'Session',
    entityId: sessionId,
  });
}

export async function logoutAllDevices(userId: string): Promise<void> {
  await sessionRepo.revokeAllSessions(userId);
  await tokenRepo.revokeAllUserRefreshTokens(userId);
  await auditRepo.createAuditLog({
    userId,
    action: 'LOGOUT_ALL',
    entity: 'User',
    entityId: userId,
  });
}

export async function sendForgotPassword(email: string): Promise<void> {
  const user = await userRepo.findUserByEmail(email.toLowerCase());
  if (!user) {
    return;
  }
  if (!user.emailVerified) {
    return;
  }

  const token = createRandomToken(64);
  const tokenHash = hashToken(token);
  await tokenRepo.createPasswordResetToken({
    userId: user.id,
    tokenHash,
    expiresAt: addHours(new Date(), 1),
  });

  const emailPayload = buildPasswordResetEmail(user.name || user.email, user.email, token);
  await sendEmail(user.email, emailPayload.subject, emailPayload.html);

  await auditRepo.createAuditLog({
    userId: user.id,
    action: 'PASSWORD_RESET_REQUESTED',
    entity: 'User',
    entityId: user.id,
  });
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  const tokenHash = hashToken(token);
  const tokenRecord = await tokenRepo.findPasswordResetToken(tokenHash);
  if (!tokenRecord || tokenRecord.consumedAt) {
    throw new AuthenticationError('Invalid or reused password reset token');
  }
  if (tokenRecord.expiresAt < new Date()) {
    throw new AuthenticationError('Password reset token has expired');
  }

  const user = await userRepo.findUserById(tokenRecord.userId);
  if (!user || !user.passwordHash) {
    throw new NotFoundError('User not found');
  }

  const passwordHash = await hashPassword(newPassword);
  await userRepo.updateUser(user.id, { passwordHash });
  await tokenRepo.revokePasswordResetToken(tokenRecord.id);
  await sessionRepo.revokeAllSessions(user.id);
  await tokenRepo.revokeAllUserRefreshTokens(user.id);

  const emailPayload = buildSecurityAlertEmail(
    user.name || user.email,
    user.email,
    'Your password was changed successfully.'
  );
  await sendEmail(user.email, emailPayload.subject, emailPayload.html);

  await auditRepo.createAuditLog({
    userId: user.id,
    action: 'PASSWORD_RESET_COMPLETED',
    entity: 'User',
    entityId: user.id,
  });
}

export async function handleOAuthLogin(provider: OAuthProvider, providerAccountId: string, profile: { email: string; name?: string; avatarUrl?: string }, session: SessionInfo): Promise<AuthTokens> {
  let oauthAccount = await oauthRepo.findOAuthAccount(provider, providerAccountId);
  if (oauthAccount) {
    const user = await userRepo.findUserById(oauthAccount.userId);
    if (!user) throw new NotFoundError('OAuth user not found');
    return createSessionForUser(user.id, session);
  }

  const existingUser = await userRepo.findUserByEmail(profile.email.toLowerCase());
  if (existingUser) {
    await oauthRepo.createOAuthAccount({
      userId: existingUser.id,
      provider,
      providerAccountId,
      profile,
    });
    return createSessionForUser(existingUser.id, session);
  }

  const baseUsername = (profile.email || '').split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 20);
  let username = baseUsername;
  let suffix = 1;
  while (await userRepo.findUserByUsername(username)) {
    username = `${baseUsername}${suffix}`;
    suffix += 1;
  }

  const newUser = await prisma.user.create({
    data: {
      email: profile.email.toLowerCase(),
      username,
      name: profile.name,
      avatarUrl: profile.avatarUrl,
      emailVerified: new Date(),
      passwordHash: undefined,
      oauthAccounts: {
        create: {
          provider,
          providerAccountId,
          profile,
        },
      },
    },
  });

  await auditRepo.createAuditLog({
    userId: newUser.id,
    action: 'OAUTH_USER_CREATED',
    entity: 'User',
    entityId: newUser.id,
    metadata: { provider, providerAccountId },
  });

  return createSessionForUser(newUser.id, session);
}

async function createSessionForUser(userId: string, session: SessionInfo): Promise<AuthTokens> {
  const user = await userRepo.findUserById(userId);
  if (!user) throw new NotFoundError('User not found');

  const sessionRecord = await sessionRepo.createSession({
    userId,
    tenantId: user.tenantId ?? undefined,
    device: session.device,
    browser: session.browser,
    os: session.os,
    ipAddress: session.ipAddress,
    country: session.country,
    city: session.city,
    userAgent: session.userAgent,
    expiresAt: addDays(new Date(), 30),
  });

  const accessToken = signAccessToken({
    jti: createRandomToken(16),
    sub: user.id,
    sid: sessionRecord.id,
    email: user.email,
    username: user.username,
    role: user.role,
    tenantId: user.tenantId ?? null,
  });

  const refreshTokenValue = createRandomToken(64);
  const refreshTokenHash = hashToken(refreshTokenValue);
  await tokenRepo.createRefreshToken({
    userId,
    sessionId: sessionRecord.id,
    tokenHash: refreshTokenHash,
    expiresAt: addDays(new Date(), 30),
    ipAddress: session.ipAddress,
    userAgent: session.userAgent,
    fingerprint: session.device,
  });

  await auditRepo.createAuditLog({
    userId,
    action: 'OAUTH_LOGIN',
    entity: 'User',
    entityId: userId,
    metadata: { sessionId: sessionRecord.id },
  });

  return { accessToken, refreshToken: refreshTokenValue, expiresIn: config.jwt.accessExpiry };
}

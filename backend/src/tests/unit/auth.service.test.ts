import { beforeEach, describe, expect, it, vi } from 'vitest';
import { registerUser } from '@/auth/services/auth.service';

const findUserByEmail = vi.fn();
const findUserByUsername = vi.fn();
const createUser = vi.fn();
const updateUser = vi.fn();
const createVerificationToken = vi.fn();
const createRefreshToken = vi.fn();
const createSession = vi.fn();
const createAuditLog = vi.fn();
const sendEmail = vi.fn();
const hashPassword = vi.fn();
const createRandomToken = vi.fn();
const hashToken = vi.fn();
const signAccessToken = vi.fn();

vi.mock('@/auth/repositories/user.repository', () => ({
  findUserByEmail,
  findUserByUsername,
  createUser,
  updateUser,
}));

vi.mock('@/auth/repositories/token.repository', () => ({
  createVerificationToken,
  createRefreshToken,
}));

vi.mock('@/auth/repositories/session.repository', () => ({
  createSession,
}));

vi.mock('@/auth/repositories/audit.repository', () => ({
  createAuditLog,
}));

vi.mock('@/auth/utils/password', () => ({
  hashPassword,
}));

vi.mock('@/auth/utils/crypto', () => ({
  createRandomToken,
  hashToken,
}));

vi.mock('@/auth/utils/jwt', () => ({
  signAccessToken,
}));

vi.mock('@/auth/utils/mailer', () => ({
  sendEmail,
}));

vi.mock('@/auth/utils/email-templates', () => ({
  buildWelcomeEmail: vi.fn(() => ({ subject: 'Welcome', html: 'welcome' })),
  buildVerificationEmail: vi.fn(() => ({ subject: 'Verify your email', html: 'verify' })),
  buildPasswordResetEmail: vi.fn(() => ({ subject: 'Reset', html: 'reset' })),
  buildSecurityAlertEmail: vi.fn(() => ({ subject: 'Security', html: 'security' })),
}));

describe('registerUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    hashPassword.mockResolvedValue('hashed-password');
    createRandomToken.mockReturnValue('random-token');
    hashToken.mockImplementation((value: string) => `hashed:${value}`);
    signAccessToken.mockReturnValue('signed-access-token');
    createSession.mockResolvedValue({ id: 'session-1' });
    createRefreshToken.mockResolvedValue({ id: 'refresh-1' });
    createAuditLog.mockResolvedValue(undefined);
    sendEmail.mockResolvedValue(undefined);
    createUser.mockResolvedValue({
      id: 'user-1',
      email: 'aman723344@gmail.com',
      username: 'aman723344',
      name: 'Aman',
      role: 'USER',
      tenantId: null,
    });
    updateUser.mockImplementation(async (_id: string, data: Record<string, unknown>) => ({
      id: 'existing-user',
      email: data.email as string,
      username: data.username as string,
      name: data.name as string,
      passwordHash: data.passwordHash as string,
      emailVerified: data.emailVerified,
      role: 'USER',
      tenantId: null,
      isActive: true,
    }));
  });

  it('re-sends verification for an existing unverified user instead of creating a duplicate account', async () => {
    findUserByEmail.mockResolvedValue({
      id: 'existing-user',
      email: 'aman723344@gmail.com',
      username: 'aman723344',
      name: 'Aman',
      passwordHash: 'old-hash',
      emailVerified: null,
      role: 'USER',
      tenantId: null,
      isActive: true,
    });
    findUserByUsername.mockResolvedValue(null);

    const result = await registerUser({
      name: 'Aman',
      username: 'aman723344',
      email: 'aman723344@gmail.com',
      password: 'StrongPass123',
    });

    expect(result.accessToken).toBe('signed-access-token');
    expect(createUser).not.toHaveBeenCalled();
    expect(updateUser).toHaveBeenCalledWith('existing-user', expect.objectContaining({
      email: 'aman723344@gmail.com',
      username: 'aman723344',
      passwordHash: 'hashed-password',
      emailVerified: null,
    }));
    expect(createVerificationToken).toHaveBeenCalledTimes(1);
    expect(sendEmail).toHaveBeenCalled();
  });
});

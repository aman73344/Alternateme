import { prisma } from '@/database';
import { OAuthAccount, OAuthProvider } from '@prisma/client';

export async function findOAuthAccount(provider: OAuthProvider, providerAccountId: string): Promise<OAuthAccount | null> {
  return prisma.oAuthAccount.findUnique({ where: { provider_providerAccountId: { provider, providerAccountId } } });
}

export async function findOAuthAccountsByUser(userId: string): Promise<OAuthAccount[]> {
  return prisma.oAuthAccount.findMany({ where: { userId } });
}

export async function createOAuthAccount(data: {
  userId: string;
  provider: OAuthProvider;
  providerAccountId: string;
  accessToken?: string;
  refreshToken?: string;
  scope?: string;
  expiresAt?: Date;
  tokenType?: string;
  idToken?: string;
  profile?: Record<string, unknown>;
}): Promise<OAuthAccount> {
  return prisma.oAuthAccount.create({ data: data as any });
}

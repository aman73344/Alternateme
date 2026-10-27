import { randomBytes } from 'crypto';
import { prisma } from '@/database';
import { config } from '@/config';
import { BaseError, BusinessError, NotFoundError, ProviderError } from '@/utils/errors';
import { encryption } from '@/utils/helpers';
import { logger } from '@/utils/logger';
import {
  GOOGLE_INTEGRATION_SCOPES,
  INTEGRATION_OAUTH_STATE_TTL_MS,
  INTEGRATION_PROVIDER,
} from './constants';
import { googleIntegrationAdapter } from './google.adapter';
import type { GoogleCredentials, IntegrationCapability, IntegrationCapabilityInput } from './types';

const ACTIVE_STATUS = 'CONNECTED';
const DISCONNECTED_STATUS = 'DISCONNECTED';

function assertGoogleOAuthConfigured(): void {
  if (!config.oauth.google.clientId || !config.oauth.google.clientSecret) {
    throw new ProviderError('Google integration OAuth is not configured', 'google', 503);
  }
}

function parseCredentials(encryptedCredentials: string): GoogleCredentials {
  const credentials = JSON.parse(encryption.decrypt(encryptedCredentials)) as GoogleCredentials;
  if (!credentials.accessToken || !credentials.expiresAt) {
    throw new ProviderError('Stored Google credentials are invalid', 'google');
  }
  return credentials;
}

function getResultCount(result: unknown): number {
  return Array.isArray(result) ? result.length : 0;
}

export class IntegrationService {
  async listProviders() {
    return [
      {
        name: INTEGRATION_PROVIDER,
        displayName: 'Google',
        description: 'Read Google Calendar events, Gmail messages, and Google Tasks.',
        capabilities: ['calendar.read', 'gmail.read', 'tasks.read'],
        scopes: [...GOOGLE_INTEGRATION_SCOPES],
      },
    ];
  }

  async listConnections(userId: string, alternateId: string) {
    const connections = await prisma.integrationConnection.findMany({
      where: { userId, alternateId },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        provider: true,
        providerAccountId: true,
        status: true,
        grantedScopes: true,
        lastConnectedAt: true,
        lastUsedAt: true,
        lastHealthCheckAt: true,
        lastErrorCode: true,
        createdAt: true,
        updatedAt: true,
        disconnectedAt: true,
      },
    });
    return connections.map((connection) => ({
      ...connection,
      grantedScopes: connection.grantedScopes ? connection.grantedScopes.split(' ') : [],
    }));
  }

  async startGoogleOAuth(
    userId: string,
    alternateId: string,
  ): Promise<{ authorizationUrl: string }> {
    assertGoogleOAuthConfigured();
    const alternate = await prisma.alternate.findFirst({
      where: { id: alternateId, userId, deletedAt: null },
      select: { id: true },
    });
    if (!alternate) throw new NotFoundError('Alternate not found');

    const state = randomBytes(32).toString('base64url');
    const codeVerifier = randomBytes(48).toString('base64url');
    await prisma.oAuthState.create({
      data: {
        userId,
        alternateId,
        provider: INTEGRATION_PROVIDER,
        state,
        codeVerifier: encryption.encrypt(codeVerifier),
        expiresAt: new Date(Date.now() + INTEGRATION_OAUTH_STATE_TTL_MS),
      },
    });

    return {
      authorizationUrl: googleIntegrationAdapter.createAuthorizationUrl(state, codeVerifier),
    };
  }

  async finishGoogleOAuth(
    state: string,
    code: string,
  ): Promise<{ alternateId: string; email: string }> {
    const oauthState = await prisma.oAuthState.findUnique({ where: { state } });
    if (
      !oauthState ||
      oauthState.provider !== INTEGRATION_PROVIDER ||
      oauthState.expiresAt <= new Date()
    ) {
      if (oauthState) await prisma.oAuthState.delete({ where: { id: oauthState.id } });
      throw new BusinessError('OAuth state is invalid or expired', 'OAUTH_STATE_INVALID');
    }

    const consumed = await prisma.oAuthState.deleteMany({
      where: { id: oauthState.id, state, expiresAt: { gt: new Date() } },
    });
    if (consumed.count !== 1) {
      throw new BusinessError('OAuth state is invalid or expired', 'OAUTH_STATE_INVALID');
    }

    assertGoogleOAuthConfigured();
    const codeVerifier = encryption.decrypt(oauthState.codeVerifier);
    const token = await googleIntegrationAdapter.exchangeCode(code, codeVerifier);
    const account = await googleIntegrationAdapter.getAccount(token.access_token);
    const alternate = await prisma.alternate.findFirst({
      where: { id: oauthState.alternateId, userId: oauthState.userId, deletedAt: null },
      select: { id: true },
    });
    if (!alternate) throw new NotFoundError('Alternate not found');

    const previous = await prisma.integrationConnection.findUnique({
      where: {
        userId_alternateId_provider: {
          userId: oauthState.userId,
          alternateId: oauthState.alternateId,
          provider: INTEGRATION_PROVIDER,
        },
      },
      select: { encryptedCredentials: true },
    });
    const previousCredentials = previous?.encryptedCredentials
      ? parseCredentials(previous.encryptedCredentials)
      : undefined;
    const credentials: GoogleCredentials = {
      accessToken: token.access_token,
      refreshToken: token.refresh_token ?? previousCredentials?.refreshToken,
      expiresAt: new Date(Date.now() + token.expires_in * 1000).toISOString(),
    };
    const grantedScopes = token.scope ?? GOOGLE_INTEGRATION_SCOPES.join(' ');

    await prisma.integrationConnection.upsert({
      where: {
        userId_alternateId_provider: {
          userId: oauthState.userId,
          alternateId: oauthState.alternateId,
          provider: INTEGRATION_PROVIDER,
        },
      },
      create: {
        userId: oauthState.userId,
        alternateId: oauthState.alternateId,
        provider: INTEGRATION_PROVIDER,
        providerAccountId: account.email,
        status: ACTIVE_STATUS,
        grantedScopes,
        encryptedCredentials: encryption.encrypt(JSON.stringify(credentials)),
        accessTokenExpiresAt: new Date(credentials.expiresAt),
        lastConnectedAt: new Date(),
        disconnectedAt: null,
        lastErrorCode: null,
      },
      update: {
        providerAccountId: account.email,
        status: ACTIVE_STATUS,
        grantedScopes,
        encryptedCredentials: encryption.encrypt(JSON.stringify(credentials)),
        accessTokenExpiresAt: new Date(credentials.expiresAt),
        lastConnectedAt: new Date(),
        disconnectedAt: null,
        lastErrorCode: null,
      },
    });

    logger.info(
      {
        userId: oauthState.userId,
        alternateId: oauthState.alternateId,
        provider: INTEGRATION_PROVIDER,
      },
      'integration.connected',
    );
    return { alternateId: oauthState.alternateId, email: account.email };
  }

  async disconnect(
    userId: string,
    alternateId: string,
    provider: string,
  ): Promise<{ disconnected: boolean; providerRevoked: boolean }> {
    const connection = await prisma.integrationConnection.findFirst({
      where: { userId, alternateId, provider, status: ACTIVE_STATUS },
      select: { id: true, encryptedCredentials: true },
    });
    if (!connection) throw new NotFoundError('Integration connection not found');

    const credentials = parseCredentials(connection.encryptedCredentials);
    const providerRevoked = await googleIntegrationAdapter.revokeToken(
      credentials.refreshToken ?? credentials.accessToken,
    );
    if (!providerRevoked) {
      logger.warn({ userId, alternateId, provider }, 'integration.provider_revocation_unconfirmed');
    }

    await prisma.integrationConnection.update({
      where: { id: connection.id },
      data: {
        status: DISCONNECTED_STATUS,
        encryptedCredentials: '',
        accessTokenExpiresAt: null,
        disconnectedAt: new Date(),
        lastErrorCode: null,
      },
    });
    return { disconnected: true, providerRevoked };
  }

  async listExecutions(userId: string, alternateId: string, page: number, limit: number) {
    const where = { userId, alternateId };
    const [executions, totalCount] = await Promise.all([
      prisma.integrationExecution.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: (page - 1) * limit,
        select: {
          id: true,
          connectionId: true,
          provider: true,
          capability: true,
          status: true,
          requestMetadata: true,
          resultMetadata: true,
          errorCode: true,
          startedAt: true,
          completedAt: true,
          createdAt: true,
        },
      }),
      prisma.integrationExecution.count({ where }),
    ]);
    return { executions, totalCount, page, limit };
  }

  async executeCapability<TCapability extends IntegrationCapability>(
    userId: string,
    alternateId: string,
    capability: TCapability,
    input: IntegrationCapabilityInput[TCapability],
    agentRunId?: string,
    toolExecutionId?: string,
  ): Promise<unknown> {
    const connection = await prisma.integrationConnection.findUnique({
      where: {
        userId_alternateId_provider: {
          userId,
          alternateId,
          provider: INTEGRATION_PROVIDER,
        },
      },
    });
    if (!connection || connection.status !== ACTIVE_STATUS) {
      throw new BusinessError(
        'Connect Google before using this capability',
        'INTEGRATION_NOT_CONNECTED',
      );
    }

    const startedAt = new Date();
    const execution = await prisma.integrationExecution.create({
      data: {
        userId,
        alternateId,
        connectionId: connection.id,
        agentRunId,
        toolExecutionId,
        provider: connection.provider,
        capability,
        status: 'RUNNING',
        requestMetadata: { limit: input.limit },
        resultMetadata: {},
        startedAt,
      },
    });

    try {
      const credentials = await this.getUsableCredentials(connection);
      const result = await googleIntegrationAdapter.execute(
        credentials.accessToken,
        capability,
        input,
      );
      const completedAt = new Date();
      await Promise.all([
        prisma.integrationExecution.update({
          where: { id: execution.id },
          data: {
            status: 'SUCCEEDED',
            resultMetadata: { itemCount: getResultCount(result) },
            completedAt,
          },
        }),
        prisma.integrationConnection.update({
          where: { id: connection.id },
          data: { lastUsedAt: completedAt, lastErrorCode: null },
        }),
      ]);
      return result;
    } catch (error) {
      const errorCode = error instanceof BaseError ? error.code : 'INTEGRATION_EXECUTION_FAILED';
      await Promise.all([
        prisma.integrationExecution.update({
          where: { id: execution.id },
          data: { status: 'FAILED', errorCode, completedAt: new Date() },
        }),
        prisma.integrationConnection.update({
          where: { id: connection.id },
          data: { lastErrorCode: errorCode },
        }),
      ]);
      throw error;
    }
  }

  private async getUsableCredentials(connection: {
    id: string;
    encryptedCredentials: string;
    accessTokenExpiresAt: Date | null;
  }): Promise<GoogleCredentials> {
    const credentials = parseCredentials(connection.encryptedCredentials);
    const expiry = connection.accessTokenExpiresAt ?? new Date(credentials.expiresAt);
    if (expiry.getTime() > Date.now() + 60_000) return credentials;
    if (!credentials.refreshToken) {
      throw new BusinessError(
        'Google authorization expired; reconnect the account',
        'INTEGRATION_REAUTH_REQUIRED',
      );
    }

    const refreshed = await googleIntegrationAdapter.refreshAccessToken(credentials.refreshToken);
    const updatedCredentials: GoogleCredentials = {
      accessToken: refreshed.access_token,
      refreshToken: refreshed.refresh_token ?? credentials.refreshToken,
      expiresAt: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
    };
    await prisma.integrationConnection.update({
      where: { id: connection.id },
      data: {
        encryptedCredentials: encryption.encrypt(JSON.stringify(updatedCredentials)),
        accessTokenExpiresAt: new Date(updatedCredentials.expiresAt),
        lastHealthCheckAt: new Date(),
        lastErrorCode: null,
      },
    });
    return updatedCredentials;
  }
}

export const integrationService = new IntegrationService();

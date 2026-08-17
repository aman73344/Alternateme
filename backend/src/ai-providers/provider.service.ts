import { prisma } from '@/database';
import { createAuditLog } from '@/auth/repositories/audit.repository';
import { NotFoundError, BusinessError } from '@/utils/errors';
import { encryption } from '@/utils/helpers';
import { logger } from '@/utils/logger';
import { ProviderRegistry } from './provider.types';
import { OpenAIAdapter } from './adapters/openai.adapter';
import { AnthropicAdapter } from './adapters/anthropic.adapter';

// Register available provider adapters
ProviderRegistry.register(new OpenAIAdapter());
ProviderRegistry.register(new AnthropicAdapter());

/**
 * ProviderCredentialService
 *
 * Consumed by onboarding and future AI orchestration (Phase 5).
 * Responsibilities:
 *   - Encrypt API keys using AES-256-GCM (never base64)
 *   - Validate provider keys through the adapter abstraction
 *   - Never return or log API keys
 *   - Never expose encrypted keys in responses
 */
export const providerService = {
  async saveProvider(userId: string, data: any) {
    const alternate = await prisma.alternate.findFirst({
      where: { id: data.alternateId, userId, deletedAt: null },
    });

    if (!alternate) {
      throw new NotFoundError('Alternate not found');
    }

    // Validate provider exists
    const provider = data.provider as 'OPENAI' | 'ANTHROPIC';
    if (!ProviderRegistry.has(provider)) {
      throw new BusinessError(`Unsupported provider: ${provider}`, 'INVALID_PROVIDER');
    }

    // Encrypt the API key — never store in plaintext or base64
    const encryptedApiKey = encryption.encrypt(data.apiKey);

    // Validate connectivity through the provider abstraction
    // Fail open: store the key but mark it PENDING if validation fails or times out
    let status = 'PENDING';
    let lastValidatedAt: Date | null = null;

    try {
      const adapter = ProviderRegistry.get(provider);
      const result = await adapter.validateApiKey(data.apiKey);
      if (result.valid) {
        status = 'VALID';
        lastValidatedAt = new Date();
      } else {
        status = 'INVALID';
        lastValidatedAt = new Date();
        logger.warn({ provider, status }, 'AI provider key validation failed');
      }
    } catch (error) {
      // Network failure — keep PENDING, don't reject the whole request
      logger.warn({ provider }, 'AI provider validation could not be completed');
    }

    await prisma.aIProviderConfig.upsert({
      where: { alternateId: data.alternateId },
      create: {
        alternateId: data.alternateId,
        userId,
        provider,
        encryptedApiKey,
        keyLabel: data.keyLabel,
        defaultModel: data.defaultModel,
        status,
        lastValidatedAt,
      },
      update: {
        provider,
        encryptedApiKey,
        keyLabel: data.keyLabel,
        defaultModel: data.defaultModel,
        status,
        lastValidatedAt,
      },
    });

    await createAuditLog({
      userId,
      action: 'AI_PROVIDER_ADDED',
      entity: 'AIProviderConfig',
      entityId: data.alternateId,
      metadata: { provider, status },
    });

    logger.info({ userId, alternateId: data.alternateId, provider, status }, 'AI provider saved');

    // NOTE: Never return the encrypted key
    return { provider, status };
  },

  async removeProvider(userId: string, alternateId: string): Promise<void> {
    const alternate = await prisma.alternate.findFirst({
      where: { id: alternateId, userId, deletedAt: null },
    });

    if (!alternate) {
      throw new NotFoundError('Alternate not found');
    }

    await prisma.aIProviderConfig.delete({
      where: { alternateId },
    });

    await createAuditLog({
      userId,
      action: 'AI_PROVIDER_REMOVED',
      entity: 'AIProviderConfig',
      entityId: alternateId,
    });
  },

  /**
   * Decrypt a provider's API key for use by the AI orchestration layer (Phase 5).
   * Must never be exposed through an API response.
   */
  async getDecryptedApiKey(alternateId: string, userId: string): Promise<{ provider: string; apiKey: string; defaultModel: string | null }> {
    const config = await prisma.aIProviderConfig.findFirst({
      where: { alternateId, userId },
    });

    if (!config) {
      throw new NotFoundError('AI provider configuration not found');
    }

    return {
      provider: config.provider,
      apiKey: encryption.decrypt(config.encryptedApiKey),
      defaultModel: config.defaultModel,
    };
  },
};
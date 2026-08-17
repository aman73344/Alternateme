import { prisma } from '@/database';
import { createAuditLog } from '@/auth/repositories/audit.repository';
import { NotFoundError, BusinessError } from '@/utils/errors';
import { logger } from '@/utils/logger';

export const voiceService = {
  async getProviders() {
    return [
      { provider: 'ELEVENLABS', available: true },
      { provider: 'CARTESIA', available: true },
    ];
  },

  async saveVoice(userId: string, data: any) {
    const alternate = await prisma.alternate.findFirst({
      where: { id: data.alternateId, userId, deletedAt: null },
    });

    if (!alternate) {
      throw new NotFoundError('Alternate not found');
    }

    // Voice cloning must never happen without explicit consent
    if (data.type === 'CLONED_VOICE' && !data.consent) {
      throw new BusinessError('Voice cloning requires explicit consent');
    }

    const voiceData: any = {
      alternateId: data.alternateId,
      userId,
      provider: data.provider,
      voiceId: data.voiceId,
      name: data.name,
      type: data.type,
      consentGiven: data.consent || false,
      status: 'READY',
    };

    if (data.consent) {
      voiceData.consentTimestamp = new Date();
    }

    await prisma.voiceProfile.upsert({
      where: { alternateId: data.alternateId },
      create: voiceData,
      update: voiceData,
    });

    // Record explicit consent event separately for compliance
    if (data.type === 'CLONED_VOICE' && data.consent) {
      await createAuditLog({
        userId,
        action: 'VOICE_CONSENT_GIVEN',
        entity: 'VoiceProfile',
        entityId: data.alternateId,
        metadata: { provider: data.provider, consentTimestamp: new Date().toISOString() },
      });
    }

    await createAuditLog({
      userId,
      action: 'VOICE_SELECTED',
      entity: 'VoiceProfile',
      entityId: data.alternateId,
      metadata: { provider: data.provider, type: data.type },
    });

    logger.info({ userId, alternateId: data.alternateId, provider: data.provider }, 'Voice profile saved');
  },
};
import { prisma } from '@/database';
import { createAuditLog } from '@/auth/repositories/audit.repository';
import { NotFoundError, ConflictError, BusinessError } from '@/utils/errors';
import { encryption } from '@/utils/helpers';
import { logger } from '@/utils/logger';
import { RESERVED_USERNAMES, ONBOARDING_STEP_ORDER, REQUIRED_STEPS_FOR_PUBLISH, OnboardingStep } from './onboarding.constants';

type AlternateVisibility = 'PUBLIC' | 'UNLISTED' | 'PRIVATE';

// Add a step to completedSteps without creating duplicates (idempotency)
function pushStep(completedSteps: OnboardingStep[], step: OnboardingStep): OnboardingStep[] {
  if (!completedSteps.includes(step)) {
    return [...completedSteps, step];
  }
  return completedSteps;
}

// Determine the next onboarding step based on the current step
function getNextStep(currentStep: OnboardingStep): OnboardingStep {
  const currentIndex = ONBOARDING_STEP_ORDER.indexOf(currentStep);
  if (currentIndex === -1 || currentIndex >= ONBOARDING_STEP_ORDER.length - 1) {
    return ONBOARDING_STEP_ORDER[ONBOARDING_STEP_ORDER.length - 1];
  }
  return ONBOARDING_STEP_ORDER[currentIndex + 1];
}

// Validate username against reserved list
function assertUsernameAllowed(username: string): void {
  const normalized = username.toLowerCase().trim();
  if (RESERVED_USERNAMES.includes(normalized)) {
    throw new ConflictError('This username is reserved and cannot be used');
  }
}

export const onboardingService = {
  async startOnboarding(userId: string, data: { username: string; displayName: string; title?: string; bio?: string; avatarUrl?: string; visibility?: string }): Promise<{ alternateId: string; onboardingId: string }> {
    const normalizedUsername = data.username.toLowerCase().trim();

    assertUsernameAllowed(normalizedUsername);

    const existingAlternate = await prisma.alternate.findFirst({
      where: { username: normalizedUsername, deletedAt: null },
      select: { id: true },
    });

    if (existingAlternate) {
      throw new ConflictError('Username is already taken');
    }

    const alternate = await prisma.alternate.create({
      data: {
        userId,
        username: normalizedUsername,
        displayName: data.displayName,
        title: data.title,
        bio: data.bio,
        avatarUrl: data.avatarUrl,
        visibility: (data.visibility as AlternateVisibility) || 'PRIVATE',
        status: 'DRAFT',
      },
    });

    const onboarding = await prisma.onboarding.create({
      data: {
        userId,
        alternateId: alternate.id,
        currentStep: 'PERSONAL',
        completedSteps: [],
        status: 'IN_PROGRESS',
        startedAt: new Date(),
      },
    });

    await createAuditLog({
      userId,
      action: 'ONBOARDING_STARTED',
      entity: 'Onboarding',
      entityId: onboarding.id,
      newValue: { alternateId: alternate.id, username: alternate.username },
    });

    logger.info({ userId, alternateId: alternate.id, onboardingId: onboarding.id }, 'Onboarding started');

    return { alternateId: alternate.id, onboardingId: onboarding.id };
  },

  async getOnboardingStatus(userId: string): Promise<any> {
    const onboarding = await prisma.onboarding.findFirst({
      where: { userId },
      include: { alternate: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!onboarding) {
      return { status: 'NOT_STARTED', currentStep: null, completedSteps: [], alternateId: null };
    }

    return {
      status: onboarding.status,
      currentStep: onboarding.currentStep,
      completedSteps: onboarding.completedSteps,
      alternateId: onboarding.alternateId,
      startedAt: onboarding.startedAt,
      completedAt: onboarding.completedAt,
    };
  },

  async savePersonalInfo(userId: string, data: { alternateId: string; displayName: string; title?: string; bio?: string; username: string }): Promise<void> {
    // Verify ownership
    const alternate = await prisma.alternate.findFirst({
      where: { id: data.alternateId, userId, deletedAt: null },
    });

    if (!alternate) {
      throw new NotFoundError('Alternate not found');
    }

    const normalizedUsername = data.username.toLowerCase().trim();

    assertUsernameAllowed(normalizedUsername);

    if (normalizedUsername !== alternate.username) {
      const existing = await prisma.alternate.findFirst({
        where: { username: normalizedUsername, deletedAt: null, id: { not: data.alternateId } },
        select: { id: true },
      });

      if (existing) {
        throw new ConflictError('Username is already taken');
      }
    }

    await prisma.alternate.update({
      where: { id: data.alternateId },
      data: {
        displayName: data.displayName,
        title: data.title,
        bio: data.bio,
        username: normalizedUsername,
      },
    });

    // Idempotent step completion
    const onboarding = await prisma.onboarding.findFirst({
      where: { alternateId: data.alternateId, userId },
    });

    if (onboarding) {
      await prisma.onboarding.update({
        where: { id: onboarding.id },
        data: {
          currentStep: OnboardingStep.SOURCES,
          completedSteps: pushStep(onboarding.completedSteps as OnboardingStep[], OnboardingStep.PERSONAL),
          status: 'IN_PROGRESS',
        },
      });
    }

    await createAuditLog({
      userId,
      action: 'ALTERNATE_UPDATED',
      entity: 'Alternate',
      entityId: data.alternateId,
      newValue: { username: normalizedUsername, displayName: data.displayName },
    });
  },

  async savePersona(userId: string, data: { alternateId: string; tone?: string; writingStyle?: string; personality?: string; instructions?: string; boundaries?: string; refusalBehavior?: string }): Promise<void> {
    const alternate = await prisma.alternate.findFirst({
      where: { id: data.alternateId, userId, deletedAt: null },
    });

    if (!alternate) {
      throw new NotFoundError('Alternate not found');
    }

    await prisma.persona.upsert({
      where: { alternateId: data.alternateId },
      create: {
        alternateId: data.alternateId,
        userId,
        tone: data.tone,
        writingStyle: data.writingStyle,
        personality: data.personality,
        instructions: data.instructions,
        boundaries: data.boundaries,
        refusalBehavior: data.refusalBehavior,
      },
      update: {
        tone: data.tone,
        writingStyle: data.writingStyle,
        personality: data.personality,
        instructions: data.instructions,
        boundaries: data.boundaries,
        refusalBehavior: data.refusalBehavior,
      },
    });

    const onboarding = await prisma.onboarding.findFirst({
      where: { alternateId: data.alternateId, userId },
    });

    if (onboarding) {
      await prisma.onboarding.update({
        where: { id: onboarding.id },
        data: {
          currentStep: OnboardingStep.VOICE,
          completedSteps: pushStep(onboarding.completedSteps as OnboardingStep[], OnboardingStep.PERSONA),
        },
      });
    }

    await createAuditLog({
      userId,
      action: 'PERSONA_UPDATED',
      entity: 'Persona',
      entityId: data.alternateId,
    });
  },

  async saveVoice(userId: string, data: { alternateId: string; provider: string; voiceId: string; name: string; type: string; consent?: boolean }): Promise<void> {
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

    // If consent was given, record a separate consent audit event
    if (data.type === 'CLONED_VOICE' && data.consent) {
      await createAuditLog({
        userId,
        action: 'VOICE_CONSENT_GIVEN',
        entity: 'VoiceProfile',
        entityId: data.alternateId,
        metadata: { provider: data.provider, consentTimestamp: new Date().toISOString() },
      });
    }

    const onboarding = await prisma.onboarding.findFirst({
      where: { alternateId: data.alternateId, userId },
    });

    if (onboarding) {
      await prisma.onboarding.update({
        where: { id: onboarding.id },
        data: {
          currentStep: OnboardingStep.AI_PROVIDER,
          completedSteps: pushStep(onboarding.completedSteps as OnboardingStep[], OnboardingStep.VOICE),
        },
      });
    }

    await createAuditLog({
      userId,
      action: 'VOICE_SELECTED',
      entity: 'VoiceProfile',
      entityId: data.alternateId,
      metadata: { provider: data.provider, type: data.type },
    });
  },

  async saveAIProvider(userId: string, data: { alternateId: string; provider: string; apiKey: string; keyLabel?: string; defaultModel?: string }): Promise<{ provider: string; status: string }> {
    const alternate = await prisma.alternate.findFirst({
      where: { id: data.alternateId, userId, deletedAt: null },
    });

    if (!alternate) {
      throw new NotFoundError('Alternate not found');
    }

    // Encrypt the API key with AES-256-GCM — never base64, never plaintext.
    // We DO NOT claim the key is valid here: during onboarding the key is stored
    // as PENDING and is only validated later (Phase 5 / live BYOK management).
    // This avoids false "VALID" status and any external network dependency in the
    // onboarding flow. If a key was previously marked INVALID, re-saving it here
    // resets it to PENDING so a corrected key can pass publish.
    const encryptedApiKey = encryption.encrypt(data.apiKey);

    await prisma.aIProviderConfig.upsert({
      where: { alternateId: data.alternateId },
      create: {
        alternateId: data.alternateId,
        userId,
        provider: data.provider as any,
        encryptedApiKey,
        keyLabel: data.keyLabel,
        defaultModel: data.defaultModel,
        status: 'PENDING',
        lastValidatedAt: null,
      },
      update: {
        provider: data.provider as any,
        encryptedApiKey,
        keyLabel: data.keyLabel,
        defaultModel: data.defaultModel,
        status: 'PENDING',
        lastValidatedAt: null,
      },
    });

    const onboarding = await prisma.onboarding.findFirst({
      where: { alternateId: data.alternateId, userId },
    });

    if (onboarding) {
      await prisma.onboarding.update({
        where: { id: onboarding.id },
        data: {
          currentStep: OnboardingStep.PUBLISH,
          completedSteps: pushStep(onboarding.completedSteps as OnboardingStep[], OnboardingStep.AI_PROVIDER),
        },
      });
    }

    await createAuditLog({
      userId,
      action: 'AI_PROVIDER_ADDED',
      entity: 'AIProviderConfig',
      entityId: data.alternateId,
      metadata: { provider: data.provider },
    });

    // Never return the encrypted key
    return { provider: data.provider, status: 'PENDING' };
  },

  async completeStep(userId: string, alternateId: string, step: string): Promise<{ currentStep: string; completedSteps: string[] }> {
    const alternate = await prisma.alternate.findFirst({
      where: { id: alternateId, userId, deletedAt: null },
    });

    if (!alternate) {
      throw new NotFoundError('Alternate not found');
    }

    const onboarding = await prisma.onboarding.findFirst({
      where: { alternateId, userId },
    });

    if (!onboarding) {
      throw new NotFoundError('Onboarding not found');
    }

    // The server is the source of truth — verify the required data actually exists
    switch (step) {
      case 'PERSONAL': {
        if (!alternate.username || !alternate.displayName) {
          throw new BusinessError('Personal information is required before completing this step');
        }
        break;
      }
      case 'SOURCES': {
        // Sources are optional per SRS — mark complete if at least one source exists OR skip is allowed
        break;
      }
      case 'PERSONA': {
        const persona = await prisma.persona.findUnique({ where: { alternateId } });
        if (!persona) {
          throw new BusinessError('Persona configuration is required before completing this step');
        }
        break;
      }
      case 'VOICE': {
        const voiceProfile = await prisma.voiceProfile.findUnique({ where: { alternateId } });
        if (!voiceProfile) {
          throw new BusinessError('Voice configuration is required before completing this step');
        }
        break;
      }
      case 'AI_PROVIDER': {
        const providerConfig = await prisma.aIProviderConfig.findUnique({ where: { alternateId } });
        if (!providerConfig || providerConfig.status === 'INVALID') {
          throw new BusinessError('A valid AI provider configuration is required before completing this step');
        }
        break;
      }
      case 'PUBLISH': {
        break;
      }
      default:
        throw new BusinessError(`Unknown step: ${step}`);
    }

    const updatedCompletedSteps = pushStep(onboarding.completedSteps as OnboardingStep[], step as OnboardingStep);
    const nextStep = getNextStep(step as OnboardingStep);

    await prisma.onboarding.update({
      where: { id: onboarding.id },
      data: {
        completedSteps: updatedCompletedSteps,
        currentStep: (step === 'PUBLISH' ? OnboardingStep.PUBLISH : nextStep),
        status: 'IN_PROGRESS',
      },
    });

    return {
      currentStep: step === 'PUBLISH' ? 'PUBLISH' : nextStep,
      completedSteps: updatedCompletedSteps,
    };
  },

  async publishAlternate(userId: string, alternateId: string): Promise<{ publicUrl: string }> {
    const alternate = await prisma.alternate.findFirst({
      where: { id: alternateId, userId, deletedAt: null },
      include: { onboarding: true, persona: true, voiceProfile: true, aiProvider: true },
    });

    if (!alternate) {
      throw new NotFoundError('Alternate not found');
    }

    // Validate all required data exists (server is source of truth)
    if (!alternate.username || !alternate.displayName) {
      throw new BusinessError('Personal information is required before publishing');
    }

    if (!alternate.persona) {
      throw new BusinessError('Persona configuration is required before publishing');
    }

    if (!alternate.aiProvider || alternate.aiProvider.status === 'INVALID') {
      throw new BusinessError('A valid AI provider configuration is required before publishing');
    }

    // Check required steps are complete (if onboarding exists)
    if (alternate.onboarding) {
      const completedSet = new Set((alternate.onboarding.completedSteps as any) || []);
      const missingRequired = REQUIRED_STEPS_FOR_PUBLISH.filter((step) => !completedSet.has(step));
      if (missingRequired.length > 0) {
        throw new BusinessError(`Required onboarding steps not completed: ${missingRequired.join(', ')}`);
      }
    }

    const publicUrl = `https://alternate.me/${alternate.username}`;

    // Transactional publish — update Alternate and Onboarding atomically
    // Derive transaction client type from prisma's $transaction signature
    await prisma.$transaction(async (tx: Parameters<typeof prisma.$transaction>[0] extends (tx: infer T) => unknown ? T : never) => {
      await tx.alternate.update({
        where: { id: alternateId },
        data: {
          status: 'PUBLISHED',
          publishedAt: new Date(),
        },
      });

      // Also ensure visibility is PUBLIC for public URL access
      await tx.alternate.update({
        where: { id: alternateId },
        data: {
          visibility: 'PUBLIC',
        },
      });

      await tx.onboarding.updateMany({
        where: { alternateId, userId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          currentStep: OnboardingStep.PUBLISH,
          completedSteps: pushStep((alternate.onboarding?.completedSteps as OnboardingStep[]) || [], OnboardingStep.PUBLISH),
        },
      });
    });

    await createAuditLog({
      userId,
      action: 'ONBOARDING_COMPLETED',
      entity: 'Onboarding',
      entityId: alternateId,
    });

    await createAuditLog({
      userId,
      action: 'ALTERNATE_PUBLISHED',
      entity: 'Alternate',
      entityId: alternateId,
      newValue: { username: alternate.username, publicUrl },
    });

    logger.info({ userId, alternateId, username: alternate.username, publicUrl }, 'Alternate published');

    return { publicUrl };
  },

  async getPreview(userId: string, alternateId: string): Promise<any> {
    // Enforce ownership on preview
    const alternate = await prisma.alternate.findFirst({
      where: { id: alternateId, userId, deletedAt: null },
      include: {
        persona: true,
        voiceProfile: true,
        aiProvider: { select: { provider: true, status: true } },
        sources: { where: { status: { not: 'DELETED' } } },
      },
    });

    if (!alternate) {
      throw new NotFoundError('Alternate not found');
    }

    const sources = alternate.sources || [];
    const readyCount = sources.filter((s: any) => s.status === 'READY').length;
    const pendingCount = sources.filter((s: any) => s.status === 'PENDING' || s.status === 'PROCESSING').length;

    return {
      alternate: {
        displayName: alternate.displayName,
        title: alternate.title,
        bio: alternate.bio,
        avatarUrl: alternate.avatarUrl,
        username: alternate.username,
      },
      persona: alternate.persona ? {
        tone: alternate.persona.tone,
        writingStyle: alternate.persona.writingStyle,
        personality: alternate.persona.personality,
      } : null,
      sources: {
        count: sources.length,
        ready: readyCount,
        pending: pendingCount,
      },
      voice: {
        configured: !!alternate.voiceProfile,
      },
      aiProvider: alternate.aiProvider ? {
        provider: alternate.aiProvider.provider,
        configured: true,
      } : {
        configured: false,
      },
    };
  },
};
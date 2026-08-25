import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { prisma } from '@/database';
import { alternateService } from '@/alternates/alternate.service';
import { onboardingService } from '@/onboarding/onboarding.service';
import { sourceService } from '@/sources/source.service';
import { encryption } from '@/utils/helpers';
import { ConflictError, NotFoundError, BusinessError } from '@/utils/errors';

describe('Alternates Module', () => {
  beforeEach(async () => {
    // Clean up ONLY records owned by this suite's @test.com users.
    // Never run unfiltered deleteMany() against a shared database —
    // that would wipe real users and all of their onboarding data.
    const scope = { user: { email: { endsWith: '@test.com' } } };
    await prisma.trainingSource.deleteMany({ where: scope });
    await prisma.aIProviderConfig.deleteMany({ where: scope });
    await prisma.voiceProfile.deleteMany({ where: scope });
    await prisma.persona.deleteMany({ where: scope });
    await prisma.onboarding.deleteMany({ where: scope });
    await prisma.alternate.deleteMany({ where: scope });
    await prisma.user.deleteMany({ where: { email: { endsWith: '@test.com' } } });
  });

  // Final cleanup so the suite never leaves test data behind.
  afterAll(async () => {
    const scope = { user: { email: { endsWith: '@test.com' } } };
    await prisma.trainingSource.deleteMany({ where: scope });
    await prisma.aIProviderConfig.deleteMany({ where: scope });
    await prisma.voiceProfile.deleteMany({ where: scope });
    await prisma.persona.deleteMany({ where: scope });
    await prisma.onboarding.deleteMany({ where: scope });
    await prisma.alternate.deleteMany({ where: scope });
    await prisma.user.deleteMany({ where: { email: { endsWith: '@test.com' } } });
  });

  async function createUser(email: string, username: string) {
    return prisma.user.create({
      data: {
        email,
        username,
        role: 'USER',
      },
    });
  }

  describe('Alternate CRUD', () => {
    it('should create an alternate', async () => {
      const user = await createUser('create@test.com', 'createuser');

      const alternate = await alternateService.createAlternate(user.id, {
        username: 'my-alternate',
        displayName: 'My Alternate',
      });

      expect(alternate.username).toBe('my-alternate');
      expect(alternate.displayName).toBe('My Alternate');
      expect(alternate.status).toBe('DRAFT');
    });

    it('should enforce unique usernames', async () => {
      const user = await createUser('unique@test.com', 'uniqueuser');

      await alternateService.createAlternate(user.id, {
        username: 'unique-username',
        displayName: 'First',
      });

      await expect(
        alternateService.createAlternate(user.id, {
          username: 'unique-username',
          displayName: 'Second',
        })
      ).rejects.toThrow();
    });

    it('should reject reserved usernames', async () => {
      const user = await createUser('reserved@test.com', 'reserveduser');

      await expect(
        alternateService.createAlternate(user.id, {
          username: 'admin',
          displayName: 'Admin Wannabe',
        })
      ).rejects.toThrow(ConflictError);
    });

    it('should check username availability case-insensitively', async () => {
      const user = await createUser('avail@test.com', 'availuser');
      await alternateService.createAlternate(user.id, {
        username: 'john-doe',
        displayName: 'John',
      });

      const taken = await alternateService.checkUsernameAvailability('JOHN-DOE');
      expect(taken.available).toBe(false);

      const free = await alternateService.checkUsernameAvailability('jane-doe');
      expect(free.available).toBe(true);
    });

    it('should reject reserved usernames in availability check', async () => {
      const result = await alternateService.checkUsernameAvailability('support');
      expect(result.available).toBe(false);
    });

    it('should not allow user A to access user B alternate', async () => {
      const userA = await createUser('a@test.com', 'usera');
      const userB = await createUser('b@test.com', 'userb');

      const alternate = await alternateService.createAlternate(userA.id, {
        username: 'alices-alt',
        displayName: 'Alice',
      });

      const result = await alternateService.getAlternateById(alternate.id, userB.id);
      expect(result).toBeNull();
    });

    it('should not allow user A to delete user B alternate', async () => {
      const userA = await createUser('a2@test.com', 'usera2');
      const userB = await createUser('b2@test.com', 'userb2');

      const alternate = await alternateService.createAlternate(userA.id, {
        username: 'alices-alt2',
        displayName: 'Alice 2',
      });

      await expect(
        alternateService.deleteAlternate(alternate.id, userB.id)
      ).rejects.toThrow(NotFoundError);
    });

    it('should soft delete an alternate', async () => {
      const user = await createUser('del@test.com', 'deluser');
      const alternate = await alternateService.createAlternate(user.id, {
        username: 'delete-me',
        displayName: 'Delete Me',
      });

      await alternateService.deleteAlternate(alternate.id, user.id);

      const found = await alternateService.getAlternateById(alternate.id, user.id);
      expect(found).toBeNull();
    });
  });

  describe('Onboarding', () => {
    it('should start onboarding', async () => {
      const user = await createUser('onboard@test.com', 'onboarduser');

      const result = await onboardingService.startOnboarding(user.id, {
        username: 'onboard-alt',
        displayName: 'Onboard Alternate',
      });

      expect(result.alternateId).toBeDefined();
      expect(result.onboardingId).toBeDefined();

      const status = await onboardingService.getOnboardingStatus(user.id);
      expect(status.status).toBe('IN_PROGRESS');
      expect(status.currentStep).toBe('PERSONAL');
      expect(status.completedSteps).toEqual([]);
    });

    it('should resume onboarding with state', async () => {
      const user = await createUser('resume@test.com', 'resumeuser');

      const { alternateId } = await onboardingService.startOnboarding(user.id, {
        username: 'resume-alt',
        displayName: 'Resume Alternate',
      });

      await onboardingService.savePersonalInfo(user.id, {
        alternateId,
        displayName: 'Resume Alternate',
        username: 'resume-alt',
      });

      const status = await onboardingService.getOnboardingStatus(user.id);
      expect(status.currentStep).toBe('SOURCES');
      expect(status.completedSteps).toContain('PERSONAL');
    });

    it('should save personal info and advance step', async () => {
      const user = await createUser('personal@test.com', 'personaluser');
      const { alternateId } = await onboardingService.startOnboarding(user.id, {
        username: 'personal-alt',
        displayName: 'Personal Alt',
      });

      await onboardingService.savePersonalInfo(user.id, {
        alternateId,
        displayName: 'Updated Name',
        title: 'Senior Engineer',
        bio: 'A bio',
        username: 'personal-alt',
      });

      const alternate = await prisma.alternate.findUnique({ where: { id: alternateId } });
      expect(alternate?.displayName).toBe('Updated Name');
      expect(alternate?.title).toBe('Senior Engineer');
    });

    it('should save persona and advance to VOICE', async () => {
      const user = await createUser('persona@test.com', 'personauser');
      const { alternateId } = await onboardingService.startOnboarding(user.id, {
        username: 'persona-alt',
        displayName: 'Persona Alt',
      });

      await onboardingService.savePersona(user.id, {
        alternateId,
        tone: 'Professional',
        writingStyle: 'Concise',
        boundaries: 'No personal opinions',
      });

      const persona = await prisma.persona.findUnique({ where: { alternateId } });
      expect(persona?.tone).toBe('Professional');

      const status = await onboardingService.getOnboardingStatus(user.id);
      expect(status.completedSteps).toContain('PERSONA');
      expect(status.currentStep).toBe('VOICE');
    });

    it('should be idempotent when saving persona twice', async () => {
      const user = await createUser('idem@test.com', 'idemuser');
      const { alternateId } = await onboardingService.startOnboarding(user.id, {
        username: 'idem-alt',
        displayName: 'Idem Alt',
      });

      await onboardingService.savePersona(user.id, { alternateId, tone: 'Tone 1' });
      await onboardingService.savePersona(user.id, { alternateId, tone: 'Tone 2' });

      const personas = await prisma.persona.count({ where: { alternateId } });
      expect(personas).toBe(1);

      const status = await onboardingService.getOnboardingStatus(user.id);
      const count = status.completedSteps.filter((s: string) => s === 'PERSONA').length;
      expect(count).toBe(1);
    });

    it('should configure voice with consent for cloned voice', async () => {
      const user = await createUser('voice@test.com', 'voiceuser');
      const { alternateId } = await onboardingService.startOnboarding(user.id, {
        username: 'voice-alt',
        displayName: 'Voice Alt',
      });

      await onboardingService.saveVoice(user.id, {
        alternateId,
        provider: 'ELEVENLABS',
        voiceId: 'voice_123',
        name: 'My Voice',
        type: 'CLONED_VOICE',
        consent: true,
      });

      const voice = await prisma.voiceProfile.findUnique({ where: { alternateId } });
      expect(voice?.type).toBe('CLONED_VOICE');
      expect(voice?.consentGiven).toBe(true);
      expect(voice?.consentTimestamp).toBeDefined();
    });

    it('should reject cloned voice without consent', async () => {
      const user = await createUser('noconsent@test.com', 'noconsentuser');
      const { alternateId } = await onboardingService.startOnboarding(user.id, {
        username: 'noconsent-alt',
        displayName: 'No Consent Alt',
      });

      await expect(
        onboardingService.saveVoice(user.id, {
          alternateId,
          provider: 'ELEVENLABS',
          voiceId: 'voice_123',
          name: 'My Voice',
          type: 'CLONED_VOICE',
          consent: false,
        })
      ).rejects.toThrow(BusinessError);
    });

    it('should configure AI provider with encrypted key', async () => {
      const user = await createUser('provider@test.com', 'provideruser');
      const { alternateId } = await onboardingService.startOnboarding(user.id, {
        username: 'provider-alt',
        displayName: 'Provider Alt',
      });

      const result = await onboardingService.saveAIProvider(user.id, {
        alternateId,
        provider: 'OPENAI',
        apiKey: 'sk-test-secret-key-123456789',
        defaultModel: 'gpt-4o',
      });

      expect(result.provider).toBe('OPENAI');
      // Key stored encrypted as PENDING — live validation deferred (Phase 5)
      expect(result.status).toBe('PENDING');

      const config = await prisma.aIProviderConfig.findUnique({ where: { alternateId } });
      expect(config?.encryptedApiKey).toBeDefined();
      // Must NOT be plaintext or base64 — must be encrypted
      expect(config?.encryptedApiKey).not.toContain('sk-test-secret-key-123456789');
      // Verify it decrypts back
      expect(encryption.decrypt(config!.encryptedApiKey)).toBe('sk-test-secret-key-123456789');
    });

    it('should not publish without persona', async () => {
      const user = await createUser('nopersona@test.com', 'nopersonauser');
      const { alternateId } = await onboardingService.startOnboarding(user.id, {
        username: 'nopersona-alt',
        displayName: 'No Persona',
      });

      await onboardingService.savePersonalInfo(user.id, {
        alternateId,
        displayName: 'No Persona',
        username: 'nopersona-alt',
      });

      await expect(
        onboardingService.publishAlternate(user.id, alternateId)
      ).rejects.toThrow(BusinessError);
    });

    it('should not publish without AI provider', async () => {
      const user = await createUser('noprovider@test.com', 'noprovideruser');
      const { alternateId } = await onboardingService.startOnboarding(user.id, {
        username: 'noprovider-alt',
        displayName: 'No Provider',
      });

      await onboardingService.savePersonalInfo(user.id, {
        alternateId,
        displayName: 'No Provider',
        username: 'noprovider-alt',
      });

      await onboardingService.savePersona(user.id, {
        alternateId,
        tone: 'Professional',
      });

      await expect(
        onboardingService.publishAlternate(user.id, alternateId)
      ).rejects.toThrow(BusinessError);
    });

    // The full publish flow performs dozens of sequential round-trips to the
    // remote Postgres (Neon); allow a generous timeout for this test.
    it('should publish successfully with required steps completed', { timeout: 120_000 }, async () => {
      const user = await createUser('publish@test.com', 'publishuser');
      const { alternateId } = await onboardingService.startOnboarding(user.id, {
        username: 'publish-alt',
        displayName: 'Publish Alt',
      });

      await onboardingService.savePersonalInfo(user.id, {
        alternateId,
        displayName: 'Publish Alt',
        username: 'publish-alt',
      });

      await onboardingService.savePersona(user.id, {
        alternateId,
        tone: 'Professional',
      });

      await onboardingService.saveAIProvider(user.id, {
        alternateId,
        provider: 'ANTHROPIC',
        apiKey: 'sk-ant-test-secret-123456',
        defaultModel: 'claude-sonnet-4-20250514',
      });

      const result = await onboardingService.publishAlternate(user.id, alternateId);

      expect(result.publicUrl).toBe('https://alternate.me/publish-alt');

      const alternate = await prisma.alternate.findUnique({ where: { id: alternateId } });
      expect(alternate?.status).toBe('PUBLISHED');
      expect(alternate?.visibility).toBe('PUBLIC');
      expect(alternate?.publishedAt).toBeDefined();

      const onboarding = await prisma.onboarding.findFirst({ where: { alternateId, userId: user.id } });
      expect(onboarding?.status).toBe('COMPLETED');
      expect(onboarding?.completedAt).toBeDefined();
    });

    it('should not allow user B to publish user A alternate', async () => {
      const userA = await createUser('a3@test.com', 'usera3');
      const userB = await createUser('b3@test.com', 'userb3');

      const { alternateId } = await onboardingService.startOnboarding(userA.id, {
        username: 'a3-alt',
        displayName: 'A3 Alt',
      });

      await expect(
        onboardingService.publishAlternate(userB.id, alternateId)
      ).rejects.toThrow(NotFoundError);
    });

    it('should reject duplicate username during onboarding', async () => {
      const user = await createUser('dup@test.com', 'dupuser');
      await onboardingService.startOnboarding(user.id, {
        username: 'taken-alt',
        displayName: 'Taken',
      });

      await expect(
        onboardingService.startOnboarding(user.id, {
          username: 'taken-alt',
          displayName: 'Taken Again',
        })
      ).rejects.toThrow(ConflictError);
    });

    it('should verify server-side step completion', async () => {
      const user = await createUser('verify@test.com', 'verifyuser');
      const { alternateId } = await onboardingService.startOnboarding(user.id, {
        username: 'verify-alt',
        displayName: 'Verify Alt',
      });

      // Cannot complete AI_PROVIDER without a provider config
      await expect(
        onboardingService.completeStep(user.id, alternateId, 'AI_PROVIDER')
      ).rejects.toThrow(BusinessError);
    });

    it('should preview alternate without exposing secrets', async () => {
      const user = await createUser('preview@test.com', 'previewuser');
      const { alternateId } = await onboardingService.startOnboarding(user.id, {
        username: 'preview-alt',
        displayName: 'Preview Alt',
      });

      await onboardingService.savePersonalInfo(user.id, {
        alternateId,
        displayName: 'Preview Alt',
        bio: 'A preview bio',
        username: 'preview-alt',
      });

      const preview = await onboardingService.getPreview(user.id, alternateId);

      expect(preview.alternate.displayName).toBe('Preview Alt');
      expect(preview.alternate.bio).toBe('A preview bio');
      expect(preview.persona).toBeNull();
      expect(preview.aiProvider.configured).toBe(false);
      // Must NEVER expose API keys
      expect(JSON.stringify(preview)).not.toContain('encryptedApiKey');
      expect(JSON.stringify(preview)).not.toContain('apiKey');
    });

    it('should not allow preview of another user alternate', async () => {
      const userA = await createUser('a4@test.com', 'usera4');
      const userB = await createUser('b4@test.com', 'userb4');

      const { alternateId } = await onboardingService.startOnboarding(userA.id, {
        username: 'a4-alt',
        displayName: 'A4 Alt',
      });

      await expect(
        onboardingService.getPreview(userB.id, alternateId)
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('Sources', () => {
    it('should add a source and return PENDING status', async () => {
      const user = await createUser('source@test.com', 'sourceuser');
      const { alternateId } = await onboardingService.startOnboarding(user.id, {
        username: 'source-alt',
        displayName: 'Source Alt',
      });

      const source = await sourceService.createSource(user.id, {
        alternateId,
        type: 'URL',
        name: 'Example',
        url: 'https://example.com',
        origin: 'MANUAL',
      });

      expect(source.status).toBe('PENDING');
    });

    it('should list sources for an alternate', async () => {
      const user = await createUser('listsrc@test.com', 'listsrcuser');
      const { alternateId } = await onboardingService.startOnboarding(user.id, {
        username: 'listsrc-alt',
        displayName: 'List Source Alt',
      });

      await sourceService.createSource(user.id, {
        alternateId,
        type: 'URL',
        name: 'Source 1',
        url: 'https://example.com',
      });

      const sources = await sourceService.getSources(alternateId, user.id);
      expect(sources).toHaveLength(1);
    });

    it('should delete a source with soft delete', async () => {
      const user = await createUser('delsrc@test.com', 'delsrcuser');
      const { alternateId } = await onboardingService.startOnboarding(user.id, {
        username: 'delsrc-alt',
        displayName: 'Delete Source Alt',
      });

      const source = await sourceService.createSource(user.id, {
        alternateId,
        type: 'URL',
        name: 'Delete Me',
        url: 'https://example.com',
      });

      await sourceService.deleteSource(source.id, user.id);

      const found = await prisma.trainingSource.findUnique({ where: { id: source.id } });
      expect(found?.status).toBe('DELETED');

      const sources = await sourceService.getSources(alternateId, user.id);
      expect(sources).toHaveLength(0);
    });

    it('should not allow user B to delete user A source', async () => {
      const userA = await createUser('a5@test.com', 'usera5');
      const userB = await createUser('b5@test.com', 'userb5');
      const { alternateId } = await onboardingService.startOnboarding(userA.id, {
        username: 'a5-alt',
        displayName: 'A5 Alt',
      });

      const source = await sourceService.createSource(userA.id, {
        alternateId,
        type: 'URL',
        name: 'A5 Source',
        url: 'https://example.com',
      });

      await expect(
        sourceService.deleteSource(source.id, userB.id)
      ).rejects.toThrow(NotFoundError);
    });
  });
});
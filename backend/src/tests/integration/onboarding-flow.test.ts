import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/database';
import { encryption } from '@/utils/helpers';

const BASE = 'http://localhost:4000/api/v1';

interface ApiResponse {
  status: number;
  data: any;
}

async function api(method: string, path: string, body?: any, token?: string): Promise<ApiResponse> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch {}
  return { status: res.status, data };
}

describe('Onboarding Flow Integration Tests', () => {
  const suffix = Date.now().toString(36);
  const userA = {
    name: `Test A ${suffix}`,
    username: `testa_${suffix}`,
    email: `testa_${suffix}@example.com`,
    password: 'TestPass123!',
  };
  const userB = {
    name: `Test B ${suffix}`,
    username: `testb_${suffix}`,
    email: `testb_${suffix}@example.com`,
    password: 'TestPass123!',
  };

  let tokenA: string;
  let tokenB: string;
  let alternateId: string;
  let sourceId: string;

  // Test 1: Register → Login → Current User
  describe('Authentication', () => {
    it('registers User A', async () => {
      const res = await api('POST', '/auth/register', userA);
      expect(res.status).toBe(201);
      expect(res.data.data.accessToken).toBeDefined();
      tokenA = res.data.data.accessToken;
    });

    it('registers User B', async () => {
      const res = await api('POST', '/auth/register', userB);
      expect(res.status).toBe(201);
      expect(res.data.data.accessToken).toBeDefined();
      tokenB = res.data.data.accessToken;
    });

    it('rejects login with unverified email', async () => {
      const res = await api('POST', '/auth/login', { email: userA.email, password: userA.password });
      expect(res.status).toBe(403);
    });

    it('gets current user with registration token', async () => {
      const res = await api('GET', '/me', null, tokenA);
      expect(res.status).toBe(200);
      expect(res.data.data.email).toBe(userA.email);
    });
  });

  // Test 2: Create Alternate
  describe('Alternate Creation', () => {
    it('starts onboarding and creates alternate', async () => {
      const res = await api('POST', '/onboarding/start', {
        username: `alt_${suffix}`,
        displayName: 'Test Alternate',
        title: 'Software Engineer',
        bio: 'Test bio',
      }, tokenA);
      expect(res.status).toBe(201);
      expect(res.data.data.alternateId).toBeDefined();
      alternateId = res.data.data.alternateId;
    });

    it('rejects duplicate username', async () => {
      const res = await api('POST', '/onboarding/start', {
        username: `alt_${suffix}`,
        displayName: 'Duplicate',
      }, tokenB);
      expect(res.status).toBe(409);
    });

    it('rejects reserved username', async () => {
      const res = await api('POST', '/onboarding/start', {
        username: 'admin',
        displayName: 'Admin',
      }, tokenB);
      expect(res.status).toBe(409);
    });
  });

  // Test 3: Onboarding
  describe('Onboarding', () => {
    it('gets onboarding status', async () => {
      const res = await api('GET', '/onboarding', null, tokenA);
      expect(res.status).toBe(200);
      expect(res.data.data.status).toBe('IN_PROGRESS');
    });

    it('saves personal info', async () => {
      const res = await api('POST', '/onboarding/personal', {
        alternateId,
        displayName: 'Updated Name',
        title: 'Senior Engineer',
        bio: 'Updated bio',
        username: `alt_${suffix}`,
      }, tokenA);
      expect(res.status).toBe(200);
    });

    it('rejects unauthenticated access', async () => {
      const res = await api('GET', '/onboarding');
      expect(res.status).toBe(401);
    });
  });

  // Test 4: Persona
  describe('Persona', () => {
    it('saves persona', async () => {
      const res = await api('PUT', '/onboarding/persona', {
        alternateId,
        tone: 'Professional',
        writingStyle: 'Clear',
        personality: 'Friendly',
        instructions: 'Be polite',
        boundaries: 'No personal data',
      }, tokenA);
      expect(res.status).toBe(200);
    });

    it('upserts persona (no duplicates)', async () => {
      const res = await api('PUT', '/onboarding/persona', {
        alternateId,
        tone: 'Casual',
        writingStyle: 'Concise',
      }, tokenA);
      expect(res.status).toBe(200);

      const count = await prisma.persona.count({ where: { alternateId } });
      expect(count).toBe(1);
    });
  });

  // Test 5: Source
  describe('Training Sources', () => {
    it('creates a URL source', async () => {
      const res = await api('POST', '/onboarding/sources', {
        alternateId,
        type: 'URL',
        name: 'Test Website',
        url: 'https://example.com',
      }, tokenA);
      expect(res.status).toBe(201);
      expect(res.data.data.sourceId).toBeDefined();
      sourceId = res.data.data.sourceId;
    });

    it('rejects SSRF-unsafe URL', async () => {
      const res = await api('POST', '/onboarding/sources', {
        alternateId,
        type: 'URL',
        name: 'Bad URL',
        url: 'http://169.254.169.254/latest/meta-data/',
      }, tokenA);
      expect(res.status).toBe(400);
    });

    it('deletes a source', async () => {
      const res = await api('DELETE', `/alternates/${alternateId}/sources/${sourceId}`, null, tokenA);
      expect(res.status).toBe(204);
    });
  });

  // Test 6: Voice
  describe('Voice Profile', () => {
    it('saves provider voice', async () => {
      const res = await api('PUT', '/onboarding/voice', {
        alternateId,
        provider: 'ELEVENLABS',
        voiceId: 'test-voice-1',
        name: 'Test Voice',
        type: 'PROVIDER_VOICE',
      }, tokenA);
      expect(res.status).toBe(200);
    });

    it('rejects voice cloning without consent', async () => {
      const res = await api('PUT', '/onboarding/voice', {
        alternateId,
        provider: 'ELEVENLABS',
        voiceId: 'test-voice-2',
        name: 'Cloned Voice',
        type: 'CLONED_VOICE',
        consent: false,
      }, tokenA);
      expect(res.status).toBe(400);
    });

    it('accepts voice cloning with consent', async () => {
      const res = await api('PUT', '/onboarding/voice', {
        alternateId,
        provider: 'ELEVENLABS',
        voiceId: 'test-voice-3',
        name: 'Cloned Voice',
        type: 'CLONED_VOICE',
        consent: true,
      }, tokenA);
      expect(res.status).toBe(200);

      const profile = await prisma.voiceProfile.findUnique({ where: { alternateId } });
      expect(profile?.consentGiven).toBe(true);
      expect(profile?.consentTimestamp).toBeDefined();
    });
  });

  // Test 7: AI Provider
  describe('AI Provider', () => {
    it('saves AI provider with encrypted key', async () => {
      const res = await api('PUT', '/onboarding/ai-provider', {
        alternateId,
        provider: 'OPENAI',
        apiKey: 'test-key-do-not-use',
        keyLabel: 'Test Key',
        defaultModel: 'gpt-4o',
      }, tokenA);
      expect(res.status).toBe(200);
      // Key is stored encrypted and marked PENDING — live validation is
      // deferred (Phase 5 / BYOK management), so onboarding never claims VALID.
      expect(res.data.data.status).toBe('PENDING');
    });

    it('stores API key encrypted (not plaintext)', async () => {
      const config = await prisma.aIProviderConfig.findUnique({ where: { alternateId } });
      expect(config).toBeDefined();
      expect(config?.encryptedApiKey).not.toContain('test-key-do-not-use');
      // Verify it decrypts back correctly
      expect(encryption.decrypt(config!.encryptedApiKey)).toBe('test-key-do-not-use');
    });

    it('does not return API key in response', async () => {
      const res = await api('GET', `/onboarding/preview/${alternateId}`, null, tokenA);
      const body = JSON.stringify(res.data);
      expect(body).not.toContain('test-key-do-not-use');
      expect(body).not.toContain('encryptedApiKey');
    });
  });

  // Test 8: Preview
  describe('Preview', () => {
    it('returns preview data', async () => {
      const res = await api('GET', `/onboarding/preview/${alternateId}`, null, tokenA);
      expect(res.status).toBe(200);
      expect(res.data.data.alternate.username).toBe(`alt_${suffix}`);
      expect(res.data.data.persona).toBeDefined();
      expect(res.data.data.voice.configured).toBe(true);
      expect(res.data.data.aiProvider.configured).toBe(true);
    });
  });

  // Test 9: Publish
  describe('Publish', () => {
    it('publishes alternate', async () => {
      const res = await api('POST', '/onboarding/publish', { alternateId }, tokenA);
      expect(res.status).toBe(200);
      expect(res.data.data.publicUrl).toBeDefined();
    });

    it('updates alternate status to PUBLISHED', async () => {
      const alternate = await prisma.alternate.findUnique({ where: { id: alternateId } });
      expect(alternate?.status).toBe('PUBLISHED');
      expect(alternate?.publishedAt).toBeDefined();
      expect(alternate?.visibility).toBe('PUBLIC');
    });

    it('updates onboarding status to COMPLETED', async () => {
      const onboarding = await prisma.onboarding.findFirst({ where: { alternateId } });
      expect(onboarding?.status).toBe('COMPLETED');
      expect(onboarding?.completedAt).toBeDefined();
    });
  });

  // Test 10: Public Alternate
  describe('Public Alternate', () => {
    it('returns public alternate', async () => {
      const res = await api('GET', `/public/alt_${suffix}`);
      expect(res.status).toBe(200);
      expect(res.data.data.username).toBe(`alt_${suffix}`);
    });

    it('does not expose API key or sensitive data', async () => {
      const res = await api('GET', `/public/alt_${suffix}`);
      const body = JSON.stringify(res.data);
      expect(body).not.toContain('test-key-do-not-use');
      expect(body).not.toContain('encryptedApiKey');
      expect(body).not.toContain('passwordHash');
      expect(body).not.toContain('email');
    });

    it('returns 404 for non-existent alternate', async () => {
      const res = await api('GET', '/public/nonexistent_user_xyz');
      expect(res.status).toBe(404);
    });
  });

  // Test 11: Ownership
  describe('Ownership', () => {
    it('User B cannot GET User A alternate', async () => {
      const res = await api('GET', `/alternates/${alternateId}`, null, tokenB);
      expect(res.status).toBe(404);
    });

    it('User B cannot UPDATE User A alternate', async () => {
      const res = await api('PUT', `/alternates/${alternateId}`, { displayName: 'Hacked' }, tokenB);
      expect(res.status).toBe(404);
    });

    it('User B cannot DELETE User A alternate', async () => {
      const res = await api('DELETE', `/alternates/${alternateId}`, null, tokenB);
      expect(res.status).toBe(404);
    });

    it('User B cannot access User A preview', async () => {
      const res = await api('GET', `/onboarding/preview/${alternateId}`, null, tokenB);
      expect(res.status).toBe(404);
    });
  });

  // Test 12: Unauthorized Access
  describe('Unauthorized Access', () => {
    it('returns 401 without token', async () => {
      const res = await api('GET', '/onboarding');
      expect(res.status).toBe(401);
    });

    it('returns 401 with invalid token', async () => {
      const res = await api('GET', '/onboarding', null, 'invalid-token');
      expect(res.status).toBe(401);
    });
  });

  // Test 13: API Key Security
  describe('API Key Security', () => {
    it('encrypts API key in database', async () => {
      const config = await prisma.aIProviderConfig.findUnique({ where: { alternateId } });
      expect(config?.encryptedApiKey).not.toContain('test-key-do-not-use');
      expect(config?.encryptedApiKey).toMatch(/^[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$/);
    });

    it('does not log API key', async () => {
      // The API key should never appear in any response
      const res = await api('GET', `/onboarding/preview/${alternateId}`, null, tokenA);
      expect(JSON.stringify(res.data)).not.toContain('test-key-do-not-use');
    });
  });

  // Test 14: Database Persistence
  describe('Database Persistence', () => {
    it('persists all onboarding data', async () => {
      const alternate = await prisma.alternate.findUnique({
        where: { id: alternateId },
        include: { persona: true, voiceProfile: true, aiProvider: true, sources: true, onboarding: true },
      });
      expect(alternate).toBeDefined();
      expect(alternate?.persona).toBeDefined();
      expect(alternate?.voiceProfile).toBeDefined();
      expect(alternate?.aiProvider).toBeDefined();
      expect(alternate?.onboarding).toBeDefined();
    });
  });

  // Cleanup — delete the test users. Cascading FKs remove their alternates,
  // onboardings, personas, sources, voice profiles, AI provider configs,
  // sessions and audit logs, leaving no residue behind.
  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { email: { in: [userA.email, userB.email] } },
    });
  });
});
// Full integration test for Alternate Me backend
// Tests: register → login → onboarding → sources → persona → voice → AI provider → preview → publish → public
import { PrismaClient } from '@prisma/client';

const BASE = 'http://localhost:4000/api/v1';
const results = [];
let passed = 0;
let failed = 0;

function record(name, ok, detail = '') {
  results.push({ name, ok, detail });
  if (ok) passed++; else failed++;
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ' — ' + detail : ''}`);
}

async function api(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
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

// Generate unique test user
const suffix = Date.now().toString(36);
const userA = {
  name: `Test User A ${suffix}`,
  username: `testa_${suffix}`,
  email: `testa_${suffix}@example.com`,
  password: 'TestPass123!',
};
const userB = {
  name: `Test User B ${suffix}`,
  username: `testb_${suffix}`,
  email: `testb_${suffix}@example.com`,
  password: 'TestPass123!',
};

let tokenA = null;
let tokenB = null;
let alternateId = null;
let onboardingId = null;
let sourceId = null;

// 1. Register User A
const regA = await api('POST', '/auth/register', userA);
record('Register User A', regA.status === 201 && regA.data?.data?.accessToken, `status=${regA.status}`);
tokenA = regA.data?.data?.accessToken;

// 2. Register User B
const regB = await api('POST', '/auth/register', userB);
record('Register User B', regB.status === 201 && regB.data?.data?.accessToken, `status=${regB.status}`);
tokenB = regB.data?.data?.accessToken;

// 3. Login User A (should fail - email unverified)
const loginA = await api('POST', '/auth/login', { email: userA.email, password: userA.password });
record('Login User A (unverified email → 403)', loginA.status === 403, `status=${loginA.status}`);

// 4. Get current user with registration token
const me = await api('GET', '/me', null, tokenA);
record('GET /me with registration token', me.status === 200 && me.data?.data?.email === userA.email, `status=${me.status}`);

// 5. Start onboarding
const start = await api('POST', '/onboarding/start', {
  username: `alt_${suffix}`,
  displayName: 'Test Alternate',
  title: 'Software Engineer',
  bio: 'Test bio',
}, tokenA);
record('Start onboarding', start.status === 201 && start.data?.data?.alternateId, `status=${start.status}`);
alternateId = start.data?.data?.alternateId;
onboardingId = start.data?.data?.onboardingId;

// 6. Get onboarding status
const status = await api('GET', '/onboarding', null, tokenA);
record('GET onboarding status', status.status === 200 && status.data?.data?.status === 'IN_PROGRESS', `status=${status.status}`);

// 7. Save personal info
const personal = await api('POST', '/onboarding/personal', {
  alternateId,
  displayName: 'Test Alternate Updated',
  title: 'Senior Engineer',
  bio: 'Updated bio',
  username: `alt_${suffix}`,
}, tokenA);
record('Save personal info', personal.status === 200, `status=${personal.status}`);

// 8. Add training source (URL)
const source = await api('POST', '/onboarding/sources', {
  alternateId,
  type: 'URL',
  name: 'Test Website',
  url: 'https://example.com',
}, tokenA);
record('Add training source', source.status === 201 && source.data?.data?.sourceId, `status=${source.status}`);
sourceId = source.data?.data?.sourceId;

// 9. Save persona
const persona = await api('PUT', '/onboarding/persona', {
  alternateId,
  tone: 'Professional',
  writingStyle: 'Clear and concise',
  personality: 'Friendly and helpful',
  instructions: 'Always be polite',
  boundaries: 'Never share personal data',
}, tokenA);
record('Save persona', persona.status === 200, `status=${persona.status}`);

// 10. Save voice (provider voice, no consent needed)
const voice = await api('PUT', '/onboarding/voice', {
  alternateId,
  provider: 'ELEVENLABS',
  voiceId: 'test-voice-1',
  name: 'Test Voice',
  type: 'PROVIDER_VOICE',
}, tokenA);
record('Save voice (provider)', voice.status === 200, `status=${voice.status}`);

// 11. Test voice cloning without consent (should fail)
const voiceNoConsent = await api('PUT', '/onboarding/voice', {
  alternateId,
  provider: 'ELEVENLABS',
  voiceId: 'test-voice-2',
  name: 'Cloned Voice',
  type: 'CLONED_VOICE',
  consent: false,
}, tokenA);
record('Voice cloning without consent → rejected', voiceNoConsent.status === 400, `status=${voiceNoConsent.status}`);

// 12. Save AI provider (test key)
const aiProvider = await api('PUT', '/onboarding/ai-provider', {
  alternateId,
  provider: 'OPENAI',
  apiKey: 'test-key-do-not-use',
  keyLabel: 'Test Key',
  defaultModel: 'gpt-4o',
}, tokenA);
record('Save AI provider (stored encrypted, pending validation)', aiProvider.status === 200 && aiProvider.data?.data?.status === 'PENDING', `status=${aiProvider.status}`);

// 13. Get preview
const preview = await api('GET', `/onboarding/preview/${alternateId}`, null, tokenA);
record('Get preview', preview.status === 200 && preview.data?.data?.alternate?.username === `alt_${suffix}`, `status=${preview.status}`);
// Verify no API key in preview
const previewStr = JSON.stringify(preview.data);
record('Preview does NOT expose API key', !previewStr.includes('test-key-do-not-use') && !previewStr.includes('encryptedApiKey'), '');

// 14. Publish
const publish = await api('POST', '/onboarding/publish', { alternateId }, tokenA);
record('Publish alternate', publish.status === 200 && publish.data?.data?.publicUrl, `status=${publish.status}`);

// 15. Get public alternate
const publicAlt = await api('GET', `/public/alt_${suffix}`, null, null);
record('Get public alternate', publicAlt.status === 200 && publicAlt.data?.data?.username === `alt_${suffix}`, `status=${publicAlt.status}`);
const publicStr = JSON.stringify(publicAlt.data);
record('Public alternate does NOT expose API key', !publicStr.includes('test-key-do-not-use') && !publicStr.includes('encryptedApiKey'), '');

// 16. Authorization: User B tries to access User A's alternate
const bGetAlt = await api('GET', `/alternates/${alternateId}`, null, tokenB);
record('User B GET User A alternate → 404', bGetAlt.status === 404, `status=${bGetAlt.status}`);

const bUpdateAlt = await api('PUT', `/alternates/${alternateId}`, { displayName: 'Hacked' }, tokenB);
record('User B UPDATE User A alternate → 404', bUpdateAlt.status === 404, `status=${bUpdateAlt.status}`);

const bDeleteAlt = await api('DELETE', `/alternates/${alternateId}`, null, tokenB);
record('User B DELETE User A alternate → 404', bDeleteAlt.status === 404, `status=${bDeleteAlt.status}`);

const bPreview = await api('GET', `/onboarding/preview/${alternateId}`, null, tokenB);
record('User B GET User A preview → 404', bPreview.status === 404, `status=${bPreview.status}`);

// 17. Unauthenticated access
const noAuth = await api('GET', '/onboarding', null, null);
record('Unauthenticated GET /onboarding → 401', noAuth.status === 401, `status=${noAuth.status}`);

// 18. Duplicate username
const dupStart = await api('POST', '/onboarding/start', {
  username: `alt_${suffix}`,
  displayName: 'Duplicate',
}, tokenB);
record('Duplicate username → 409', dupStart.status === 409, `status=${dupStart.status}`);

// 19. Reserved username
const reservedStart = await api('POST', '/onboarding/start', {
  username: 'admin',
  displayName: 'Admin',
}, tokenB);
record('Reserved username → 409', reservedStart.status === 409, `status=${reservedStart.status}`);

// 20. Onboarding persistence check (GET status after all steps)
const finalStatus = await api('GET', '/onboarding', null, tokenA);
record('Onboarding status persisted', finalStatus.status === 200 && finalStatus.data?.data?.status === 'COMPLETED', `status=${finalStatus.data?.data?.status}`);

// Cleanup: delete test users (cascades to alternates, onboardings, sources,
// personas, voice profiles, AI provider configs, sessions, tokens, audit logs).
async function cleanup() {
  const prisma = new PrismaClient();
  try {
    await prisma.user.deleteMany({ where: { email: { in: [userA.email, userB.email] } } });
    console.log('🧹 Cleaned up test users');
  } catch (err) {
    console.warn('⚠️ Cleanup failed:', err?.message || err);
  } finally {
    await prisma.$disconnect();
  }
}
await cleanup();

console.log('\n========================================');
console.log(`RESULTS: ${passed} passed, ${failed} failed`);
console.log('========================================');
process.exit(failed > 0 ? 1 : 0);
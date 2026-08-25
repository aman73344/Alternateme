// Diagnostic: verify DB state + AI key encryption security (no secrets printed)
import dotenv from 'dotenv';
import path from 'path';
import { PrismaClient } from '@prisma/client';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const prisma = new PrismaClient();

async function main() {
  const counts = {
    user: await prisma.user.count(),
    alternate: await prisma.alternate.count(),
    onboarding: await prisma.onboarding.count(),
    persona: await prisma.persona.count(),
    voiceProfile: await prisma.voiceProfile.count(),
    aiProviderConfig: await prisma.aIProviderConfig.count(),
    trainingSource: await prisma.trainingSource.count(),
  };
  console.log('=== TABLE COUNTS ===');
  console.log(JSON.stringify(counts, null, 2));

  const configs = await prisma.aIProviderConfig.findMany({
    select: { id: true, provider: true, status: true, encryptedApiKey: true, defaultModel: true, lastValidatedAt: true },
  });
  console.log('=== AI PROVIDER CONFIGS (encrypted key shape only) ===');
  for (const c of configs) {
    const key = c.encryptedApiKey || '';
    const parts = key.split(':');
    const looksEncrypted = parts.length === 3 && /^[0-9a-f]+$/i.test(parts[0]) && /^[0-9a-f]+$/i.test(parts[1]) && /^[0-9a-f]+$/i.test(parts[2]);
    const containsTestKey = key.includes('test-key-do-not-use') || key.includes('sk-test-');
    console.log(JSON.stringify({
      provider: c.provider,
      status: c.status,
      keyLength: key.length,
      looksAesGcmFormat: looksEncrypted,
      containsPlaintextTestKey: containsTestKey,
      parts: parts.length,
      lastValidatedAt: c.lastValidatedAt,
    }));
  }

  // Show the most recent published alternate + onboarding state (persistence check)
  const alt = await prisma.alternate.findFirst({
    where: { status: 'PUBLISHED' },
    orderBy: { publishedAt: 'desc' },
    select: { id: true, username: true, displayName: true, status: true, visibility: true, publishedAt: true },
  });
  console.log('=== LATEST PUBLISHED ALTERNATE ===');
  console.log(JSON.stringify(alt, null, 2));

  if (alt) {
    const ob = await prisma.onboarding.findFirst({ where: { alternateId: alt.id } });
    console.log('=== ONBOARDING STATE FOR THAT ALTERNATE ===');
    console.log(JSON.stringify(ob, null, 2));

    const vp = await prisma.voiceProfile.findFirst({ where: { alternateId: alt.id } });
    console.log('=== VOICE PROFILE ===');
    console.log(JSON.stringify(vp, null, 2));

    const persona = await prisma.persona.findFirst({ where: { alternateId: alt.id } });
    console.log('=== PERSONA ===');
    console.log(JSON.stringify(persona, null, 2));

    const sources = await prisma.trainingSource.findMany({ where: { alternateId: alt.id } });
    console.log('=== SOURCES COUNT ===', sources.length);
  }

  await prisma.$disconnect();
}

main().catch((e) => { console.error('DIAG ERROR', e); process.exit(1); });

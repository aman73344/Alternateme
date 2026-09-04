// Phase 3 smoke: time the full ingest pipeline for a TXT source twice.
// Run: node --import tsx scripts/e2e-smoke.ts
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { prisma } from '../src/database/prisma';
import { alternateService } from '../src/alternates/alternate.service';
import { sourceService } from '../src/sources/source.service';
import { knowledgeIngestionService } from '../src/knowledge/knowledge-ingestion.service';
import type { IngestionJobData } from '../src/knowledge/knowledge.types';

const suffix = Date.now().toString(36);
const fixture = fs.readFileSync(path.resolve(__dirname, '../src/tests/fixtures/sample.txt'));

async function main() {
  const user = await prisma.user.create({
    data: { email: `smoke_${suffix}@test.com`, username: `smoke_${suffix}`, role: 'USER' },
  });
  const alt = await alternateService.createAlternate(user.id, {
    username: `smokealt_${suffix}`,
    displayName: 'Smoke',
  });

  for (let k = 1; k <= 2; k += 1) {
    const label = `TXT ingest #${k}`;
    const t0 = Date.now();
    const created = await sourceService.createSource(user.id, {
      alternateId: alt.id,
      type: 'FILE',
      name: 'sample.txt',
      fileName: 'sample.txt',
      mimeType: 'text/plain',
      fileContent: fixture.toString('base64'),
    });
    console.log(label, 'createSource', Date.now() - t0, 'ms');

    const t1 = Date.now();
    const data: IngestionJobData = {
      jobId: created.jobId,
      userId: user.id,
      alternateId: alt.id,
      sourceId: created.id,
    };
    const outcome = await knowledgeIngestionService.ingest(data);
    console.log(label, 'ingest', Date.now() - t1, 'ms', 'chunks', outcome.chunkCount, 'v', outcome.version);
  }

  await prisma.user.deleteMany({ where: { id: user.id } });
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('SMOKE FAIL', e);
  process.exit(1);
});
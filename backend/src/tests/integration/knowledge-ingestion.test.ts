import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { prisma } from '@/database';
import { alternateService } from '@/alternates/alternate.service';
import { sourceService } from '@/sources/source.service';
import { knowledgeIngestionService } from '@/knowledge/knowledge-ingestion.service';
import { knowledgeStatusService } from '@/knowledge/knowledge-status.service';
import { knowledgeChunkRepository } from '@/knowledge/knowledge-chunk.repository';
import { knowledgeVersioningRepository } from '@/knowledge/knowledge-versioning.repository';
import { storageProvider } from '@/storage';
import type { IngestionJobData } from '@/knowledge/knowledge.types';

const FIXTURES = path.join(__dirname, '..', 'fixtures');

/**
 * Phase 3 — full pipeline integration against the real PostgreSQL (Neon) DB.
 * Each test drives exactly what the worker would run (KnowledgeIngestionService
 * .ingest) so the whole chain is covered: source → resolve (storage download)
 * → extract → clean → chunk → embed → store (pgvector) → version → status.
 * Redis/BullMQ is intentionally bypassed to keep the suite deterministic.
 */
describe('Phase 3 — Knowledge Ingestion Pipeline (integration)', () => {
  const suffix = Date.now().toString(36);
  const userA = { email: `p3a_${suffix}@test.com`, username: `p3a_${suffix}` };
  const userB = { email: `p3b_${suffix}@test.com`, username: `p3b_${suffix}` };

  let userAId: string;
  let userBId: string;
  let alternateAId: string;
  let alternateBId: string;
  const storageKeys: string[] = [];

  const createFileSource = async (fileName: string, mimeType: string, name?: string) => {
    const content = fs.readFileSync(path.join(FIXTURES, fileName));
    const created = await sourceService.createSource(userAId, {
      alternateId: alternateAId,
      type: 'FILE',
      name: name || fileName,
      fileName,
      mimeType,
      fileContent: content.toString('base64'),
    });
    if (created.storageKey) storageKeys.push(created.storageKey);
    return created;
  };

  const runIngestion = async (jobId: string, sourceId: string, opts: { force?: boolean } = {}) => {
    const data: IngestionJobData = {
      jobId,
      userId: userAId,
      alternateId: alternateAId,
      sourceId,
      force: opts.force,
    };
    return knowledgeIngestionService.ingest(data);
  };

  beforeAll(async () => {
    const a = await prisma.user.create({
      data: { email: userA.email, username: userA.username, role: 'USER' },
    });
    const b = await prisma.user.create({
      data: { email: userB.email, username: userB.username, role: 'USER' },
    });
    userAId = a.id;
    userBId = b.id;
    const altA = await alternateService.createAlternate(userAId, {
      username: `p3alt-${suffix}`,
      displayName: 'Phase 3 Alternate',
    });
    const altB = await alternateService.createAlternate(userBId, {
      username: `p3altb-${suffix}`,
      displayName: 'Phase 3 Alternate B',
    });
    alternateAId = altA.id;
    alternateBId = altB.id;
  });

  afterAll(async () => {
    for (const key of storageKeys) {
      try {
        await storageProvider.delete(key);
      } catch {
        /* best-effort cleanup */
      }
    }
    await prisma.user.deleteMany({ where: { id: { in: [userAId, userBId] } } });
    await prisma.$disconnect();
  });

  it('ingests a TXT file end to end (extract → clean → chunk → embed → pgvector → ready)', async () => {
    const created = await createFileSource('sample.txt', 'text/plain');
    const outcome = await runIngestion(created.jobId, created.id);

    expect(outcome.chunkCount).toBeGreaterThan(0);
    expect(outcome.version).toBe(1);
    expect(outcome.checksum).toMatch(/^[0-9a-f]{64}$/);
    expect(outcome.skippedIdempotent).toBeUndefined();

    const source = await prisma.trainingSource.findUnique({ where: { id: created.id } });
    expect(source?.status).toBe('READY');
    expect(source?.currentVersion).toBe(1);
    expect(source?.chunkCount).toBe(outcome.chunkCount);
    expect(source?.processingStage).toBe('COMPLETED');
    expect(source?.lastProcessedAt).toBeInstanceOf(Date);

    const docs = await prisma.knowledgeDocument.findMany({ where: { sourceId: created.id } });
    expect(docs).toHaveLength(1);
    expect(docs[0].status).toBe('READY');
    expect(docs[0].version).toBe(1);
    expect(docs[0].wordCount).toBeGreaterThan(0);

    const chunks = await prisma.documentChunk.findMany({
      where: { sourceId: created.id },
      orderBy: { chunkIndex: 'asc' },
    });
    expect(chunks).toHaveLength(outcome.chunkCount);
    for (const c of chunks) {
      expect(c.alternateId).toBe(alternateAId);
      expect(c.userId).toBe(userAId);
      expect(c.version).toBe(1);
      expect(c.isActive).toBe(true);
      expect((c.metadata as any)?.sourceType).toBe('FILE');
      expect(c.content.length).toBeGreaterThan(0);
    }

    const embeddingCount = await knowledgeChunkRepository.countEmbeddings({ sourceId: created.id });
    expect(embeddingCount).toBe(outcome.chunkCount);

    const versions = await prisma.knowledgeVersion.findMany({ where: { sourceId: created.id } });
    expect(versions).toHaveLength(1);
    expect(versions[0].status).toBe('ACTIVE');
    expect(versions[0].checksum).toBe(outcome.checksum);
    expect(versions[0].chunkCount).toBe(outcome.chunkCount);

    const eligible = await knowledgeVersioningRepository.getRetrievalEligibleChunkRows({
      alternateId: alternateAId,
    });
    expect(eligible.filter((r) => r.sourceId === created.id)).toHaveLength(outcome.chunkCount);

    const status = await knowledgeStatusService.getStatus(alternateAId, userAId);
    expect(status.totalSources).toBeGreaterThanOrEqual(1);
    expect(status.readySources).toBeGreaterThanOrEqual(1);
    expect(status.totalChunks).toBeGreaterThanOrEqual(outcome.chunkCount);
    expect(status.lastProcessedAt).toBeTruthy();
  });
  it('ingests PDF, DOCX and Markdown sources', async () => {
    const pdf = await createFileSource('sample.pdf', 'application/pdf');
    const pdfOutcome = await runIngestion(pdf.jobId, pdf.id);
    expect(pdfOutcome.chunkCount).toBeGreaterThan(0);
    expect(pdfOutcome.ocrRequired).toBeUndefined();
    expect((await prisma.trainingSource.findUnique({ where: { id: pdf.id } }))?.status).toBe('READY');

    const docx = await createFileSource(
      'sample.docx',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );
    const docxOutcome = await runIngestion(docx.jobId, docx.id);
    expect(docxOutcome.chunkCount).toBeGreaterThan(0);
    const docxRows = await prisma.documentChunk.findMany({ where: { sourceId: docx.id } });
    expect(docxRows.some((c) => c.content.includes('zebra unicorns'))).toBe(true);
    expect(docxRows.some((c) => c.heading?.includes('Docx Fixture Title'))).toBe(true);

    const md = await createFileSource('sample.md', 'text/markdown');
    const mdOutcome = await runIngestion(md.jobId, md.id);
    expect(mdOutcome.chunkCount).toBeGreaterThan(0);
    const mdRows = await prisma.documentChunk.findMany({ where: { sourceId: md.id } });
    expect(mdRows.some((c) => c.content.includes('# Intro'))).toBe(true);
    expect(mdRows.some((c) => c.content.includes('```'))).toBe(true);
  });

  it('flags scanned PDFs as OCR_REQUIRED without inventing content', async () => {
    const scan = await createFileSource('sample-blank.pdf', 'application/pdf');
    const outcome = await runIngestion(scan.jobId, scan.id);
    expect(outcome.ocrRequired).toBe(true);
    expect(outcome.chunkCount).toBe(0);

    const source = await prisma.trainingSource.findUnique({ where: { id: scan.id } });
    expect(source?.status).toBe('FAILED');
    expect(source?.errorCode).toBe('OCR_REQUIRED');
    expect(await prisma.knowledgeDocument.count({ where: { sourceId: scan.id } })).toBe(0);
  });

  it('skips a reprocess when content is unchanged (idempotency)', async () => {
    const created = await createFileSource('sample.txt', 'text/plain');
    await runIngestion(created.jobId, created.id);

    const reprocess = await sourceService.reprocessSource(alternateAId, created.id, userAId, {});
    const outcome = await runIngestion(reprocess.jobId, created.id);

    expect(outcome.skippedIdempotent).toBe(true);
    const source = await prisma.trainingSource.findUnique({ where: { id: created.id } });
    expect(source?.currentVersion).toBe(1); // unchanged
    expect(source?.chunkCount).toBe(outcome.chunkCount);
    expect(await prisma.knowledgeDocument.count({ where: { sourceId: created.id } })).toBe(1);
    expect(await knowledgeChunkRepository.countEmbeddings({ sourceId: created.id })).toBe(
      outcome.chunkCount,
    );
  });
  it('creates a new retrieval-eligible version on forced reprocess', async () => {
    const created = await createFileSource('sample.txt', 'text/plain');
    await runIngestion(created.jobId, created.id);

    expect(await prisma.knowledgeVersion.count({ where: { sourceId: created.id } })).toBe(1);

    const reprocess = await sourceService.reprocessSource(alternateAId, created.id, userAId, {
      force: true,
    });
    const outcome = await runIngestion(reprocess.jobId, created.id, { force: true });
    expect(outcome.version).toBe(2);
    expect(outcome.chunkCount).toBeGreaterThan(0);

    const versions = await prisma.knowledgeVersion.findMany({
      where: { sourceId: created.id },
      orderBy: { version: 'asc' },
    });
    expect(versions).toHaveLength(2);
    expect(versions[0].status).toBe('SUPERSEDED');
    expect(versions[1].status).toBe('ACTIVE');
    expect(versions[0].supersededAt).toBeInstanceOf(Date);

    const activeDocs = await prisma.knowledgeDocument.findMany({
      where: { sourceId: created.id, version: 2, status: 'READY' },
    });
    expect(activeDocs).toHaveLength(1);

    const eligible = await knowledgeVersioningRepository.getRetrievalEligibleChunkRows({
      sourceId: created.id,
    });
    expect(eligible.length).toBeGreaterThan(0);
    expect(eligible.every((r) => r.version === 2)).toBe(true);
  });

  it('excludes deleted sources from retrieval eligibility', async () => {
    const created = await createFileSource('sample.md', 'text/markdown');
    await runIngestion(created.jobId, created.id);

    const before = await knowledgeVersioningRepository.getRetrievalEligibleChunkRows({
      sourceId: created.id,
    });
    expect(before.length).toBeGreaterThan(0);

    await sourceService.deleteSource(alternateAId, created.id, userAId);

    const source = await prisma.trainingSource.findUnique({ where: { id: created.id } });
    expect(source?.status).toBe('DELETED');

    const after = await knowledgeVersioningRepository.getRetrievalEligibleChunkRows({
      sourceId: created.id,
    });
    expect(after).toHaveLength(0);

    const chunks = await prisma.documentChunk.findMany({ where: { sourceId: created.id } });
    expect(chunks.every((c) => c.isActive === false)).toBe(true);
    const docs = await prisma.knowledgeDocument.findMany({ where: { sourceId: created.id } });
    expect(docs.every((d) => d.status === 'DELETED')).toBe(true);
  });

  it('enforces cross-user isolation end to end', async () => {
    const created = await createFileSource(
      'sample.docx',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );
    await runIngestion(created.jobId, created.id);

    await expect(knowledgeStatusService.getStatus(alternateAId, userBId)).rejects.toBeTruthy();

    const data: IngestionJobData = {
      jobId: created.jobId,
      userId: userBId,
      alternateId: alternateAId,
      sourceId: created.id,
    };
    await expect(knowledgeIngestionService.ingest(data)).rejects.toBeTruthy();

    await expect(
      sourceService.getSourceStatus(alternateAId, created.id, userBId),
    ).rejects.toBeTruthy();

    const bEligible = await knowledgeVersioningRepository.getRetrievalEligibleChunkRows({
      alternateId: alternateBId,
    });
    expect(bEligible.filter((r) => r.sourceId === created.id)).toHaveLength(0);
  });
});
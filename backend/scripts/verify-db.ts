/* Phase 3 database verification (spec §53): pgvector extension, vector column,
 * indexes, relations. Read-only. Run: npx tsx scripts/verify-db.ts */
import { prisma } from '../src/database';

async function main() {
  const ext = await prisma.$queryRaw<{ extname: string; extversion: string }[]>`
    SELECT extname, extversion FROM pg_extension WHERE extname = 'vector'`;
  console.log('pgvector extension:', ext.length ? `${ext[0].extname} v${ext[0].extversion}` : 'NOT INSTALLED');

  const vecCol = await prisma.$queryRaw<{ table_name: string; column_name: string; udt_name: string }[]>`
    SELECT table_name, column_name, udt_name FROM information_schema.columns
    WHERE table_schema = 'public' AND udt_name = 'vector'`;
  console.log('vector columns:', vecCol.map((c) => `${c.table_name}.${c.column_name}`).join(', ') || 'NONE');

  const dims = await prisma.$queryRaw<{ atttypmod: number }[]>`
    SELECT a.atttypmod FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    WHERE c.relname = 'embeddings' AND a.attname = 'vector'`;
  console.log('vector dimension:', dims[0]?.atttypmod ?? 'unknown');

  const indexes = await prisma.$queryRaw<{ tablename: string; indexname: string }[]>`
    SELECT tablename, indexname FROM pg_indexes
    WHERE schemaname = 'public' AND (
      tablename IN ('document_chunks', 'embeddings', 'ingestion_jobs', 'knowledge_versions', 'knowledge_documents', 'training_sources'))
    ORDER BY tablename, indexname`;
  console.log('knowledge indexes:');
  for (const i of indexes) console.log(`  ${i.tablename}: ${i.indexname}`);

  const tables = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT count(*) AS count FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name IN
      ('training_sources','knowledge_documents','document_chunks','embeddings','ingestion_jobs','knowledge_versions')`;
  console.log('phase3 tables present:', tables[0].count, '/ 6');

  const fks = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT count(*) AS count FROM pg_constraint
    WHERE contype = 'f' AND conrelid::regclass::text IN
      ('knowledge_documents','document_chunks','embeddings','ingestion_jobs','knowledge_versions')`;
  console.log('phase3 foreign keys:', fks[0].count);

  const counts = {
    sources: await prisma.trainingSource.count(),
    docs: await prisma.knowledgeDocument.count(),
    chunks: await prisma.documentChunk.count(),
    embeddings: await prisma.$queryRaw<{ count: bigint }[]>`SELECT count(*) AS count FROM embeddings`,
    versions: await prisma.knowledgeVersion.count(),
    jobs: await prisma.ingestionJob.count(),
  };
  console.log(
    'row counts:',
    JSON.stringify({
      sources: counts.sources,
      docs: counts.docs,
      chunks: counts.chunks,
      embeddings: Number(counts.embeddings[0].count),
      versions: counts.versions,
      jobs: counts.jobs,
    }),
  );
}

main()
  .catch((e) => {
    console.error('verification failed:', e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

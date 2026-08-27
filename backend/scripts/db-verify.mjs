// Phase 3 database verification — run with: node scripts/db-verify.mjs
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const p = new PrismaClient({
  datasources: { db: { url: process.env.DIRECT_URL || process.env.DATABASE_URL } },
});

try {
  const idx = await p.$queryRawUnsafe(
    "SELECT indexname FROM pg_indexes WHERE tablename='document_chunks' ORDER BY 1",
  );
  console.log('INDEXES:', idx.map((r) => r.indexname).join(', '));

  const ext = await p.$queryRawUnsafe("SELECT extname FROM pg_extension WHERE extname='vector'");
  console.log('PGVECTOR:', ext.length === 1 ? 'ENABLED' : 'MISSING');

  const tbls = await p.$queryRawUnsafe(
    "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('knowledge_documents','document_chunks','embeddings','ingestion_jobs','knowledge_versions') ORDER BY 1",
  );
  console.log('TABLES:', tbls.map((r) => r.table_name).join(', '));

  const vc = await p.$queryRawUnsafe(
    "SELECT format_type(a.atttypid,a.atttypmod) AS t FROM pg_attribute a WHERE a.attrelid='embeddings'::regclass AND a.attname='vector'",
  );
  console.log('VECTOR COL:', vc[0]?.t);

  const fk = await p.$queryRawUnsafe(
    "SELECT COUNT(*)::int AS n FROM pg_constraint WHERE conrelid='document_chunks'::regclass AND contype='f'",
  );
  console.log('DOCUMENT_CHUNKS FKS:', fk[0]?.n);

  const vidx = await p.$queryRawUnsafe(
    "SELECT indexname || ':' || indexdef FROM pg_indexes WHERE tablename='embeddings' AND indexdef ILIKE '%vector%'",
  );
  console.log('EMBEDDING VECTOR INDEX:', vidx.map((r) => r['?column?'] ?? Object.values(r)[0]).join(' | '));
} finally {
  await p.$disconnect();
}

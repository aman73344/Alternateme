require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  const v = await p.$queryRawUnsafe('SHOW server_version');
  console.log('SERVER_VERSION', JSON.stringify(v));

  const e = await p.$queryRawUnsafe(
    "SELECT name, default_version, installed_version FROM pg_available_extensions WHERE name IN ('vector','pgvector')",
  );
  console.log('VECTOR_EXT', JSON.stringify(e));

  const i = await p.$queryRawUnsafe("SELECT extname, extversion FROM pg_extension WHERE extname='vector'");
  console.log('VECTOR_INSTALLED', JSON.stringify(i));

  const type = await p.$queryRawUnsafe(
    "SELECT typname FROM pg_type WHERE typname IN ('vector','halfvec','sparsevec')",
  );
  console.log('VECTOR_TYPES', JSON.stringify(type));
}

main()
  .catch((x) => console.log('ERR', x.message.split('\n')[0]))
  .finally(() => p.$disconnect());
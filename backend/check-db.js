const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  try {
    console.log('Testing database connection...');
    const result = await prisma.$queryRaw`SELECT 1`;
    console.log('Connection OK:', JSON.stringify(result));
    
    const tables = await prisma.$queryRawUnsafe("SELECT table_name FROM information_schema.tables WHERE table_name LIKE '%memory%'");
    console.log('Memory-related tables:', JSON.stringify(tables));
    
    // Verify pgvector is available
    const ext = await prisma.$queryRawUnsafe("SELECT extname FROM pg_extension WHERE extname = 'vector'");
    console.log('pgvector extension:', JSON.stringify(ext));
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await prisma.$disconnect();
  }
})();
// Removes leftover integration/unit test data from the database.
//
// All automated tests scope their data to @example.com / @test.com email
// domains, so this script only ever deletes rows created by the test suites —
// never real users. Run from backend/: node scripts/cleanup-db.mjs
import dotenv from 'dotenv';
import path from 'path';
import { PrismaClient } from '@prisma/client';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const prisma = new PrismaClient();
const TEST_DOMAINS = ['@example.com', '@test.com'];

async function main() {
  const res = await prisma.user.deleteMany({
    where: { OR: TEST_DOMAINS.map((d) => ({ email: { endsWith: d } })) },
  });
  console.log(`Removed ${res.count} test user(s) (cascades removed all related onboarding data).`);
}

main()
  .catch((e) => {
    console.error('Cleanup failed:', e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
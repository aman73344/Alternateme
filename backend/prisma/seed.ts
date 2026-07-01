import { PrismaClient } from '@prisma/client';
import { id } from '../src/utils/helpers';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  const admin = await prisma.user.upsert({
    where: { email: 'admin@alterneme.com' },
    update: {},
    create: {
      id: id.generate(),
      email: 'admin@alterneme.com',
      name: 'Admin User',
      role: 'SUPER_ADMIN',
    },
  });

  await prisma.subscription.upsert({
    where: { userId: admin.id },
    update: {},
    create: {
      userId: admin.id,
      tier: 'ENTERPRISE',
      status: 'ACTIVE',
    },
  });

  console.log('Seed completed');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

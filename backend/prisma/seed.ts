import argon2 from 'argon2';
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
      username: 'admin',
      name: 'Admin User',
      role: 'SUPER_ADMIN',
    },
  });

  const existingAdminSubscription = await prisma.subscription.findFirst({
    where: { userId: admin.id },
  });

  if (!existingAdminSubscription) {
    await prisma.subscription.create({
      data: {
        userId: admin.id,
        tier: 'ENTERPRISE',
        status: 'ACTIVE',
      },
    });
  }

  const demoPasswordHash = await argon2.hash('demo123', {
    type: argon2.argon2id,
    memoryCost: 2 ** 16,
    timeCost: 3,
    parallelism: 1,
  });

  await prisma.user.upsert({
    where: { email: 'demo@alternate.me' },
    update: {
      username: 'demo',
      name: 'Demo User',
      passwordHash: demoPasswordHash,
      emailVerified: new Date(),
      isActive: true,
    },
    create: {
      id: id.generate(),
      email: 'demo@alternate.me',
      username: 'demo',
      name: 'Demo User',
      passwordHash: demoPasswordHash,
      emailVerified: new Date(),
      role: 'USER',
      isActive: true,
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

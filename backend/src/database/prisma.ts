import { PrismaClient } from '@prisma/client';
import { config } from '@/config';
import { logger } from '@/utils/logger';

const prisma = new PrismaClient({
  log: [
    { emit: 'event', level: 'query' },
    { emit: 'event', level: 'info' },
    { emit: 'event', level: 'warn' },
    { emit: 'event', level: 'error' },
  ],
  datasources: {
    db: { url: config.database.url },
  },
});

if (config.logging.level === 'debug') {
  prisma.$on('query', (e) => {
    logger.debug({ query: e.query, duration: e.duration }, 'prisma query');
  });
}

prisma.$on('info', (e) => {
  logger.info(e, 'prisma info');
});

prisma.$on('warn', (e) => {
  logger.warn(e, 'prisma warning');
});

prisma.$on('error', (e) => {
  logger.error(e, 'prisma error');
});

export { prisma };

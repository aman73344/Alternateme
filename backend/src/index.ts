import { config } from '@/config';
import { validateEnv } from '@/config/env.validation';
import { app } from '@/app';
import { logger } from '@/utils/logger';
import { closeAllQueues } from '@/queues';

validateEnv();

const server = app.listen(config.app.port, () => {
  logger.info({
    port: config.app.port,
    env: config.app.nodeEnv,
    apiPrefix: config.app.apiPrefix,
    url: `${config.app.url}${config.app.apiPrefix}`,
    docs: `${config.app.url}/docs`,
  }, 'Server started');
});

process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await gracefulShutdown();
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  await gracefulShutdown();
});

process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught exception');
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.fatal({ reason }, 'Unhandled rejection');
  process.exit(1);
});

async function gracefulShutdown(): Promise<void> {
  const shutdownTimeout = 10000;
  const shutdownTimer = setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, shutdownTimeout);

  try {
    server.close(() => {
      logger.info('HTTP server closed');
    });

    await closeAllQueues();
    logger.info('Queues closed');

    const { prisma } = await import('@/database/prisma');
    await prisma.$disconnect();
    logger.info('Database disconnected');

    clearTimeout(shutdownTimer);
    process.exit(0);
  } catch (err) {
    logger.error({ err }, 'Error during shutdown');
    clearTimeout(shutdownTimer);
    process.exit(1);
  }
}

export { app, server };
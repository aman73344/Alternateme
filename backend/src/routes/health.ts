import { Router, Request, Response } from 'express';
import httpStatus from 'http-status';
import { apiResponse } from '@/utils/response';
import { config } from '@/config';

const router = Router();

router.get('/health', (_req: Request, res: Response) => {
  apiResponse.success(res, {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: config.app.apiVersion,
    environment: config.app.nodeEnv,
  });
});

router.get('/health/readiness', async (_req: Request, res: Response) => {
  try {
    const { prisma } = await import('@/database/prisma');
    await prisma.$queryRaw`SELECT 1`;
    apiResponse.success(res, { status: 'ready', database: 'connected' });
  } catch {
    res.status(httpStatus.SERVICE_UNAVAILABLE).json({
      success: false,
      error: { code: 'SERVICE_UNAVAILABLE', message: 'Database not ready' },
    });
  }
});

router.get('/health/liveness', (_req: Request, res: Response) => {
  apiResponse.success(res, { status: 'alive' });
});

export { router as healthRouter };

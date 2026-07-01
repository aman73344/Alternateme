import { Request, Response } from 'express';
import { apiResponse } from '@/utils/response';
import { config } from '@/config';

export class HealthController {
  check(_req: Request, res: Response): void {
    apiResponse.success(res, {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: config.app.apiVersion,
      environment: config.app.nodeEnv,
    });
  }
}

export const healthController = new HealthController();

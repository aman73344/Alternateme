import { Request, Response, NextFunction } from 'express';
import httpStatus from 'http-status';
import { logger } from '@/utils/logger';
import { BaseError } from '@/utils/errors';
import { config } from '@/config';
import type { ApiResponse } from '@/utils/response';

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof BaseError) {
    logger.warn({ err, requestId: req.id }, 'Operational error');

    const response: ApiResponse = {
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: config.app.nodeEnv === 'development' ? err.details : undefined,
      },
    };

    res.status(err.statusCode).json(response);
    return;
  }

  logger.error({ err, requestId: req.id }, 'Unhandled error');

  const response: ApiResponse = {
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: config.app.nodeEnv === 'production'
        ? 'An unexpected error occurred'
        : err.message,
    },
  };

  res.status(httpStatus.INTERNAL_SERVER_ERROR).json(response);
}

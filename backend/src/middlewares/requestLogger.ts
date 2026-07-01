import { Request, Response, NextFunction } from 'express';
import { logger } from '@/utils/logger';

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info({
      req,
      res: { ...res, duration },
      requestId: req.id,
    }, 'request completed');
  });

  next();
}

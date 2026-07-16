import { Request, Response, NextFunction } from 'express';

/**
 * Wraps an async route handler to properly forward rejected promises
 * to Express error handler. Without this, Express 4.x ignores rejected
 * promises from async handlers, causing requests to hang indefinitely.
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
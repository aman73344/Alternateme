import { Request, Response } from 'express';
import httpStatus from 'http-status';
import type { ApiResponse } from '@/utils/response';

export function notFoundHandler(req: Request, res: Response): void {
  const response: ApiResponse = {
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.path} not found`,
    },
  };
  res.status(httpStatus.NOT_FOUND).json(response);
}

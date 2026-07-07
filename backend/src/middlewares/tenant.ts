import { Request, Response, NextFunction } from 'express';

declare global {
  namespace Express {
    interface Request {
      tenantId?: string;
      userId?: string;
    }
  }
}

export function tenantResolver(req: Request, _res: Response, next: NextFunction): void {
  const tenantId = req.headers['x-tenant-id'] as string;
  const userId = req.headers['x-user-id'] as string;

  if (tenantId) {
    req.tenantId = tenantId;
  }

  if (userId) {
    req.userId = userId;
  }

  next();
}

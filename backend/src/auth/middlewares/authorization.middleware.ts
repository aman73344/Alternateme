import { Request, Response, NextFunction } from 'express';
import { UserRole } from '@prisma/client';
import { AuthorizationError } from '@/utils/errors';

export function authorizeRole(requiredRoles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.authUser) {
      next(new AuthorizationError('Unauthorized'));
      return;
    }
    if (!requiredRoles.includes(req.authUser.role)) {
      next(new AuthorizationError('Insufficient role permissions'));
      return;
    }
    next();
  };
}

export function authorizePermission(requiredPermissions: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.authUser) {
      next(new AuthorizationError('Unauthorized'));
      return;
    }

    const userPermissions = req.authUser.permissions ?? [];
    const hasPermission = requiredPermissions.every((permission) => userPermissions.includes(permission));

    if (!hasPermission) {
      next(new AuthorizationError('Insufficient permissions'));
      return;
    }

    next();
  };
}

export function authorizeOwnership(getResourceOwnerId: (req: Request) => string | undefined) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.authUser) {
      next(new AuthorizationError('Unauthorized'));
      return;
    }

    const ownerId = getResourceOwnerId(req);
    if (!ownerId || ownerId !== req.authUser.id) {
      next(new AuthorizationError('You can only access your own resources'));
      return;
    }

    next();
  };
}

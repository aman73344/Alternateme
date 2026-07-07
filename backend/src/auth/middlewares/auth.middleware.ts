import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '@/auth/utils/jwt';
import { AuthenticationError } from '@/utils/errors';

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    next(new AuthenticationError('Authorization header missing or malformed'));
    return;
  }
  const token = authHeader.replace('Bearer ', '').trim();
  try {
    const payload = verifyAccessToken(token);
    req.authUser = {
      id: payload.sub,
      email: payload.email,
      username: payload.username,
      role: payload.role,
      tenantId: payload.tenantId ?? undefined,
      permissions: payload.permissions ?? [],
    };
    req.authSessionId = payload.sid;
    next();
  } catch (error) {
    next(new AuthenticationError('Invalid or expired access token'));
  }
}

export function optionalAuthenticate(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    next();
    return;
  }

  const token = authHeader.replace('Bearer ', '').trim();
  try {
    const payload = verifyAccessToken(token);
    req.authUser = {
      id: payload.sub,
      email: payload.email,
      username: payload.username,
      role: payload.role,
      tenantId: payload.tenantId ?? undefined,
      permissions: payload.permissions ?? [],
    };
    req.authSessionId = payload.sid;
    next();
  } catch (error) {
    next();
  }
}

export const currentUserMiddleware = authenticate;

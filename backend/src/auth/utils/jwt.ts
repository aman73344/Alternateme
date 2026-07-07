import * as jwt from 'jsonwebtoken';
import { config } from '@/config';
import { UserRole } from '@prisma/client';

export interface AccessTokenPayload {
  jti: string;
  sub: string;
  email: string;
  username: string;
  role: UserRole;
  tenantId?: string | null;
  sid?: string;
  permissions?: string[];
}

export function signAccessToken(payload: AccessTokenPayload): string {
  return (jwt.sign as any)(payload, config.jwt.accessSecret, {
    algorithm: 'HS512',
    expiresIn: config.jwt.accessExpiry,
    issuer: config.jwt.issuer,
    audience: config.jwt.audience,
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return (jwt.verify as any)(token, config.jwt.accessSecret, {
    algorithms: ['HS512'],
    issuer: config.jwt.issuer,
    audience: config.jwt.audience,
  }) as AccessTokenPayload;
}

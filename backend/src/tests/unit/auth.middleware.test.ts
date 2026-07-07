import { describe, it, expect, vi } from 'vitest';
import { authenticate, optionalAuthenticate } from '@/auth/middlewares/auth.middleware';
import { authorizeOwnership } from '@/auth/middlewares/authorization.middleware';
import { signAccessToken } from '@/auth/utils/jwt';

function createReq(headers: Record<string, string> = {}) {
  return { headers } as any;
}

describe('auth middleware', () => {
  it('attaches auth context from a bearer token', () => {
    const req = createReq({
      authorization: `Bearer ${signAccessToken({
        jti: 'jwt-1',
        sub: 'user-1',
        email: 'user@example.com',
        username: 'user',
        role: 'USER',
        sid: 'session-1',
      })}`,
    });
    const next = vi.fn();

    authenticate(req, {} as any, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.authUser?.id).toBe('user-1');
    expect(req.authSessionId).toBe('session-1');
  });

  it('allows optional auth middleware to continue when no token is present', () => {
    const req = createReq({});
    const next = vi.fn();

    optionalAuthenticate(req, {} as any, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.authUser).toBeUndefined();
  });

  it('authorizes ownership when the requester owns the resource', () => {
    const req = { authUser: { id: 'user-1' } } as any;
    const next = vi.fn();

    authorizeOwnership((request: any) => request.authUser.id)(req, {} as any, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('rejects ownership when the requester does not own the resource', () => {
    const req = { authUser: { id: 'user-2' } } as any;
    const next = vi.fn();

    authorizeOwnership((request: any) => request.authUser.id)(req, {} as any, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});

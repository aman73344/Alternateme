import { UserRole } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      authUser?: {
        id: string;
        email: string;
        username: string;
        role: UserRole;
        tenantId?: string;
        permissions?: string[];
      };
      authSessionId?: string;
      tenantId?: string;
    }
  }
}

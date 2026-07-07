import { Request, Response, NextFunction } from 'express';
import { apiResponse } from '@/utils/response';
import { getActiveSessions, revokeSessionById, revokeAllUserSessions } from '@/auth/services/session.service';

export class SessionsController {
  async getSessions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const sessions = await getActiveSessions(req.authUser?.id as string);
      apiResponse.success(res, sessions);
    } catch (error) {
      next(error);
    }
  }

  async revokeSession(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      await revokeSessionById(req.authUser?.id as string, id);
      apiResponse.success(res, { message: 'Session revoked' });
    } catch (error) {
      next(error);
    }
  }

  async revokeAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await revokeAllUserSessions(req.authUser?.id as string);
      apiResponse.success(res, { message: 'All sessions revoked' });
    } catch (error) {
      next(error);
    }
  }
}

export const sessionsController = new SessionsController();

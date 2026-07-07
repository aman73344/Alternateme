import { Request, Response, NextFunction } from 'express';
import { apiResponse } from '@/utils/response';
import {
  updateUserProfile,
  updateUserPassword,
  changeUserEmail,
  updateUserPreferences,
  updateUserAvatar,
  deleteUserAccount,
  getCurrentUser,
} from '@/auth/services/user.service';

export class UserController {
  async getProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await getCurrentUser(req.authUser?.id as string);
      apiResponse.success(res, user);
    } catch (error) {
      next(error);
    }
  }

  async updateProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const update = req.body;
      const user = await updateUserProfile(req.authUser?.id as string, update);
      apiResponse.success(res, user);
    } catch (error) {
      next(error);
    }
  }

  async updatePassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { currentPassword, newPassword } = req.body;
      await updateUserPassword(req.authUser?.id as string, currentPassword, newPassword);
      apiResponse.success(res, { message: 'Password updated successfully' });
    } catch (error) {
      next(error);
    }
  }

  async changeEmail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { newEmail, currentPassword } = req.body;
      await changeUserEmail(req.authUser?.id as string, newEmail, currentPassword);
      apiResponse.success(res, { message: 'Email change initiated' });
    } catch (error) {
      next(error);
    }
  }

  async updatePreferences(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const preferences = req.body;
      const preference = await updateUserPreferences(req.authUser?.id as string, preferences);
      apiResponse.success(res, preference);
    } catch (error) {
      next(error);
    }
  }

  async updateAvatar(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { avatarUrl } = req.body;
      const user = await updateUserAvatar(req.authUser?.id as string, avatarUrl);
      apiResponse.success(res, user);
    } catch (error) {
      next(error);
    }
  }

  async deleteAccount(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { currentPassword } = req.body;
      await deleteUserAccount(req.authUser?.id as string, currentPassword);
      apiResponse.success(res, { message: 'Account deleted successfully' });
    } catch (error) {
      next(error);
    }
  }
}

export const userController = new UserController();

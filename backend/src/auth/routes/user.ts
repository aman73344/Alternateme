import { Router } from 'express';
import { userController } from '@/auth/controllers/user.controller';
import { validate } from '@/middlewares/validate';
import { asyncHandler } from '@/utils/asyncHandler';
import {
  updateProfileSchema,
  updatePasswordSchema,
  changeEmailSchema,
  updatePreferencesSchema,
  avatarUpdateSchema,
  deleteAccountSchema,
} from '@/auth/validators/user.validator';
import { authenticate } from '@/auth/middlewares/auth.middleware';

const router: import('express').Router = Router();

router.use(authenticate);
router.get('/', asyncHandler((req, res, next) => userController.getProfile(req, res, next)));
router.put('/', validate(updateProfileSchema), asyncHandler((req, res, next) => userController.updateProfile(req, res, next)));
router.patch('/password', validate(updatePasswordSchema), asyncHandler((req, res, next) => userController.updatePassword(req, res, next)));
router.patch('/email', validate(changeEmailSchema), asyncHandler((req, res, next) => userController.changeEmail(req, res, next)));
router.patch('/preferences', validate(updatePreferencesSchema), asyncHandler((req, res, next) => userController.updatePreferences(req, res, next)));
router.patch('/avatar', validate(avatarUpdateSchema), asyncHandler((req, res, next) => userController.updateAvatar(req, res, next)));
router.delete('/', validate(deleteAccountSchema), asyncHandler((req, res, next) => userController.deleteAccount(req, res, next)));

export { router as userRouter };
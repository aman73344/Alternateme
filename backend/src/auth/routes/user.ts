import { Router } from 'express';
import { userController } from '@/auth/controllers/user.controller';
import { validate } from '@/middlewares/validate';
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
router.get('/', (req, res, next) => userController.getProfile(req, res, next));
router.put('/', validate(updateProfileSchema), (req, res, next) => userController.updateProfile(req, res, next));
router.patch('/password', validate(updatePasswordSchema), (req, res, next) => userController.updatePassword(req, res, next));
router.patch('/email', validate(changeEmailSchema), (req, res, next) => userController.changeEmail(req, res, next));
router.patch('/preferences', validate(updatePreferencesSchema), (req, res, next) => userController.updatePreferences(req, res, next));
router.patch('/avatar', validate(avatarUpdateSchema), (req, res, next) => userController.updateAvatar(req, res, next));
router.delete('/', validate(deleteAccountSchema), (req, res, next) => userController.deleteAccount(req, res, next));

export { router as userRouter };

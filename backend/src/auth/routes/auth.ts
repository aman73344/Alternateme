import { Router } from 'express';
import { authController } from '@/auth/controllers/auth.controller';
import { validate } from '@/middlewares/validate';
import { authRateLimiter } from '@/middlewares/rateLimiter';
import { authenticate } from '@/auth/middlewares/auth.middleware';
import {
  registerSchema,
  loginSchema,
  refreshSchema,
  verifyEmailSchema,
  resendVerificationSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '@/auth/validators/auth.validator';

const router: import('express').Router = Router();

router.post('/register', authRateLimiter, validate(registerSchema), (req, res, next) => authController.register(req, res, next));
router.post('/login', authRateLimiter, validate(loginSchema), (req, res, next) => authController.login(req, res, next));
router.post('/refresh', authRateLimiter, validate(refreshSchema), (req, res, next) => authController.refresh(req, res, next));
router.post('/logout', authenticate, (req, res, next) => authController.logout(req, res, next));
router.post('/logout-all', authenticate, (req, res, next) => authController.logoutAll(req, res, next));
router.post('/verify-email', authRateLimiter, validate(verifyEmailSchema), (req, res, next) => authController.verifyEmail(req, res, next));
router.post('/resend-verification', authRateLimiter, validate(resendVerificationSchema), (req, res, next) => authController.resendVerification(req, res, next));
router.post('/forgot-password', authRateLimiter, validate(forgotPasswordSchema), (req, res, next) => authController.forgotPassword(req, res, next));
router.post('/reset-password', authRateLimiter, validate(resetPasswordSchema), (req, res, next) => authController.resetPassword(req, res, next));
router.get('/google', (req, res, next) => authController.googleAuth(req, res, next));
router.get('/google/callback', (req, res, next) => authController.googleCallback(req, res, next));
router.get('/github', (req, res, next) => authController.githubAuth(req, res, next));
router.get('/github/callback', (req, res, next) => authController.githubCallback(req, res, next));

export { router as authRouter };

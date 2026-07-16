import { Router } from 'express';
import { sessionsController } from '@/auth/controllers/sessions.controller';
import { authenticate } from '@/auth/middlewares/auth.middleware';
import { asyncHandler } from '@/utils/asyncHandler';

const router: import('express').Router = Router();

router.use(authenticate);
router.get('/', asyncHandler((req, res, next) => sessionsController.getSessions(req, res, next)));
router.delete('/:id', asyncHandler((req, res, next) => sessionsController.revokeSession(req, res, next)));
router.delete('/', asyncHandler((req, res, next) => sessionsController.revokeAll(req, res, next)));

export { router as sessionsRouter };
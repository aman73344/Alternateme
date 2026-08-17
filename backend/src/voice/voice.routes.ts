import { Router } from 'express';
import { voiceController } from './voice.controller';
import { validate } from '@/middlewares/validate';
import { authenticate } from '@/auth/middlewares/auth.middleware';
import { requireAlternateOwnership } from '@/middlewares/ownership';
import { voiceSchema } from '@/onboarding/onboarding.schema';
import { asyncHandler } from '@/utils/asyncHandler';

const router: import('express').Router = Router();

router.use(authenticate);

router.get('/providers', asyncHandler((req, res) => voiceController.getProviders(req, res)));

router.put('/alternates/:alternateId/voice', requireAlternateOwnership, validate(voiceSchema), asyncHandler((req, res) => voiceController.saveVoice(req, res)));

export { router as voiceRouter };
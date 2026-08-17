import { Router } from 'express';
import { onboardingController } from './onboarding.controller';
import { sourceController } from '@/sources/source.controller';
import { validate } from '@/middlewares/validate';
import { authenticate } from '@/auth/middlewares/auth.middleware';
import { requireAlternateOwnership } from '@/middlewares/ownership';
import { createSourceSchema } from '@/sources/source.schema';
import {
  startOnboardingSchema,
  personalInfoSchema,
  personaSchema,
  voiceSchema,
  aiProviderSchema,
  publishSchema,
  stepCompletionSchema,
} from './onboarding.schema';
import { asyncHandler } from '@/utils/asyncHandler';

const router: import('express').Router = Router();

router.use(authenticate);

router.post('/start', validate(startOnboardingSchema), asyncHandler((req, res) => onboardingController.startOnboarding(req, res)));

router.get('/', asyncHandler((req, res) => onboardingController.getOnboardingStatus(req, res)));

router.post('/personal', validate(personalInfoSchema), asyncHandler((req, res) => onboardingController.savePersonalInfo(req, res)));

// Register a training source during onboarding
router.post('/sources', validate(createSourceSchema), asyncHandler((req, res) => sourceController.createSource(req, res)));

router.put('/persona', validate(personaSchema), asyncHandler((req, res) => onboardingController.savePersona(req, res)));

router.put('/voice', validate(voiceSchema), asyncHandler((req, res) => onboardingController.saveVoice(req, res)));

router.put('/ai-provider', validate(aiProviderSchema), asyncHandler((req, res) => onboardingController.saveAIProvider(req, res)));

// Server-verified step completion
router.post('/steps/:alternateId/complete', requireAlternateOwnership, validate(stepCompletionSchema), asyncHandler((req, res) => onboardingController.completeStep(req, res)));

router.get('/preview/:alternateId', requireAlternateOwnership, asyncHandler((req, res) => onboardingController.getPreview(req, res)));

router.post('/publish', validate(publishSchema), asyncHandler((req, res) => onboardingController.publishAlternate(req, res)));

export { router as onboardingRouter };
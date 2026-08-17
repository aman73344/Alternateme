import { Router } from 'express';
import { providerController } from './provider.controller';
import { validate } from '@/middlewares/validate';
import { authenticate } from '@/auth/middlewares/auth.middleware';
import { requireAlternateOwnership } from '@/middlewares/ownership';
import { aiProviderSchema } from '@/onboarding/onboarding.schema';
import { asyncHandler } from '@/utils/asyncHandler';

const router: import('express').Router = Router();

router.use(authenticate);

router.put('/alternates/:alternateId/ai-provider', requireAlternateOwnership, validate(aiProviderSchema), asyncHandler((req, res) => providerController.saveProvider(req, res)));

router.delete('/alternates/:alternateId/ai-provider', requireAlternateOwnership, asyncHandler((req, res) => providerController.removeProvider(req, res)));

export { router as providerRouter };
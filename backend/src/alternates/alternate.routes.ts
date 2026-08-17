import { Router } from 'express';
import { alternateController } from './alternate.controller';
import { sourceController } from '@/sources/source.controller';
import { voiceController } from '@/voice/voice.controller';
import { validate } from '@/middlewares/validate';
import { authenticate } from '@/auth/middlewares/auth.middleware';
import { requireAlternateOwnership } from '@/middlewares/ownership';
import {
  createAlternateSchema,
  updateAlternateSchema,
} from './alternate.schema';
import { voiceSchema } from '@/onboarding/onboarding.schema';
import { asyncHandler } from '@/utils/asyncHandler';

const router: import('express').Router = Router();

router.use(authenticate);

router.post('/', validate(createAlternateSchema), asyncHandler((req, res) => alternateController.createAlternate(req, res)));

// Availability check must be before /:id routes
router.get('/username/:username/availability', asyncHandler((req, res) => alternateController.checkUsernameAvailability(req, res)));

router.get('/', asyncHandler((req, res) => alternateController.getUserAlternates(req, res)));

// Sub-resources must be declared before /:id to avoid route shadowing
// Knowledge source sub-resources (spec: /alternates/:alternateId/sources)
router.get('/:alternateId/sources', requireAlternateOwnership, asyncHandler((req, res) => sourceController.getSources(req, res)));

router.delete('/:alternateId/sources/:sourceId', requireAlternateOwnership, asyncHandler((req, res) => sourceController.deleteSource(req, res)));

// Voice sub-resource (spec: /alternates/:alternateId/voice)
router.put('/:alternateId/voice', requireAlternateOwnership, validate(voiceSchema), asyncHandler((req, res) => voiceController.saveVoice(req, res)));

router.get('/:id', requireAlternateOwnership, asyncHandler((req, res) => alternateController.getAlternate(req, res)));

router.put('/:id', requireAlternateOwnership, validate(updateAlternateSchema), asyncHandler((req, res) => alternateController.updateAlternate(req, res)));

router.delete('/:id', requireAlternateOwnership, asyncHandler((req, res) => alternateController.deleteAlternate(req, res)));

export { router as alternateRouter };
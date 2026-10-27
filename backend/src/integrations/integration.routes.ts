import { Router } from 'express';
import { authenticate } from '@/auth/middlewares/auth.middleware';
import { requireAlternateOwnership } from '@/middlewares/ownership';
import { validate } from '@/middlewares/validate';
import { asyncHandler } from '@/utils/asyncHandler';
import { integrationController } from './integration.controller';
import {
  GoogleOAuthCallbackQuerySchema,
  IntegrationAlternateParamsSchema,
  IntegrationExecutionsQuerySchema,
  IntegrationProviderParamsSchema,
} from './integration.schemas';

const router: import('express').Router = Router();

router.get(
  '/oauth/google/callback',
  validate(GoogleOAuthCallbackQuerySchema, 'query'),
  asyncHandler((req, res) => integrationController.finishGoogleOAuth(req, res)),
);

router.use(authenticate);
router.get(
  '/providers',
  asyncHandler((req, res) => integrationController.listProviders(req, res)),
);
router.get(
  '/alternates/:alternateId/connections',
  validate(IntegrationAlternateParamsSchema, 'params'),
  requireAlternateOwnership,
  asyncHandler((req, res) => integrationController.listConnections(req, res)),
);
router.post(
  '/alternates/:alternateId/oauth/google/start',
  validate(IntegrationAlternateParamsSchema, 'params'),
  requireAlternateOwnership,
  asyncHandler((req, res) => integrationController.startGoogleOAuth(req, res)),
);
router.delete(
  '/alternates/:alternateId/connections/:provider',
  validate(IntegrationProviderParamsSchema, 'params'),
  requireAlternateOwnership,
  asyncHandler((req, res) => integrationController.disconnect(req, res)),
);
router.get(
  '/alternates/:alternateId/executions',
  validate(IntegrationAlternateParamsSchema, 'params'),
  validate(IntegrationExecutionsQuerySchema, 'query'),
  requireAlternateOwnership,
  asyncHandler((req, res) => integrationController.listExecutions(req, res)),
);

export { router as integrationRouter };

import { Router } from 'express';
import { sourceController } from './source.controller';
import { validate } from '@/middlewares/validate';
import { authenticate } from '@/auth/middlewares/auth.middleware';
import { requireAlternateOwnership } from '@/middlewares/ownership';
import { createSourceSchema } from './source.schema';
import { asyncHandler } from '@/utils/asyncHandler';

const router: import('express').Router = Router();

router.use(authenticate);

// POST /sources — create a training source (standalone)
router.post('/', validate(createSourceSchema), asyncHandler((req, res) => sourceController.createSource(req, res)));

// GET /sources/alternates/:alternateId/sources — list sources for an alternate
router.get('/alternates/:alternateId/sources', requireAlternateOwnership, asyncHandler((req, res) => sourceController.getSources(req, res)));

// DELETE /sources/alternates/:alternateId/sources/:sourceId — delete a source
router.delete('/alternates/:alternateId/sources/:sourceId', requireAlternateOwnership, asyncHandler((req, res) => sourceController.deleteSource(req, res)));

export { router as sourceRouter };
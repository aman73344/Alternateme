import { Router } from 'express';
import { sourceController } from './source.controller';
import { validate } from '@/middlewares/validate';
import { authenticate } from '@/auth/middlewares/auth.middleware';
import { requireAlternateOwnership } from '@/middlewares/ownership';
import { createSourceSchema, reprocessSourceSchema } from './source.schema';
import { asyncHandler } from '@/utils/asyncHandler';

const router: import('express').Router = Router();

router.use(authenticate);

// POST /sources — create a training source (standalone)
router.post('/', validate(createSourceSchema), asyncHandler((req, res) => sourceController.createSource(req, res)));

// GET /sources/alternates/:alternateId/sources — list sources for an alternate
router.get('/alternates/:alternateId/sources', requireAlternateOwnership, asyncHandler((req, res) => sourceController.getSources(req, res)));

// GET /sources/alternates/:alternateId/sources/:sourceId — detailed status
router.get('/alternates/:alternateId/sources/:sourceId', requireAlternateOwnership, asyncHandler((req, res) => sourceController.getSourceStatus(req, res)));

// POST /sources/alternates/:alternateId/sources/:sourceId/reprocess
router.post('/alternates/:alternateId/sources/:sourceId/reprocess', requireAlternateOwnership, validate(reprocessSourceSchema), asyncHandler((req, res) => sourceController.reprocessSource(req, res)));

// DELETE /sources/alternates/:alternateId/sources/:sourceId — delete a source
router.delete('/alternates/:alternateId/sources/:sourceId', requireAlternateOwnership, asyncHandler((req, res) => sourceController.deleteSource(req, res)));

// GET /sources/alternates/:alternateId/knowledge/status — aggregate status
router.get('/alternates/:alternateId/knowledge/status', requireAlternateOwnership, asyncHandler((req, res) => sourceController.getKnowledgeStatus(req, res)));

export { router as sourceRouter };
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

/**
 * @openapi
 * /sources:
 *   post:
 *     summary: Register a training source
 *     tags: [Sources]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [alternateId, type, name]
 *             properties:
 *               alternateId: { type: string, format: uuid }
 *               type: { type: string, enum: [FILE, URL, LINKEDIN, YOUTUBE, OTHER] }
 *               name: { type: string }
 *               url: { type: string }
 *               fileName: { type: string }
 *               mimeType: { type: string }
 *               fileContent: { type: string, description: base64 file bytes (FILE sources) }
 *     responses:
 *       201: { description: Source created; ingestion job queued (status PENDING) }
 *       400: { description: Validation error | UNSUPPORTED_FILE_TYPE | FILE_TOO_LARGE }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */

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
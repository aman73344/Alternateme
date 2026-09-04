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
import { reprocessSourceSchema } from '@/sources/source.schema';
import { asyncHandler } from '@/utils/asyncHandler';

const router: import('express').Router = Router();

router.use(authenticate);

router.post('/', validate(createAlternateSchema), asyncHandler((req, res) => alternateController.createAlternate(req, res)));

// Availability check must be before /:id routes
router.get('/username/:username/availability', asyncHandler((req, res) => alternateController.checkUsernameAvailability(req, res)));

router.get('/', asyncHandler((req, res) => alternateController.getUserAlternates(req, res)));

// Sub-resources must be declared before /:id to avoid route shadowing
// Knowledge source sub-resources (spec: /alternates/:alternateId/sources)
/**
 * @openapi
 * /alternates/{alternateId}/sources:
 *   get:
 *     summary: List knowledge sources for an alternate
 *     tags: [Sources]
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ name: alternateId, in: path, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: Sources with status, version, chunk/doc counts }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { description: Not the alternate owner }
 */
router.get('/:alternateId/sources', requireAlternateOwnership, asyncHandler((req, res) => sourceController.getSources(req, res)));

/**
 * @openapi
 * /alternates/{alternateId}/sources/{sourceId}:
 *   get:
 *     summary: Detailed source status (stage, progress, job state, error)
 *     tags: [Sources]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { name: alternateId, in: path, required: true, schema: { type: string } }
 *       - { name: sourceId, in: path, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Status incl. processingStage, progress, jobStatus, chunkCount, documentCount, version }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { description: Not the alternate owner }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.get('/:alternateId/sources/:sourceId', requireAlternateOwnership, asyncHandler((req, res) => sourceController.getSourceStatus(req, res)));

/**
 * @openapi
 * /alternates/{alternateId}/sources/{sourceId}/reprocess:
 *   post:
 *     summary: Queue a source for reprocessing (new knowledge version)
 *     tags: [Sources]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { name: alternateId, in: path, required: true, schema: { type: string } }
 *       - { name: sourceId, in: path, required: true, schema: { type: string } }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               force: { type: boolean, description: bypass checksum idempotency and create a new version }
 *     responses:
 *       200: { description: Reprocessing job queued (QUEUED) }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { description: Not the alternate owner }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.post('/:alternateId/sources/:sourceId/reprocess', requireAlternateOwnership, validate(reprocessSourceSchema), asyncHandler((req, res) => sourceController.reprocessSource(req, res)));

/**
 * @openapi
 * /alternates/{alternateId}/sources/{sourceId}:
 *   delete:
 *     summary: Soft-delete a source and exclude its knowledge from retrieval
 *     tags: [Sources]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { name: alternateId, in: path, required: true, schema: { type: string } }
 *       - { name: sourceId, in: path, required: true, schema: { type: string } }
 *     responses:
 *       204: { description: Deleted; async cleanup purges chunks/vectors later }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { description: Not the alternate owner }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.delete('/:alternateId/sources/:sourceId', requireAlternateOwnership, asyncHandler((req, res) => sourceController.deleteSource(req, res)));

/**
 * @openapi
 * /alternates/{alternateId}/knowledge/status:
 *   get:
 *     summary: Aggregate knowledge status for an alternate
 *     tags: [Sources]
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ name: alternateId, in: path, required: true, schema: { type: string } }]
 *     responses:
 *       200:
 *         description: totalSources, readySources, processingSources, failedSources, totalDocuments, totalChunks, lastProcessedAt
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { description: Not the alternate owner }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.get('/:alternateId/knowledge/status', requireAlternateOwnership, asyncHandler((req, res) => sourceController.getKnowledgeStatus(req, res)));

// Voice sub-resource (spec: /alternates/:alternateId/voice)
router.put('/:alternateId/voice', requireAlternateOwnership, validate(voiceSchema), asyncHandler((req, res) => voiceController.saveVoice(req, res)));

router.get('/:id', requireAlternateOwnership, asyncHandler((req, res) => alternateController.getAlternate(req, res)));

router.put('/:id', requireAlternateOwnership, validate(updateAlternateSchema), asyncHandler((req, res) => alternateController.updateAlternate(req, res)));

router.delete('/:id', requireAlternateOwnership, asyncHandler((req, res) => alternateController.deleteAlternate(req, res)));

export { router as alternateRouter };
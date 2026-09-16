/**
 * Memory Routes
 *
 * Owner-facing memory management APIs.
 * All routes require authentication and alternate ownership.
 */

import { Router, Router as ExpressRouter } from 'express';
import {
  listMemories,
  getMemory,
  updateMemoryEndpoint,
  deleteMemoryEndpoint,
  confirmMemory,
  archiveMemory,
  forgetMemoryByContent,
} from './memory.controller';
import { requireAlternateOwnership } from '@/middlewares/ownership';

const memoryRouter: ExpressRouter = Router({ mergeParams: true });
/**
 * All memory routes are prefixed with `/:alternateId/memories`
 * and registered at the `/alternates` base path.
 */

/** GET /alternates/:alternateId/memories — list memories */
memoryRouter.get('/', requireAlternateOwnership, listMemories);

/** GET /alternates/:alternateId/memories/:memoryId — get single memory */
memoryRouter.get('/:memoryId', requireAlternateOwnership, getMemory);

/** PUT /alternates/:alternateId/memories/:memoryId — update memory */
memoryRouter.put('/:memoryId', requireAlternateOwnership, updateMemoryEndpoint);

/** DELETE /alternates/:alternateId/memories/:memoryId — delete memory */
memoryRouter.delete('/:memoryId', requireAlternateOwnership, deleteMemoryEndpoint);

/** POST /alternates/:alternateId/memories/:memoryId/confirm */
memoryRouter.post('/:memoryId/confirm', requireAlternateOwnership, confirmMemory);

/** POST /alternates/:alternateId/memories/:memoryId/archive */
memoryRouter.post('/:memoryId/archive', requireAlternateOwnership, archiveMemory);

/** POST /alternates/:alternateId/memories/forget */
memoryRouter.post('/forget', requireAlternateOwnership, forgetMemoryByContent);

export { memoryRouter };

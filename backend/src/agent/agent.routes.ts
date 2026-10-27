/**
 * Agent Routes
 *
 * Mounted at `/alternates` (see routes/index.ts), so every path is prefixed
 * with `/:alternateId`. All routes require authentication AND alternate
 * ownership — the agent surface is owner-only, because approval decisions and
 * tool configuration are owner powers.
 *
 * Rate limits are applied per surface: run creation is the expensive one.
 */

import { Router, Router as ExpressRouter } from 'express';
import { authenticate } from '@/auth/middlewares/auth.middleware';
import { requireAlternateOwnership } from '@/middlewares/ownership';
import { agentRunRateLimiter, agentToolRateLimiter } from '@/middlewares/rateLimiter';
import { asyncHandler } from '@/utils/asyncHandler';
import {
  startAgentRun,
  listAgentRuns,
  getAgentRun,
  getAgentRunExecutions,
  listAgentApprovals,
  approveAgentAction,
  rejectAgentAction,
  listAgentTools,
  configureAgentTool,
} from './agent.controller';

const agentRouter: ExpressRouter = Router({ mergeParams: true });

agentRouter.use(authenticate);
agentRouter.use('/:alternateId', requireAlternateOwnership);

// --- runs (expensive: each may trigger LLM + tool calls) ------------------
agentRouter.post('/runs', agentRunRateLimiter, asyncHandler(startAgentRun));
agentRouter.get('/runs', asyncHandler(listAgentRuns));
agentRouter.get('/runs/:runId', asyncHandler(getAgentRun));
agentRouter.get('/runs/:runId/executions', asyncHandler(getAgentRunExecutions));

// --- approvals ------------------------------------------------------------
agentRouter.get('/approvals', asyncHandler(listAgentApprovals));
agentRouter.post(
  '/approvals/:approvalId/approve',
  agentToolRateLimiter,
  asyncHandler(approveAgentAction),
);
agentRouter.post(
  '/approvals/:approvalId/reject',
  agentToolRateLimiter,
  asyncHandler(rejectAgentAction),
);

// --- tool configuration ---------------------------------------------------
agentRouter.get('/tools', asyncHandler(listAgentTools));
agentRouter.put('/tools/:toolName', agentToolRateLimiter, asyncHandler(configureAgentTool));

export { agentRouter };

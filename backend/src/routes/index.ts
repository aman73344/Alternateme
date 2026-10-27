import { Router } from 'express';
import { healthRouter } from './health';
import { authRouter, userRouter, sessionsRouter } from '@/auth/routes';
import { alternateRouter } from '@/alternates/alternate.routes';
import { onboardingRouter } from '@/onboarding/onboarding.routes';
import { publicRouter } from '@/alternates/public.routes';
import { sourceRouter } from '@/sources/source.routes';
import { voiceRouter } from '@/voice/voice.routes';
import { providerRouter } from '@/ai-providers/provider.routes';
import { chatRouter } from '@/chat/chat.routes';
import { memoryRouter } from '@/memory/memory.routes';
import { agentRouter } from '@/agent/agent.routes';
import { integrationRouter } from '@/integrations/integration.routes';

const router: import('express').Router = Router();

router.use(healthRouter);
router.use('/auth', authRouter);
router.use('/me', userRouter);
router.use('/account', userRouter);
router.use('/sessions', sessionsRouter);
router.use('/alternates', alternateRouter);
router.use('/onboarding', onboardingRouter);
router.use('/public', publicRouter);
router.use('/sources', sourceRouter);
router.use('/voice', voiceRouter);
router.use('/ai-providers', providerRouter);
router.use('/alternates', chatRouter);
router.use('/alternates', memoryRouter);
// Phase 6 — agent orchestration & tool execution (owner-only surface)
router.use('/alternates', agentRouter);
router.use('/integrations', integrationRouter);

export { router as apiRouter };

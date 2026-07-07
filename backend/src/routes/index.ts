import { Router } from 'express';
import { healthRouter } from './health';
import { authRouter, userRouter, sessionsRouter } from '@/auth/routes';

const router: import('express').Router = Router();

router.use(healthRouter);
router.use('/auth', authRouter);
router.use('/me', userRouter);
router.use('/account', userRouter);
router.use('/sessions', sessionsRouter);

export { router as apiRouter };

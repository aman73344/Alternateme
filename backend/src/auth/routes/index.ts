import { Router } from 'express';
import { authRouter } from './auth';
import { userRouter } from './user';
import { sessionsRouter } from './sessions';

const router: import('express').Router = Router();

router.use('/auth', authRouter);
router.use('/me', userRouter);
router.use('/sessions', sessionsRouter);

export { router as authRoutes, authRouter, userRouter, sessionsRouter };

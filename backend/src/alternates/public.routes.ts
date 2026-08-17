import { Router } from 'express';
import { publicController } from './public.controller';
import { asyncHandler } from '@/utils/asyncHandler';

const router: import('express').Router = Router();

router.get('/:username', asyncHandler((req, res) => publicController.getPublicAlternate(req, res)));

export { router as publicRouter };
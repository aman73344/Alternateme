import { Request, Response, NextFunction } from 'express';
import { prisma } from '@/database';
import { NotFoundError, AuthorizationError } from '@/utils/errors';

export async function requireAlternateOwnership(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const alternateId = req.params.id || req.params.alternateId;
  const userId = req.authUser?.id;

  if (!alternateId || !userId) {
    next(new AuthorizationError('Alternate ID and authenticated user required'));
    return;
  }

  const alternate = await prisma.alternate.findFirst({
    where: {
      id: alternateId,
      userId,
      deletedAt: null,
    },
    select: { id: true },
  });

  if (!alternate) {
    next(new NotFoundError('Alternate not found or access denied'));
    return;
  }

  next();
}

export async function requireSourceOwnership(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const sourceId = req.params.sourceId;
  const userId = req.authUser?.id;

  if (!sourceId || !userId) {
    next(new AuthorizationError('Source ID and authenticated user required'));
    return;
  }

  const source = await prisma.trainingSource.findFirst({
    where: {
      id: sourceId,
      userId,
    },
    select: { id: true },
  });

  if (!source) {
    next(new NotFoundError('Source not found or access denied'));
    return;
  }

  next();
}

export async function requireOnboardingOwnership(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const alternateId = req.params.alternateId || req.body.alternateId;
  const userId = req.authUser?.id;

  if (!alternateId || !userId) {
    next(new AuthorizationError('Alternate ID and authenticated user required'));
    return;
  }

  const onboarding = await prisma.onboarding.findFirst({
    where: {
      alternateId,
      userId,
    },
    select: { id: true },
  });

  if (!onboarding) {
    next(new NotFoundError('Onboarding not found or access denied'));
    return;
  }

  next();
}
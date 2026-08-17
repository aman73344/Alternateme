import { Request, Response } from 'express';
import { onboardingService } from './onboarding.service';

export const onboardingController = {
  async startOnboarding(req: Request, res: Response) {
    const userId = (req as any).authUser.id;
    const result = await onboardingService.startOnboarding(userId, req.body);
    res.status(201).json({ success: true, data: result });
  },

  async getOnboardingStatus(req: Request, res: Response) {
    const userId = (req as any).authUser.id;
    const status = await onboardingService.getOnboardingStatus(userId);
    res.json({ success: true, data: status });
  },

  async savePersonalInfo(req: Request, res: Response) {
    const userId = (req as any).authUser.id;
    await onboardingService.savePersonalInfo(userId, req.body);
    res.json({ success: true, data: null });
  },

  async savePersona(req: Request, res: Response) {
    const userId = (req as any).authUser.id;
    await onboardingService.savePersona(userId, req.body);
    res.json({ success: true, data: null });
  },

  async saveVoice(req: Request, res: Response) {
    const userId = (req as any).authUser.id;
    await onboardingService.saveVoice(userId, req.body);
    res.json({ success: true, data: null });
  },

  async saveAIProvider(req: Request, res: Response) {
    const userId = (req as any).authUser.id;
    const result = await onboardingService.saveAIProvider(userId, req.body);
    res.json({ success: true, data: result });
  },

  async completeStep(req: Request, res: Response) {
    const userId = (req as any).authUser.id;
    const { alternateId } = req.params;
    const { step } = req.body;
    const result = await onboardingService.completeStep(userId, alternateId, step);
    res.json({ success: true, data: result });
  },

  async getPreview(req: Request, res: Response) {
    const userId = (req as any).authUser.id;
    const { alternateId } = req.params;
    const preview = await onboardingService.getPreview(userId, alternateId);
    res.json({ success: true, data: preview });
  },

  async publishAlternate(req: Request, res: Response) {
    const userId = (req as any).authUser.id;
    const { alternateId } = req.body;
    const result = await onboardingService.publishAlternate(userId, alternateId);
    res.json({ success: true, data: result });
  },
};
import { Request, Response } from 'express';
import { voiceService } from './voice.service';

export const voiceController = {
  async getProviders(_req: Request, res: Response) {
    const providers = await voiceService.getProviders();
    res.json({ success: true, data: providers });
  },

  async saveVoice(req: Request, res: Response) {
    const userId = (req as any).authUser.id;
    await voiceService.saveVoice(userId, req.body);
    res.json({ success: true, data: null });
  },
};
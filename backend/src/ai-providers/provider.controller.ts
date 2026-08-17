import { Request, Response } from 'express';
import { providerService } from './provider.service';

export const providerController = {
  async saveProvider(req: Request, res: Response) {
    const userId = (req as any).authUser.id;
    const result = await providerService.saveProvider(userId, req.body);
    res.json({ success: true, data: result });
  },

  async removeProvider(req: Request, res: Response) {
    const userId = (req as any).authUser.id;
    const { alternateId } = req.params;
    await providerService.removeProvider(userId, alternateId);
    res.status(204).send();
  },
};
import { Request, Response } from 'express';
import { sourceService } from './source.service';

export const sourceController = {
  async createSource(req: Request, res: Response) {
    const userId = (req as any).authUser.id;
    const source = await sourceService.createSource(userId, req.body);
    // Per spec: return sourceId and status (not the full internal record)
    res.status(201).json({
      success: true,
      data: {
        sourceId: source.id,
        status: source.status,
      },
    });
  },

  async getSources(req: Request, res: Response) {
    const userId = (req as any).authUser.id;
    const { alternateId } = req.params;
    const sources = await sourceService.getSources(alternateId, userId);
    res.json({ success: true, data: sources });
  },

  async deleteSource(req: Request, res: Response) {
    const userId = (req as any).authUser.id;
    const { sourceId } = req.params;
    await sourceService.deleteSource(sourceId, userId);
    res.status(204).send();
  },
};
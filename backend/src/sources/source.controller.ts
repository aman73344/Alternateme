import { Request, Response } from 'express';
import { sourceService } from './source.service';

export const sourceController = {
  async createSource(req: Request, res: Response) {
    const userId = (req as any).authUser.id;
    const source = await sourceService.createSource(userId, req.body);
    // Per spec: return sourceId and status (not the full internal record).
    res.status(201).json({
      success: true,
      data: { sourceId: source.id, status: source.status, jobId: source.jobId },
    });
  },

  async getSources(req: Request, res: Response) {
    const userId = (req as any).authUser.id;
    const { alternateId } = req.params;
    const sources = await sourceService.getSources(alternateId, userId);
    res.json({ success: true, data: sources });
  },

  async getSourceStatus(req: Request, res: Response) {
    const userId = (req as any).authUser.id;
    const { alternateId, sourceId } = req.params;
    const status = await sourceService.getSourceStatus(alternateId, sourceId, userId);
    res.json({ success: true, data: status });
  },

  async reprocessSource(req: Request, res: Response) {
    const userId = (req as any).authUser.id;
    const { alternateId, sourceId } = req.params;
    const force = !!(req.body as any)?.force;
    const result = await sourceService.reprocessSource(alternateId, sourceId, userId, { force });
    res.json({ success: true, data: result });
  },

  async deleteSource(req: Request, res: Response) {
    const userId = (req as any).authUser.id;
    const { alternateId, sourceId } = req.params;
    await sourceService.deleteSource(alternateId, sourceId, userId);
    res.status(204).send();
  },

  async getKnowledgeStatus(req: Request, res: Response) {
    const userId = (req as any).authUser.id;
    const { alternateId } = req.params;
    const status = await sourceService.getKnowledgeStatus(alternateId, userId);
    res.json({ success: true, data: status });
  },
};
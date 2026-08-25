import { Response, Request } from 'express';
import { alternateService } from './alternate.service';

export const alternateController = {
  createAlternate: async (req: Request, res: Response) => {
    const userId = (req as any).authUser!.id;
    const alternate = await alternateService.createAlternate(userId, req.body);

    res.status(201).json({
      success: true,
      data: alternate,
    });
  },

  getAlternate: async (req: Request, res: Response) => {
    const { id } = req.params;
    const requesterId = (req as any).authUser!.id;

    const alternate = await alternateService.getAlternateById(id, requesterId);

    if (!alternate) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Alternate not found' },
      });
      return;
    }

    res.json({
      success: true,
      data: alternate,
    });
  },

  getAlternateByUsername: async (req: Request, res: Response) => {
    const { username } = req.params;

    const alternate = await alternateService.getAlternateByUsername(username);

    if (!alternate) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Alternate not found' },
      });
      return;
    }

    res.json({
      success: true,
      data: alternate,
    });
  },

  getUserAlternates: async (req: Request, res: Response) => {
    const userId = (req as any).authUser!.id;
    const alternates = await alternateService.getAlternatesByUserId(userId);

    res.json({
      success: true,
      data: alternates,
    });
  },

  updateAlternate: async (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = (req as any).authUser!.id;

    const alternate = await alternateService.updateAlternate(id, userId, req.body);

    res.json({
      success: true,
      data: alternate,
    });
  },

  deleteAlternate: async (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = (req as any).authUser!.id;

    await alternateService.deleteAlternate(id, userId);

    res.status(204).send();
  },

  checkUsernameAvailability: async (req: Request, res: Response) => {
    // Route is GET /alternates/username/:username/availability — read path param.
    // Also accept ?username= for backwards compatibility.
    const username = (req.params.username as string | undefined) || (req.query.username as string | undefined);
    const excludeId = req.query.excludeId as string | undefined;

    if (!username || typeof username !== 'string') {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Username is required' },
      });
      return;
    }

    const result = await alternateService.checkUsernameAvailability(username, excludeId);

    res.json({
      success: true,
      data: result,
    });
  },
};
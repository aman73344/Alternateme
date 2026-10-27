import type { Request, Response } from 'express';
import { apiResponse } from '@/utils/response';
import { BusinessError } from '@/utils/errors';
import { integrationService } from './integration.service';

export const integrationController = {
  async listProviders(_req: Request, res: Response): Promise<void> {
    apiResponse.success(res, await integrationService.listProviders());
  },

  async listConnections(req: Request, res: Response): Promise<void> {
    apiResponse.success(
      res,
      await integrationService.listConnections(req.authUser!.id, req.params.alternateId),
    );
  },

  async startGoogleOAuth(req: Request, res: Response): Promise<void> {
    apiResponse.created(
      res,
      await integrationService.startGoogleOAuth(req.authUser!.id, req.params.alternateId),
    );
  },

  async finishGoogleOAuth(req: Request, res: Response): Promise<void> {
    const { state, code, error } = req.query as {
      state?: string;
      code?: string;
      error?: string;
    };
    if (error) {
      throw new BusinessError('Google authorization was not completed', 'OAUTH_ACCESS_DENIED');
    }
    if (!state || !code) {
      throw new BusinessError('OAuth state and code are required', 'OAUTH_CALLBACK_INVALID');
    }
    const result = await integrationService.finishGoogleOAuth(state, code);
    apiResponse.success(res, { ...result, provider: 'google' });
  },

  async disconnect(req: Request, res: Response): Promise<void> {
    apiResponse.success(
      res,
      await integrationService.disconnect(
        req.authUser!.id,
        req.params.alternateId,
        req.params.provider,
      ),
    );
  },

  async listExecutions(req: Request, res: Response): Promise<void> {
    const { page, limit } = req.query as unknown as { page: number; limit: number };
    const result = await integrationService.listExecutions(
      req.authUser!.id,
      req.params.alternateId,
      page,
      limit,
    );
    apiResponse.paginated(res, result.executions, result.totalCount, result.page, result.limit);
  },
};

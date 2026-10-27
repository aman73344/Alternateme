import { z } from 'zod';

export const IntegrationAlternateParamsSchema = z.object({
  alternateId: z.string().uuid(),
});

export const IntegrationProviderParamsSchema = IntegrationAlternateParamsSchema.extend({
  provider: z.literal('google'),
});

export const IntegrationExecutionsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const GoogleOAuthCallbackQuerySchema = z.object({
  state: z.string().min(32).max(128).optional(),
  code: z.string().min(1).max(4096).optional(),
  error: z.string().max(100).optional(),
});

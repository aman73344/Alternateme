import { z } from 'zod';

export const createAlternateSchema = z.object({
  displayName: z.string().min(1, 'Display name is required').max(100, 'Display name must be less than 100 characters'),
  username: z.string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must be less than 30 characters')
    .regex(/^[a-z0-9_-]+$/, 'Username can only contain lowercase letters, numbers, hyphens, and underscores'),
  title: z.string().max(200, 'Title must be less than 200 characters').optional(),
  bio: z.string().max(1000, 'Bio must be less than 1000 characters').optional(),
  avatarUrl: z.string().url('Invalid avatar URL').optional(),
  visibility: z.enum(['PUBLIC', 'UNLISTED', 'PRIVATE']).optional(),
});

export const updateAlternateSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  username: z.string()
    .min(3)
    .max(30)
    .regex(/^[a-z0-9_-]+$/, 'Username can only contain lowercase letters, numbers, hyphens, and underscores')
    .optional(),
  title: z.string().max(200).optional(),
  bio: z.string().max(1000).optional(),
  avatarUrl: z.string().url().optional().nullable(),
  visibility: z.enum(['PUBLIC', 'UNLISTED', 'PRIVATE']).optional(),
  personaPrompt: z.string().max(2000).optional().nullable(),
  modelId: z.string().max(100).optional().nullable(),
});

export const alternateParamsSchema = z.object({
  id: z.string().uuid('Invalid alternate ID'),
});

export const usernameAvailabilitySchema = z.object({
  username: z.string()
    .min(3)
    .max(30)
    .regex(/^[a-z0-9_-]+$/, 'Username can only contain lowercase letters, numbers, hyphens, and underscores'),
});

export type CreateAlternateInput = z.infer<typeof createAlternateSchema>;
export type UpdateAlternateInput = z.infer<typeof updateAlternateSchema>;
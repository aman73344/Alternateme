import { z } from 'zod';

export const updateProfileSchema = z.object({
  name: z.string().min(1, 'Name must not be empty').max(100).optional(),
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must be at most 30 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores')
    .optional(),
  bio: z.string().max(500).optional(),
  avatarUrl: z.string().url('Invalid avatar URL').optional(),
  timezone: z.string().min(1).max(50).optional(),
  language: z.string().min(2).max(10).optional(),
  theme: z.enum(['light', 'dark']).optional(),
});

export const updatePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z
    .string()
    .min(10, 'Password must be at least 10 characters long')
    .max(128, 'Password must be at most 128 characters long')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
});

export const changeEmailSchema = z.object({
  newEmail: z.string().email('Invalid email address'),
  currentPassword: z.string().min(1, 'Current password is required'),
});

export const updatePreferencesSchema = z.object({
  timezone: z.string().min(1).max(50).optional(),
  language: z.string().min(2).max(10).optional(),
  theme: z.enum(['light', 'dark']).optional(),
  notificationPreferences: z.record(z.string(), z.unknown()).optional(),
});

export const avatarUpdateSchema = z.object({
  avatarUrl: z.string().url('Invalid avatar URL'),
});

export const deleteAccountSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
});

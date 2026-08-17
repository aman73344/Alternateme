import { z } from 'zod';

export const startOnboardingSchema = z.object({
  displayName: z.string().min(1, 'Display name is required').max(100, 'Display name must be less than 100 characters'),
  username: z.string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must be less than 30 characters')
    .regex(/^[a-z0-9_-]+$/, 'Username can only contain lowercase letters, numbers, hyphens, and underscores'),
  title: z.string().max(200, 'Title must be less than 200 characters').optional(),
  bio: z.string().max(1000, 'Bio must be less than 1000 characters').optional(),
  avatarUrl: z.string().url('Invalid avatar URL').optional(),
});

export const personalInfoSchema = z.object({
  alternateId: z.string().uuid('Invalid alternate ID'),
  displayName: z.string().min(1, 'Display name is required').max(100),
  title: z.string().max(200).optional(),
  bio: z.string().max(1000).optional(),
  username: z.string()
    .min(3)
    .max(30)
    .regex(/^[a-z0-9_-]+$/, 'Username can only contain lowercase letters, numbers, hyphens, and underscores'),
});

export const personaSchema = z.object({
  alternateId: z.string().uuid('Invalid alternate ID'),
  tone: z.string().max(200).optional(),
  writingStyle: z.string().max(200).optional(),
  personality: z.string().max(500).optional(),
  instructions: z.string().max(5000).optional(),
  boundaries: z.string().max(2000).optional(),
  refusalBehavior: z.string().max(500).optional(),
});

export const voiceSchema = z.object({
  alternateId: z.string().uuid('Invalid alternate ID'),
  provider: z.enum(['ELEVENLABS', 'CARTESIA', 'CUSTOM']),
  voiceId: z.string().min(1, 'Voice ID is required'),
  name: z.string().min(1, 'Voice name is required').max(100),
  type: z.enum(['PROVIDER_VOICE', 'CLONED_VOICE']),
  consent: z.boolean().optional(),
})
  .superRefine((data, ctx) => {
    // Voice cloning must never happen without explicit consent
    if (data.type === 'CLONED_VOICE' && !data.consent) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['consent'],
        message: 'Voice cloning requires explicit consent',
      });
    }
  });

export const aiProviderSchema = z.object({
  alternateId: z.string().uuid('Invalid alternate ID'),
  provider: z.enum(['OPENAI', 'ANTHROPIC']),
  apiKey: z.string().min(1, 'API key is required').max(500, 'API key is too long'),
  keyLabel: z.string().max(100).optional(),
  defaultModel: z.string().max(100).optional(),
});

export const publishSchema = z.object({
  alternateId: z.string().uuid('Invalid alternate ID'),
});

export const stepCompletionSchema = z.object({
  step: z.enum(['PERSONAL', 'SOURCES', 'PERSONA', 'VOICE', 'AI_PROVIDER', 'PUBLISH']),
});

export type StartOnboardingInput = z.infer<typeof startOnboardingSchema>;
export type PersonalInfoInput = z.infer<typeof personalInfoSchema>;
export type PersonaInput = z.infer<typeof personaSchema>;
export type VoiceInput = z.infer<typeof voiceSchema>;
export type AIProviderInput = z.infer<typeof aiProviderSchema>;
export type StepCompletionInput = z.infer<typeof stepCompletionSchema>;
import { z } from 'zod';
import { validateSourceUrl } from './source-security';

export const createSourceSchema = z.object({
  alternateId: z.string().uuid('Invalid alternate ID'),
  type: z.enum(['FILE', 'URL', 'LINKEDIN', 'YOUTUBE', 'OTHER']),
  name: z.string().min(1, 'Name is required').max(200),
  url: z.string().optional(),
  fileName: z.string().max(200).optional(),
  mimeType: z.string().max(100).optional(),
  fileSize: z.number().positive().optional(),
  origin: z.string().max(200).optional(),
  // Phase 3 — optional file payload (base64) or pre-uploaded storage reference
  fileContent: z.string().optional(),
  storageKey: z.string().max(500).optional(),
  storageUrl: z.string().max(500).optional(),
  checksum: z.string().max(128).optional(),
}).superRefine((data, ctx) => {
  // URL type requires a valid URL that passes SSRF safety checks
  if (data.type === 'URL') {
    if (!data.url) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['url'],
        message: 'URL is required for URL sources',
      });
    } else {
      const result = validateSourceUrl(data.url);
      if (!result.valid) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['url'],
          message: result.error || 'URL is not allowed for ingestion',
        });
      }
    }
  }

  // FILE type requires fileName and mimeType (or a pre-uploaded storage key)
  if (data.type === 'FILE' && !data.fileName && !data.storageKey) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['fileName'],
      message: 'File name is required for file sources',
    });
  }
});

export const reprocessSourceSchema = z.object({
  force: z.boolean().optional(),
});

export const sourceParamsSchema = z.object({
  sourceId: z.string().uuid('Invalid source ID'),
});

export type CreateSourceInput = z.infer<typeof createSourceSchema>;
/**
 * Memory Schema — Zod validation schemas
 */

import { z } from 'zod';

export const MemoryTypeSchema = z.enum([
  'FACT', 'PREFERENCE', 'PERSONAL_CONTEXT', 'GOAL', 'DECISION',
  'INSTRUCTION', 'RELATIONSHIP', 'PROJECT_CONTEXT', 'CONVERSATION_SUMMARY',
]);

export const MemoryStatusSchema = z.enum(['ACTIVE', 'ARCHIVED', 'DELETED', 'EXPIRED', 'SUPERSEDED']);
export const MemoryVisibilitySchema = z.enum(['PRIVATE', 'ALTERNATE']);
export const MemorySourceTypeSchema = z.enum(['EXPLICIT', 'INFERRED', 'ASSOCIATED']);

export const CreateMemorySchema = z.object({
  type: MemoryTypeSchema,
  content: z.string().min(1).max(1000),
  importance: z.number().min(0).max(1).default(0.5),
  confidence: z.number().min(0).max(1).default(0.7),
  sourceType: MemorySourceTypeSchema.default('EXPLICIT'),
  visibility: MemoryVisibilitySchema.optional(),
});

export const UpdateMemorySchema = z.object({
  content: z.string().min(1).max(1000).optional(),
  importance: z.number().min(0).max(1).optional(),
  confidence: z.number().min(0).max(1).optional(),
  status: MemoryStatusSchema.optional(),
  visibility: MemoryVisibilitySchema.optional(),
  expiresAt: z.date().nullable().optional(),
});

export const MemorySearchParamsSchema = z.object({
  types: MemoryTypeSchema.array().optional(),
  statuses: MemoryStatusSchema.array().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.enum(['createdAt', 'updatedAt', 'importance', 'lastAccessedAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const MEMORY_EXTRACTION_JOB_DATA_SCHEMA = z.object({
  conversationId: z.string(),
  messageId: z.string(),
  alternateId: z.string(),
  userId: z.string(),
  messageContent: z.string(),
  jobId: z.string().optional(),
});

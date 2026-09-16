/**
 * Memory Controller
 */

import { Request, Response, NextFunction } from 'express';
import { memoryService } from './memory.service';
import { NotFoundError, ValidationError } from '@/utils/errors';

function formatMemoryForResponse(memory: any) {
  return {
    id: memory.id,
    type: memory.type,
    content: memory.content,
    importance: memory.importance,
    confidence: memory.confidence,
    sourceType: memory.sourceType,
    status: memory.status,
    visibility: memory.visibility,
    isExtracted: memory.isExtracted,
    sourceConversationId: memory.sourceConversationId,
    sourceMessageId: memory.sourceMessageId,
    expiresAt: memory.expiresAt,
    lastAccessedAt: memory.lastAccessedAt,
    lastReinforcedAt: memory.lastReinforcedAt,
    reinforcementCount: memory.reinforcementCount,
    createdAt: memory.createdAt,
    updatedAt: memory.updatedAt,
  };
}

/** GET /alternates/:alternateId/memories â€” list memories */
export async function listMemories(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const alternateId = req.params.alternateId;
    const userId = req.authUser!.id;

    const limit = req.query.limit ? Number(req.query.limit) : 20;

    const result = await memoryService.listMemories(alternateId, userId, {
      types: req.query.types as any,
      statuses: req.query.statuses as any,
      search: req.query.search as string,
      page: req.query.page ? Number(req.query.page) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
      sort: req.query.sort as any,
      sortOrder: req.query.sortOrder as any,
    });

    res.json({
      success: true,
      data: {
        memories: result.memories.map(formatMemoryForResponse),
        pagination: {
          page: result.memories.length,
          total: result.totalCount,
          hasMore: result.memories.length < limit,
        },
      },
    });
    } catch (err) { next(err); }
}

/** GET /alternates/:alternateId/memories/:memoryId â€” get single memory */
export async function getMemory(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { alternateId, memoryId } = req.params;
    const userId = req.authUser!.id;
    const memory = await memoryService.getMemory(memoryId, alternateId, userId);
    if (!memory) throw new NotFoundError('Memory not found');
    res.json({ success: true, data: formatMemoryForResponse(memory) });
  } catch (err) { next(err); }
}

/** PUT /alternates/:alternateId/memories/:memoryId â€” update memory */
export async function updateMemoryEndpoint(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { alternateId, memoryId } = req.params;
    const userId = req.authUser!.id;
    const { content, importance, confidence, status, visibility, expiresAt } = req.body;

    const memory = await memoryService.updateMemory(memoryId, alternateId, userId, {
      content, importance, confidence, status, visibility,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
    });
    res.json({ success: true, data: formatMemoryForResponse(memory) });
  } catch (err) { next(err); }
}

/** DELETE /alternates/:alternateId/memories/:memoryId â€” delete memory */
export async function deleteMemoryEndpoint(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { alternateId, memoryId } = req.params;
    const userId = req.authUser!.id;
    await memoryService.deleteMemory(memoryId, alternateId, userId);
    res.json({ success: true, data: { message: 'Memory deleted' } });
  } catch (err) { next(err); }
}

/** POST /alternates/:alternateId/memories/:memoryId/confirm */
export async function confirmMemory(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { alternateId, memoryId } = req.params;
    const userId = req.authUser!.id;
    const memory = await memoryService.confirmMemory(memoryId, alternateId, userId);
    res.json({ success: true, data: formatMemoryForResponse(memory) });
  } catch (err) { next(err); }
}

/** POST /alternates/:alternateId/memories/:memoryId/archive */
export async function archiveMemory(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { alternateId, memoryId } = req.params;
    const userId = req.authUser!.id;
    const memory = await memoryService.archiveMemory(memoryId, alternateId, userId);
    res.json({ success: true, data: formatMemoryForResponse(memory) });
  } catch (err) { next(err); }
}

/** POST /alternates/:alternateId/memories/forget â€” forget by content */
export async function forgetMemoryByContent(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { alternateId } = req.params;
    const userId = req.authUser!.id;
    const { content, type } = req.body;
    if (!content) throw new ValidationError('Content is required for forget operation');

    const { findExistingByNormalizedContent } = await import('./memory.repository.search');
    const { normalizeContent } = await import('./memory.policy');
    const normalized = normalizeContent(content);
    const memory = await findExistingByNormalizedContent(alternateId, userId, normalized, type);
    if (!memory) throw new NotFoundError('Memory not found matching criteria');

    await memoryService.forgetMemory(memory.id, alternateId, userId);
    res.json({ success: true, data: { message: 'Memory forgotten', memoryId: memory.id } });
  } catch (err) { next(err); }
}


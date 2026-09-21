/**
 * Memory Retrieval Service
 *
 * Retrieves relevant memories for a user query using:
 * - Embedding-based semantic search (reusing Phase 3 EmbeddingService)
 * - Lexical/text search fallback
 * - MemoryRanker for multi-signal ranking
 *
 * All retrieval is tenant-scoped by alternateId + userId.
 */

import { logger } from '@/utils/logger';
import { EmbeddingService } from '@/knowledge/embedding/embedding.service';
import {
  MemorySearchParams,
  MemoryRetrievalResult,
  Memory,
  MemoryType,
} from './memory.types';
import { retrieveByVector } from './memory.repository.vector';
import { searchMemories, updateAccessTimestamps } from './memory.repository.search';
import { rankMemories } from './memory.ranker';
import { formatMemories } from './memory.formatter';
import { MEMORY_DEFAULTS } from './memory.constants';

/** Shared embedding service instance (Phase 3 abstraction). */
const embeddingService = new EmbeddingService();

export class MemoryRetrievalService {
  private static instance: MemoryRetrievalService;

  static getInstance(): MemoryRetrievalService {
    if (!MemoryRetrievalService.instance) {
      MemoryRetrievalService.instance = new MemoryRetrievalService();
    }
    return MemoryRetrievalService.instance;
  }

  /**
   * Retrieve relevant memories for a user query.
   * Combines vector search and lexical search results.
   */
  async retrieve(params: MemorySearchParams): Promise<MemoryRetrievalResult> {
    const { alternateId, userId } = params;
    const queryText = params.queryText || (params as any).query;
    let queryEmbedding = params.queryEmbedding;

    logger.info(
      { alternateId, userId, hasQueryEmbedding: !!queryEmbedding, hasQueryText: !!queryText },
      'memory.retrieval.started',
    );

    const startTime = Date.now();
    let vectors: Array<Memory & { similarity: number }> = [];
    let textResults: Array<Memory & { similarity: number }> = [];

    // Generate embedding if we have text but no embedding
    if (!queryEmbedding && queryText && queryText.length > 0) {
      try {
        queryEmbedding = (await embeddingService.embed([queryText])).vectors[0];
      } catch (err) {
        logger.warn({ err, alternateId }, 'Failed to generate embedding for memory retrieval query');
      }
    }

    // Vector search
    if (queryEmbedding && queryEmbedding.length > 0) {
      vectors = await retrieveByVector(alternateId, userId, queryEmbedding, {
        limit: params.limit ?? MEMORY_DEFAULTS.TOP_K * 2,
        minScore: params.minScore ?? MEMORY_DEFAULTS.MIN_SCORE,
        includePrivate: params.includePrivate,
        types: params.types,
      });
    }

    // Text search fallback / supplement
    if (queryText && queryText.length > 0) {
      textResults = await this.searchByText(alternateId, userId, queryText, {
        limit: params.limit ?? MEMORY_DEFAULTS.TOP_K * 2,
        includePrivate: params.includePrivate,
        types: params.types,
      });
    }

    // Merge results (deduplicate by memory ID)
    const combined = new Map<string, Memory & { similarity: number }>();
    for (const v of vectors) {
      combined.set(v.id, v);
    }
    for (const t of textResults) {
      if (!combined.has(t.id)) {
        combined.set(t.id, t);
      } else {
        // Boost similarity if found in both
        const existing = combined.get(t.id)!;
        existing.similarity = Math.max(existing.similarity ?? 0, t.similarity ?? 0);
      }
    }

    const merged = Array.from(combined.values());

    // Rank with MemoryRanker
    const ranked = rankMemories(merged, {
      topK: params.limit ?? MEMORY_DEFAULTS.TOP_K,
      maxTokens: params.maxTokens ?? MEMORY_DEFAULTS.MAX_TOKENS,
      minScore: params.minScore ?? MEMORY_DEFAULTS.MIN_SCORE,
    });

    // Update access timestamps
    const memoryIds = ranked.map((r) => r.memory.id);
    await updateAccessTimestamps(memoryIds);

    // Format for context
    const context = formatMemories(ranked, params.maxTokens ?? MEMORY_DEFAULTS.MAX_TOKENS);

    logger.info(
      {
        alternateId,
        userId,
        resultCount: ranked.length,
        durationMs: Date.now() - startTime,
      },
      'memory.retrieval.completed',
    );

    return {
      memories: ranked.map((r) => r.memory),
      scores: ranked.map((r) => r.score),
      tokenEstimate: context.tokenEstimate,
      totalCount: ranked.length,
      formattedContext: context.formatted,
    };
  }

  /**
   * Search by text — lexical fallback.
   */
  private async searchByText(
    alternateId: string,
    userId: string,
    query: string,
    params: { limit?: number; includePrivate?: boolean; types?: MemoryType[] },
  ): Promise<Array<Memory & { similarity: number }>> {
    // Use the database text search
        const results = await searchMemories({
      alternateId,
      userId,
      search: query,
      limit: params.limit,
      includePrivate: params.includePrivate,
      types: params.types,
    });

    return results.memories.map((m) => ({
      ...m,
      similarity: 0.5, // Default similarity for text matches
    }));
  }

  /**
   * Check if a memory's embedding is needed and generate if missing.
   */
  async ensureMemoryEmbedded(
    memoryId: string,
    alternateId: string,
    userId: string,
    content: string,
  ): Promise<boolean> {
    try {
      const embedding = (await embeddingService.embed([content])).vectors[0];
      if (!embedding) return false;
      // Import lazily to avoid circular deps
      const { upsertMemoryEmbedding } = await import('./memory-embedding.repository');
      await upsertMemoryEmbedding(memoryId, alternateId, userId, embedding);
      return true;
    } catch (err) {
      logger.error({ memoryId, err }, 'memory.embedding.failed');
      return false;
    }
  }
}

export const memoryRetrievalService = MemoryRetrievalService.getInstance();

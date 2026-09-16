/**
 * Memory Extraction — Processing Logic
 *
 * Contains the extraction, validation, deduplication, conflict, and persistence logic
 * used by MemoryExtractionService. Embedding generation reuses the Phase 3
 * EmbeddingService abstraction (same provider/config as RAG).
 */

import { logger } from '@/utils/logger';
import { EmbeddingService } from '@/knowledge/embedding/embedding.service';
import { ExtractedMemory, CreateMemoryInput, MemoryVisibility } from './memory.types';
import { MEMORY_DEFAULTS } from './memory.constants';
import { normalizeContent, evaluateWritePolicy } from './memory.policy';
import { createMemory, findExistingBySourceMessage } from './memory.repository';
import {
  findExistingByNormalizedContent,
  supersedeMemory,
  reinforceMemory,
} from './memory.repository.search';
import { findSemanticDuplicates } from './memory.repository.vector';
import { memoryEmbeddingQueue } from '@/queues';

/** Shared embedding service instance for memory operations (Phase 3 abstraction). */
const embeddingService = new EmbeddingService();

/** Embed a single text; returns null on failure so callers can degrade gracefully. */
export async function embedText(text: string): Promise<number[] | null> {
  try {
    const { vectors } = await embeddingService.embed([text]);
    return vectors[0] ?? null;
  } catch (err) {
    logger.warn({ err }, 'memory.embedding.failed');
    return null;
  }
}

/**
 * Process a single extracted memory: validate, dedup, conflict-resolve, persist.
 */
export async function processExtractedMemory(
  extracted: ExtractedMemory,
  context: {
    alternateId: string;
    userId: string;
    conversationId: string;
    messageId: string;
    messageContent: string;
  },
): Promise<'created' | 'updated' | 'skipped'> {
  const { alternateId, userId, conversationId, messageId } = context;

  // 1. Policy check — reject secrets, low importance, etc.
  const policyResult = evaluateWritePolicy({
    content: extracted.content,
    importance: extracted.importance,
    confidence: extracted.confidence,
    type: extracted.type,
    sourceType: extracted.sourceType,
  });

  if (!policyResult.shouldWrite) {
    logger.info({ alternateId, reason: policyResult.reason }, 'memory.extraction.skipped');
    return 'skipped';
  }

  // 2. Idempotency — check existing by source message + type
  const existingBySource = await findExistingBySourceMessage(
    alternateId, userId, messageId, extracted.type,
  );
  if (existingBySource) {
    await reinforceMemory(existingBySource.id, alternateId, userId);
    return 'updated';
  }

  // 3. Exact dedup — normalized content match (cheap, deterministic first)
  const normalized = normalizeContent(extracted.content);
  const existingByContent = await findExistingByNormalizedContent(
    alternateId, userId, normalized, extracted.type,
  );
  if (existingByContent) {
    await reinforceMemory(existingByContent.id, alternateId, userId);
    return 'updated';
  }

  // 4. Semantic dedup / conflict detection (only if embedding succeeded)
  const embedding = await embedText(extracted.content);
  if (embedding) {
    const duplicates = await findSemanticDuplicates(
      alternateId, userId, embedding,
      MEMORY_DEFAULTS.MAX_SIMILARITY_THRESHOLD, 5,
    );

    for (const dup of duplicates) {
      const dupNormalized = normalizeContent(dup.content);
      if (dupNormalized !== normalized && dup.type === extracted.type) {
        // Contradictory — supersede old memory
        await supersedeMemory(dup.id, alternateId, userId);
        logger.info(
          { oldMemoryId: dup.id, newContent: extracted.content },
          'memory.superseded',
        );
      }
    }
  }

  // 5. Create the memory
  const input: CreateMemoryInput = {
    alternateId,
    userId,
    type: extracted.type,
    content: extracted.content,
    importance: extracted.importance,
    confidence: extracted.confidence,
    sourceType: extracted.sourceType,
    sourceConversationId: conversationId,
    sourceMessageId: messageId,
    visibility: MemoryVisibility.PRIVATE,
  };

  const memory = await createMemory(input);

  // 6. Queue embedding generation (async, non-blocking)
  void memoryEmbeddingQueue()?.add(
    'embed',
    { memoryId: memory.id, alternateId, userId, content: extracted.content },
    {
      jobId: `memory-embed-${memory.id}`,
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
    },
  );

  logger.info({ memoryId: memory.id, type: extracted.type }, 'memory.created');
  return 'created';
}

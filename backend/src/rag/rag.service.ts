/**
 * RagService — Core retrieval orchestration for the RAG pipeline.
 * 
 * Responsibilities:
 * - Receive user query
 * - Validate Alternate ownership/access
 * - Generate query embedding
 * - Search vector database
 * - Apply metadata filters
 * - Rank candidates
 * - Build context
 * - Return retrieval result
 * 
 * This service orchestrates the flow:
 * Query → Embedding → Vector Search → Filtering → Reranking → Context Assembly
 */

import { config } from '@/config';
import { logger } from '@/utils/logger';
import { EmbeddingService } from '@/knowledge/embedding/embedding.service';
import { vectorRepository } from './vector.repository';
import { reranker } from './reranker';
import { contextBuilder } from './context-builder';
import type {
  RetrievalResult,
  RagConfig,
  VectorSearchParams,
} from './types';

export class RagService {
  private embeddingService: EmbeddingService;
  private ragConfig: RagConfig;

  constructor() {
    this.embeddingService = new EmbeddingService();
    this.ragConfig = {
      initialTopK: parseInt(process.env.RAG_INITIAL_TOP_K || '20', 10),
      finalTopK: parseInt(process.env.RAG_FINAL_TOP_K || '5', 10),
      minSimilarity: parseFloat(process.env.RAG_MIN_SIMILARITY || '0.7'),
      maxContextTokens: parseInt(process.env.RAG_MAX_CONTEXT_TOKENS || '3000', 10),
      maxChunks: parseInt(process.env.RAG_MAX_CHUNKS || '5', 10),
      maxCharacters: parseInt(process.env.RAG_MAX_CHARACTERS || '4000', 10),
      embeddingDimensions: config.knowledge.embedding.dimensions,
    };
  }

  /**
   * Execute the full RAG retrieval pipeline.
   * 
   * @param query - The user's question
   * @param alternateId - The Alternate ID (validated for ownership)
   * @param userId - The authenticated user ID
   * @param options - Optional search filters
   * @returns RetrievalResult with chunks, citations, and metadata
   */
  async retrieve(
    query: string,
    alternateId: string,
    userId: string,
    options?: {
      sourceId?: string;
      documentId?: string;
      sourceType?: string;
      language?: string;
      knowledgeVersion?: number;
    }
  ): Promise<RetrievalResult> {
    const startTime = Date.now();

    // Normalize the query
    const normalizedQuery = this.normalizeQuery(query);

    // Generate query embedding
    const queryEmbedding = await this.generateQueryEmbedding(normalizedQuery);

    // Get the active knowledge version if not specified
    const knowledgeVersion = options?.knowledgeVersion ?? 
      await vectorRepository.getActiveKnowledgeVersion(alternateId) ?? 
      undefined;

    // Build search parameters with multi-tenant filtering
    const searchParams: VectorSearchParams = {
      alternateId,
      userId,
      queryEmbedding,
      topK: this.ragConfig.initialTopK,
      minSimilarity: this.ragConfig.minSimilarity,
      knowledgeVersion,
      sourceId: options?.sourceId,
      documentId: options?.documentId,
      sourceType: options?.sourceType,
      language: options?.language,
    };

    // Perform vector search
    const candidates = await vectorRepository.searchSimilar(searchParams);

    // Rerank candidates
    const reranked = reranker.rerank(normalizedQuery, candidates);

    // Select final top-K chunks
    const finalChunks = reranked.slice(0, this.ragConfig.finalTopK);

    // Build context
    const builtContext = contextBuilder.buildContext(finalChunks);

    const latencyMs = Date.now() - startTime;

    // Determine if we have relevant context
    const hasRelevantContext = finalChunks.length > 0 && 
      finalChunks.some((c) => c.similarity >= this.ragConfig.minSimilarity);

    const result: RetrievalResult = {
      chunks: finalChunks,
      citations: builtContext.citations,
      hasRelevantContext,
      candidateCount: candidates.length,
      finalCount: finalChunks.length,
      query,
      normalizedQuery,
      latencyMs,
    };

    logger.info({
      alternateId,
      userId,
      query: normalizedQuery,
      candidateCount: candidates.length,
      finalCount: finalChunks.length,
      hasRelevantContext,
      latencyMs,
    }, 'RAG retrieval completed');

    return result;
  }

  /**
   * Generate embedding for the query using the configured embedding service.
   */
  private async generateQueryEmbedding(query: string): Promise<number[]> {
    const result = await this.embeddingService.embed([query]);
    
    if (result.vectors.length === 0) {
      throw new Error('Failed to generate query embedding');
    }

    const embedding = result.vectors[0];

    // Validate embedding dimensions match stored vectors
    if (embedding.length !== this.ragConfig.embeddingDimensions) {
      throw new Error(
        `Query embedding dimension mismatch: got ${embedding.length}, expected ${this.ragConfig.embeddingDimensions}`
      );
    }

    return embedding;
  }

  /**
   * Normalize the query for better retrieval.
   */
  private normalizeQuery(query: string): string {
    return query
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/[?!.]+$/g, '')
      .trim();
  }

  /**
   * Get the current RAG configuration.
   */
  getConfig(): RagConfig {
    return { ...this.ragConfig };
  }
}

export const ragService = new RagService();

/**
 * Reranker — Abstract ranking interface for retrieved candidates.
 * 
 * The reranking abstraction allows different ranking strategies:
 * - Local scoring (similarity-based, recency-based)
 * - External rerankers (Cohere, Voyage, Jina)
 * - LLM-based reranking
 * 
 * Initial implementation uses a lightweight local scoring strategy.
 * External rerankers can be added later without changing the interface.
 */

import type { RetrievedChunk } from './types';

export interface Reranker {
  readonly name: string;
  rerank(query: string, candidates: RetrievedChunk[]): RetrievedChunk[];
}

/**
 * LocalReranker — Lightweight reranking using similarity scores and metadata.
 * 
 * Scoring strategy:
 * - Base score from vector similarity (0-1)
 * - Boost for heading matches
 * - Boost for more recent knowledge versions
 * - Penalty for very short chunks (likely low information)
 */
export class LocalReranker implements Reranker {
  readonly name = 'local';

  rerank(query: string, candidates: RetrievedChunk[]): RetrievedChunk[] {
    if (candidates.length === 0) {
      return [];
    }

    const queryLower = query.toLowerCase();
    const queryTerms = queryLower.split(/\s+/).filter((t) => t.length > 2);

    const scored = candidates.map((chunk) => {
      let score = chunk.similarity;

      // Boost if heading contains query terms
      if (chunk.heading) {
        const headingLower = chunk.heading.toLowerCase();
        const headingMatch = queryTerms.some((term) => headingLower.includes(term));
        if (headingMatch) {
          score += 0.1;
        }
      }

      // Boost if content starts with query-relevant terms
      const contentStart = chunk.content.slice(0, 200).toLowerCase();
      const contentMatch = queryTerms.some((term) => contentStart.includes(term));
      if (contentMatch) {
        score += 0.05;
      }

      // Penalty for very short chunks (likely headers/footers)
      if (chunk.content.length < 50) {
        score -= 0.1;
      }

      // Clamp score to [0, 1]
      score = Math.max(0, Math.min(1, score));

      return {
        ...chunk,
        rerankScore: score,
      };
    });

    // Sort by rerank score descending
    scored.sort((a, b) => (b.rerankScore ?? 0) - (a.rerankScore ?? 0));

    return scored;
  }
}

/**
 * IdentityReranker — Pass-through reranker that preserves original order.
 * Useful for testing or when no reranking is desired.
 */
export class IdentityReranker implements Reranker {
  readonly name = 'identity';

  rerank(_query: string, candidates: RetrievedChunk[]): RetrievedChunk[] {
    return candidates.map((chunk) => ({
      ...chunk,
      rerankScore: chunk.similarity,
    }));
  }
}

// Default reranker instance
export const reranker: Reranker = new LocalReranker();

/**
 * ContextBuilder — Assembles structured context for the LLM from retrieved chunks.
 * 
 * Responsibilities:
 * - Preserve source provenance (source, document, section, page, chunk)
 * - Manage context size (token limits, max chunks, max characters)
 * - Deduplicate near-identical content
 * - Structure context for traceability
 */

import type { RetrievedChunk, SourceCitation } from './types';

export interface ContextBuilderOptions {
  maxChunks: number;
  maxCharacters: number;
  maxTokens: number;
}

export interface BuiltContext {
  contextText: string;
  citations: SourceCitation[];
  chunksIncluded: number;
  charactersIncluded: number;
  tokenEstimate: number;
  truncated: boolean;
}

export class ContextBuilder {
  private options: ContextBuilderOptions;

  constructor(options: Partial<ContextBuilderOptions> = {}) {
    this.options = {
      maxChunks: options.maxChunks ?? 5,
      maxCharacters: options.maxCharacters ?? 4000,
      maxTokens: options.maxTokens ?? 3000,
    };
  }

  /**
   * Build structured context from retrieved chunks.
   */
  buildContext(chunks: RetrievedChunk[]): BuiltContext {
    if (chunks.length === 0) {
      return {
        contextText: '',
        citations: [],
        chunksIncluded: 0,
        charactersIncluded: 0,
        tokenEstimate: 0,
        truncated: false,
      };
    }

    const deduplicated = this.deduplicateChunks(chunks);

    const sorted = [...deduplicated].sort((a, b) => {
      const scoreA = a.rerankScore ?? a.similarity;
      const scoreB = b.rerankScore ?? b.similarity;
      return scoreB - scoreA;
    });

    const selected: RetrievedChunk[] = [];
    let totalChars = 0;
    let truncated = false;

    for (const chunk of sorted) {
      if (selected.length >= this.options.maxChunks) {
        truncated = true;
        break;
      }

      const chunkText = this.formatChunk(chunk);
      const chunkChars = chunkText.length;

      if (totalChars + chunkChars > this.options.maxCharacters && selected.length > 0) {
        truncated = true;
        break;
      }

      selected.push(chunk);
      totalChars += chunkChars;
    }

    const contextParts: string[] = [];
    const citations: SourceCitation[] = [];

    for (const chunk of selected) {
      contextParts.push(this.formatChunk(chunk));

      const citation: SourceCitation = {
        sourceId: chunk.sourceId,
        documentId: chunk.documentId,
        title: this.extractTitle(chunk),
        chunkId: chunk.id,
        relevance: chunk.rerankScore ?? chunk.similarity,
      };

      if (chunk.metadata && typeof chunk.metadata === 'object') {
        const meta = chunk.metadata as Record<string, unknown>;
        if (typeof meta.url === 'string') {
          citation.url = meta.url;
        }
        if (typeof meta.page === 'number') {
          citation.page = meta.page;
        }
      }

      citations.push(citation);
    }

    const contextText = contextParts.join('\n\n');
    const tokenEstimate = this.estimateTokens(contextText);

    return {
      contextText,
      citations,
      chunksIncluded: selected.length,
      charactersIncluded: contextText.length,
      tokenEstimate,
      truncated,
    };
  }

  private formatChunk(chunk: RetrievedChunk): string {
    const parts: string[] = [];

    if (chunk.heading) {
      parts.push(`[Section: ${chunk.heading}]`);
    }

    parts.push(chunk.content);
    parts.push(`(Source: Document ${chunk.documentId.slice(0, 8)}..., Chunk ${chunk.chunkIndex})`);

    return parts.join('\n');
  }

  private extractTitle(chunk: RetrievedChunk): string {
    if (chunk.metadata && typeof chunk.metadata === 'object') {
      const meta = chunk.metadata as Record<string, unknown>;
      if (typeof meta.title === 'string') {
        return meta.title;
      }
      if (typeof meta.documentTitle === 'string') {
        return meta.documentTitle;
      }
    }
    return `Document ${chunk.documentId.slice(0, 8)}`;
  }

  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /**
   * Deduplicate near-identical chunks using Jaccard similarity.
   */
  private deduplicateChunks(chunks: RetrievedChunk[]): RetrievedChunk[] {
    const unique: RetrievedChunk[] = [];
    const seenContent: string[] = [];

    for (const chunk of chunks) {
      const normalizedContent = this.normalizeContent(chunk.content);

      const isDuplicate = seenContent.some((seen) => {
        const similarity = this.calculateOverlap(normalizedContent, seen);
        return similarity > 0.8;
      });

      if (!isDuplicate) {
        unique.push(chunk);
        seenContent.push(normalizedContent);
      }
    }

    return unique;
  }

  private normalizeContent(content: string): string {
    return content
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s]/g, '')
      .trim();
  }

  private calculateOverlap(text1: string, text2: string): number {
    const words1 = new Set(text1.split(' '));
    const words2 = new Set(text2.split(' '));

    const intersection = new Set([...words1].filter((w) => words2.has(w)));
    const union = new Set([...words1, ...words2]);

    if (union.size === 0) return 0;
    return intersection.size / union.size;
  }
}

export const contextBuilder = new ContextBuilder();

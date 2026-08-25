import { logger } from '@/utils/logger';
import { KnowledgeError } from '../knowledge.errors';
import type { EmbeddingProvider, EmbeddingProviderOptions, EmbeddingResult } from './embedding.provider';

interface OpenAiEmbeddingResponse {
  data: Array<{ embedding: number[]; index: number }>;
  usage?: { prompt_tokens: number; total_tokens: number };
}

/**
 * OpenAIEmbeddingProvider — calls POST /v1/embeddings with the configured
 * model. The API key is supplied by the caller (decrypted per-alternate from
 * AIProviderConfig, or the platform-level key) and is never logged or stored.
 */
export class OpenAiEmbeddingProvider implements EmbeddingProvider {
  readonly id = 'openai';
  readonly dimensions: number;

  constructor(private readonly opts: EmbeddingProviderOptions) {
    this.dimensions = opts.dimensions;
  }

  async embedTexts(texts: string[]): Promise<EmbeddingResult> {
    if (!this.opts.apiKey) {
      throw new KnowledgeError(
        'EMBEDDING_PROVIDER_ERROR',
        undefined,
        'OpenAI embedding API key is not configured',
      );
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.opts.timeoutMs);
    try {
      const res = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.opts.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ model: this.opts.model, input: texts }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        logger.warn({ status: res.status, model: this.opts.model }, 'OpenAI embeddings request failed');
        throw new KnowledgeError('EMBEDDING_PROVIDER_ERROR', { status: res.status }, body.slice(0, 500) || 'OpenAI embeddings request failed');
      }
      const json = (await res.json()) as OpenAiEmbeddingResponse;
      const vectors = json.data
        .sort((a, b) => a.index - b.index)
        .map((d) => d.embedding);
      return { vectors, tokenCounts: json.usage ? [json.usage.prompt_tokens] : undefined };
    } catch (err) {
      if (err instanceof KnowledgeError) throw err;
      if (err instanceof Error && err.name === 'AbortError') {
        throw new KnowledgeError('EMBEDDING_PROVIDER_ERROR', undefined, 'OpenAI embeddings request timed out');
      }
      logger.warn({ err }, 'OpenAI embeddings network failure');
      throw new KnowledgeError('EMBEDDING_PROVIDER_ERROR');
    } finally {
      clearTimeout(timer);
    }
  }

  async ping(): Promise<boolean> {
    if (!this.opts.apiKey) return false;
    try {
      await this.embedTexts(['ping']);
      return true;
    } catch {
      return false;
    }
  }
}

export function registerOpenaiEmbeddingProvider(): void {
  // Registration happens once in embedding/bootstrap.ts to avoid duplicate side effects.
}
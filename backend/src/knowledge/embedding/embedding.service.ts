import { config } from '@/config';
import { logger } from '@/utils/logger';
import { retry } from '@/utils/helpers';
import { registerEmbeddingProviders } from './bootstrap';
import {
  createEmbeddingProvider,
  hasEmbeddingProvider,
  type EmbeddingProvider,
  type EmbeddingProviderOptions,
  type EmbeddingResult,
} from './embedding.provider';
import { KnowledgeError } from '../knowledge.errors';

export interface EmbeddingServiceOptions {
  provider?: string;
  model?: string;
  dimensions?: number;
  batchSize?: number;
  timeoutMs?: number;
  apiKey?: string;
  maxRetries?: number;
}

/**
 * EmbeddingService — batch, retry-aware wrapper around a configured provider.
 * The pipeline hands it cleaned chunks; it never reaches into controllers and
 * never logs API keys. Batches respect the configured batch size, apply
 * exponential backoff on transient failures, and re-queue only the failed
 * batch on partial failure.
 */
export class EmbeddingService {
  private readonly options: Required<EmbeddingServiceOptions>;

  constructor(options: EmbeddingServiceOptions = {}) {
    this.options = {
      provider: options.provider ?? config.knowledge.embedding.provider,
      model: options.model ?? config.knowledge.embedding.model,
      dimensions: options.dimensions ?? config.knowledge.embedding.dimensions,
      batchSize: options.batchSize ?? config.knowledge.embedding.batchSize,
      timeoutMs: options.timeoutMs ?? config.knowledge.embedding.timeoutMs,
      apiKey: options.apiKey,
      maxRetries: options.maxRetries ?? 3,
    };
  }

  get providerName(): string {
    return this.options.provider;
  }

  get dimensions(): number {
    return this.options.dimensions;
  }

  private buildProvider(): EmbeddingProvider {
    registerEmbeddingProviders();
    if (!hasEmbeddingProvider(this.options.provider)) {
      throw new KnowledgeError(
        'EMBEDDING_PROVIDER_ERROR',
        { provider: this.options.provider },
        `Embedding provider "${this.options.provider}" is not available`,
      );
    }
    const providerOpts: EmbeddingProviderOptions = {
      apiKey: this.options.apiKey,
      model: this.options.model,
      dimensions: this.options.dimensions,
      timeoutMs: this.options.timeoutMs,
      batchSize: this.options.batchSize,
    };
    return createEmbeddingProvider(this.options.provider, providerOpts);
  }

  /**
   * Embed a list of texts, batching by batchSize with per-batch retries.
   * Throws EMBEDDING_PROVIDER_ERROR / EMBEDDING_FAILED when exhausted.
   */
  async embed(texts: string[]): Promise<EmbeddingResult> {
    if (texts.length === 0) {
      return { vectors: [], tokenCounts: [] };
    }
    const provider = this.buildProvider();
    const batchSize = Math.max(1, this.options.batchSize);
    const allVectors: number[][] = [];
    let totalTokens = 0;

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const batchIndex = i / batchSize;
      try {
        const result = await retry.execute(() => provider.embedTexts(batch), {
          maxRetries: this.options.maxRetries,
          baseDelay: 500,
          maxDelay: 8000,
        });
        if (result.vectors.length !== batch.length) {
          throw new KnowledgeError(
            'EMBEDDING_FAILED',
            { expected: batch.length, got: result.vectors.length },
            `Embedding provider returned ${result.vectors.length} vectors for ${batch.length} inputs`,
          );
        }
        allVectors.push(...result.vectors);
        if (result.tokenCounts?.length) totalTokens += result.tokenCounts[0];
      } catch (err) {
        if (err instanceof KnowledgeError) throw err;
        logger.warn({ err, batchIndex }, 'Embedding batch failed');
        throw new KnowledgeError('EMBEDDING_FAILED');
      }
    }

    return { vectors: allVectors, tokenCounts: [totalTokens] };
  }

  async healthCheck(): Promise<boolean> {
    try {
      const provider = this.buildProvider();
      return await provider.ping();
    } catch {
      return false;
    }
  }
}
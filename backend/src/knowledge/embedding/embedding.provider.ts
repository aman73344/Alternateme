/**
 * Embedding provider abstraction. A provider instance is created per
 * alternate/credential and never stores or logs secrets. Batch embedding is
 * handled by EmbeddingService, which owns retry/backoff and rate limits.
 */
export interface EmbeddingProviderOptions {
  apiKey?: string;
  model: string;
  dimensions: number;
  timeoutMs: number;
  batchSize: number;
}

export interface EmbeddingResult {
  vectors: number[][];
  tokenCounts?: number[];
}

export interface EmbeddingProvider {
  readonly id: string;
  readonly dimensions: number;
  embedTexts(texts: string[]): Promise<EmbeddingResult>;
  ping(): Promise<boolean>;
}

export type EmbeddingProviderFactory = (opts: EmbeddingProviderOptions) => EmbeddingProvider;

const factories = new Map<string, EmbeddingProviderFactory>();

export function registerEmbeddingProvider(name: string, factory: EmbeddingProviderFactory): void {
  factories.set(name.toLowerCase(), factory);
}

export function hasEmbeddingProvider(name: string): boolean {
  return factories.has(name.toLowerCase());
}

export function createEmbeddingProvider(name: string, opts: EmbeddingProviderOptions): EmbeddingProvider {
  const factory = factories.get(name.toLowerCase());
  if (!factory) {
    throw new Error(`No embedding provider registered for "${name}"`);
  }
  const provider = factory(opts);
  if (provider.dimensions !== opts.dimensions) {
    throw new Error(
      `Embedding dimension mismatch for "${name}": provider=${provider.dimensions}, config=${opts.dimensions}`,
    );
  }
  return provider;
}

export function listEmbeddingProviders(): string[] {
  return Array.from(factories.keys());
}
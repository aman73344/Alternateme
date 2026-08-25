import { registerEmbeddingProvider } from './embedding.provider';
import { OpenAiEmbeddingProvider } from './openai-embedding.provider';
import { DeterministicEmbeddingProvider } from './deterministic-embedding.provider';

let initialized = false;

/** Register available embedding providers exactly once. */
export function registerEmbeddingProviders(): void {
  if (initialized) return;
  registerEmbeddingProvider('openai', (opts) => new OpenAiEmbeddingProvider(opts));
  registerEmbeddingProvider('deterministic', (opts) => new DeterministicEmbeddingProvider(opts));
  initialized = true;
}
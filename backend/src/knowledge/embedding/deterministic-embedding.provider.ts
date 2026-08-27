import { createHash } from 'crypto';
import { config } from '@/config';
import type { EmbeddingProvider, EmbeddingProviderOptions, EmbeddingResult } from './embedding.provider';

/**
 * DeterministicEmbeddingProvider — a zero-network provider that derives a
 * stable numeric vector from each text via SHA-256 hashing. It lets the full
 * pipeline (extract → clean → chunk → embed → pgvector store) run in tests and
 * offline without an API key. Production should use `openai` unless explicitly
 * configured with EMBEDDING_PROVIDER=deterministic for local evaluation.
 */
export class DeterministicEmbeddingProvider implements EmbeddingProvider {
  readonly id = 'deterministic';
  readonly dimensions: number;

  constructor(opts: EmbeddingProviderOptions) {
    // Defaults to the same dimension as the pgvector column created by the
    // phase-3 migration (vector(1536)) and EMBEDDING_DIMENSIONS.
    this.dimensions = opts.dimensions ?? config.knowledge.embedding.dimensions;
  }

  private vectorFor(text: string): number[] {
    const vector = new Array<number>(this.dimensions);
    for (let i = 0; i < this.dimensions; i += 1) {
      const digest = createHash('sha256')
        .update(`${i}:${text.slice(0, 4000)}:${this.dimensions}`)
        .digest();
      // Map 16 bits of the digest to roughly [-1, 1].
      vector[i] = ((digest[0] * 256 + digest[1]) / 32767.5) - 1;
    }
    return vector;
  }

  async embedTexts(texts: string[]): Promise<EmbeddingResult> {
    return { vectors: texts.map((t) => this.vectorFor(t)) };
  }

  async ping(): Promise<boolean> {
    return true;
  }
}
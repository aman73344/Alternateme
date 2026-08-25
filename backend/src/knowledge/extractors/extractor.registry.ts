import type { DocumentExtractor, ExtractSource } from './extractor';

/**
 * ExtractorRegistry maps a given source to the single adapter that can
 * ingest it, keeping the pipeline free of giant switch statements across the
 * codebase. Adapters are registered once (see index.ts) and resolved lazily.
 */
export class ExtractorRegistry {
  private readonly adapters = new Map<string, DocumentExtractor>();

  register(extractor: DocumentExtractor): void {
    this.adapters.set(extractor.id, extractor);
  }

  get(id: string): DocumentExtractor | undefined {
    return this.adapters.get(id);
  }

  all(): DocumentExtractor[] {
    return Array.from(this.adapters.values());
  }

  /** Returns the extractor whose `supports` matches the source, or null. */
  resolve(source: ExtractSource): DocumentExtractor | null {
    for (const adapter of this.adapters.values()) {
      if (adapter.supports(source)) return adapter;
    }
    return null;
  }
}

export const extractorRegistry = new ExtractorRegistry();
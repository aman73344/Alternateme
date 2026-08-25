import { KnowledgeError } from '../knowledge.errors';
import type { DocumentExtractor, ExtractSource } from './extractor';
import type { ExtractionResult } from '../knowledge.types';

/**
 * OtherExtractor — handles owner-provided plain text or content passed through
 * metadata (e.g. a raw transcript the owner pasted). Does not attempt any
 * network or scraping.
 */
export class OtherExtractor implements DocumentExtractor {
  readonly id = 'other';

  supports(source: ExtractSource): boolean {
    return source.type === 'OTHER';
  }

  async extract(source: ExtractSource): Promise<ExtractionResult> {
    const content =
      source.buffer?.toString('utf8') ||
      (source.metadata?.content as string) ||
      '';

    if (!content || content.trim().length === 0) {
      throw new KnowledgeError('EMPTY_DOCUMENT', undefined, 'No content provided for this source');
    }

    return {
      title: source.name || source.fileName || 'Provided Content',
      content,
      mimeType: (source.metadata?.mimeType as string) || 'text/plain',
      metadata: { extractor: this.id, sourceType: 'OTHER' },
    };
  }
}
import { KnowledgeError } from '../knowledge.errors';
import type { DocumentExtractor, ExtractSource } from './extractor';
import { isMarkdownSource } from './extractor';
import type { ExtractionResult } from '../knowledge.types';

/**
 * MarkdownExtractor — keeps Markdown semantics (headings, code fences, lists)
 * intact so the chunker can preserve structure and headings. We only normalize
 * line endings / tabs here; parsing happens later in the chunker.
 */
export class MarkdownExtractor implements DocumentExtractor {
  readonly id = 'markdown';

  supports(source: ExtractSource): boolean {
    return source.type === 'FILE' && isMarkdownSource(source);
  }

  async extract(source: ExtractSource): Promise<ExtractionResult> {
    if (!source.buffer) {
      throw new KnowledgeError('UNSUPPORTED_FILE_TYPE', undefined, 'Markdown source is missing its file content');
    }
    const content = source.buffer.toString('utf8');
    if (!content || content.trim().length === 0) {
      throw new KnowledgeError('EMPTY_DOCUMENT', { fileName: source.fileName });
    }
    return {
      title: source.name || source.fileName || 'Markdown Document',
      content: content.replace(/\r\n?/g, '\n').replace(/\t/g, '  '),
      mimeType: 'text/markdown',
      metadata: { extractor: this.id, sourceType: 'FILE' },
    };
  }
}
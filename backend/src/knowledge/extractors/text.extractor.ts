import { KnowledgeError } from '../knowledge.errors';
import type { DocumentExtractor, ExtractSource } from './extractor';
import { isPlainTextSource } from './extractor';
import type { ExtractionResult } from '../knowledge.types';

/** TextExtractor — reads UTF-8/UTF-16 plain text (TXT). */
export class TextExtractor implements DocumentExtractor {
  readonly id = 'text';

  supports(source: ExtractSource): boolean {
    return source.type === 'FILE' && isPlainTextSource(source);
  }

  async extract(source: ExtractSource): Promise<ExtractionResult> {
    if (!source.buffer) {
      throw new KnowledgeError('UNSUPPORTED_FILE_TYPE', undefined, 'TXT source is missing its file content');
    }
    // Respect UTF-16 BOMs that browsers/editors sometimes write for .txt files.
    let content: string;
    if (source.buffer.length >= 2 && source.buffer[0] === 0xff && source.buffer[1] === 0xfe) {
      content = source.buffer.slice(2).toString('utf16le');
    } else {
      content = source.buffer.toString('utf8');
    }

    if (!content || content.trim().length === 0) {
      throw new KnowledgeError('EMPTY_DOCUMENT', { fileName: source.fileName });
    }

    return {
      title: source.name || source.fileName || 'Text Document',
      content,
      mimeType: 'text/plain',
      metadata: { extractor: this.id, sourceType: 'FILE' },
    };
  }
}
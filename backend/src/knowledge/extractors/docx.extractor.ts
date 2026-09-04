import mammoth from 'mammoth';
import { KnowledgeError } from '../knowledge.errors';
import { logger } from '@/utils/logger';
import type { DocumentExtractor, ExtractSource } from './extractor';
import { isDocxSource } from './extractor';
import type { ExtractionResult } from '../knowledge.types';

/**
 * Convert mammoth's HTML output into lightweight markdown so headings, lists
 * and tables keep structural meaning for the chunker (which reads `#` markers).
 * This is a compact transformer; self-closing/void tags and parser quirks are
 * tolerable because the result goes through ContentCleaner afterwards.
 */
export function htmlToKnowledgeMarkdown(html: string): string {
  let s = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '');

  // Convert whole heading elements (open + close) to markdown ATX headings so
  // the chunker can attribute sections; the generic tag-strip later must not
  // see the opening tag anymore.
  s = s.replace(/<h([1-6])>([\s\S]*?)<\/h\1>/gi, (_, n, inner) => {
    const text = inner.replace(/<[^>]*>/g, '').trim();
    return `\n${'#'.repeat(Number(n))} ${text}`;
  });
  s = s.replace(/<li>/gi, '\n- ');
  s = s.replace(/<td>/gi, ' | ');
  s = s.replace(/<th>/gi, ' | ');
  s = s.replace(/<tr>/gi, '\n|');
  s = s.replace(/<caption>/gi, '\n');
  s = s.replace(/<\/t[dh]>/gi, '');
  s = s.replace(/<br\s*\/?>/gi, '\n');
  s = s.replace(/<\/p>|<p[^>]*>/gi, '\n\n');
  s = s.replace(/<\/li>|<\/ul>|<\/ol>/gi, '\n');
  s = s.replace(/<[^>]+>/g, '');
  s = s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');

  return s
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export class DocxExtractor implements DocumentExtractor {
  readonly id = 'docx';

  supports(source: ExtractSource): boolean {
    return source.type === 'FILE' && isDocxSource(source);
  }

  async extract(source: ExtractSource): Promise<ExtractionResult> {
    if (!source.buffer) {
      throw new KnowledgeError('UNSUPPORTED_FILE_TYPE', undefined, 'DOCX source is missing its file content');
    }
    try {
      const result = await mammoth.convertToHtml({ buffer: source.buffer });
      const content = htmlToKnowledgeMarkdown(result.value || '');
      if (!content || content.trim().length === 0) {
        throw new KnowledgeError('CORRUPT_DOCUMENT', { fileName: source.fileName });
      }
      return {
        title: source.name || source.fileName || 'Word Document',
        content,
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        metadata: { extractor: this.id, sourceType: 'FILE', warnings: result.messages || [] },
      };
    } catch (err) {
      if (err instanceof KnowledgeError) throw err;
      logger.warn({ err, fileName: source.fileName }, 'DOCX extraction failed');
      throw new KnowledgeError('CORRUPT_DOCUMENT', { fileName: source.fileName });
    }
  }
}
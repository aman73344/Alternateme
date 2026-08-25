import { PDFParse } from 'pdf-parse';
import { KnowledgeError } from '../knowledge.errors';
import { OCR_TEXT_THRESHOLD_CHARS } from '../knowledge.constants';
import { logger } from '@/utils/logger';
import type { DocumentExtractor, ExtractSource } from './extractor';
import { isPdfSource } from './extractor';
import type { ExtractionResult } from '../knowledge.types';

/**
 * PdfExtractor — extracts text and page count from PDFs. Uses pdf-parse (2.x)
 * which drives a PDF.js worker. When the text layer is tiny the PDF is almost
 * certainly a scanned document; rather than silently producing empty knowledge
 * we mark it OCR_REQUIRED (OCR is a later, opt-in capability).
 */
export class PdfExtractor implements DocumentExtractor {
  readonly id = 'pdf';

  supports(source: ExtractSource): boolean {
    return source.type === 'FILE' && isPdfSource(source);
  }

  async extract(source: ExtractSource): Promise<ExtractionResult> {
    if (!source.buffer) {
      throw new KnowledgeError('UNSUPPORTED_FILE_TYPE', undefined, 'PDF source is missing its file content');
    }

    let parser: PDFParse | undefined;
    try {
      parser = new PDFParse({ data: new Uint8Array(source.buffer), verbosity: 0 });
      const textResult = await parser.getText({ pageJoiner: '\n\n', lineEnforce: true });
      const text = textResult?.text || '';
      const pageCount = textResult?.pages?.length ?? 0;
      const title = source.name || source.fileName || 'PDF Document';

      if (text.trim().length < OCR_TEXT_THRESHOLD_CHARS) {
        return {
          title,
          content: '',
          mimeType: 'application/pdf',
          pageCount,
          ocrRequired: true,
          metadata: { extractor: this.id, sourceType: 'FILE', pageCount },
        };
      }

      return {
        title,
        content: text,
        mimeType: 'application/pdf',
        pageCount,
        metadata: { extractor: this.id, sourceType: 'FILE', pageCount },
      };
    } catch (err) {
      logger.warn({ err, fileName: source.fileName }, 'PDF extraction failed');
      throw new KnowledgeError('CORRUPT_DOCUMENT', { fileName: source.fileName });
    } finally {
      if (parser) {
        try {
          await parser.destroy();
        } catch {
          /* best-effort teardown */
        }
      }
    }
  }
}
import { extractorRegistry } from './extractor.registry';
import { PdfExtractor } from './pdf.extractor';
import { DocxExtractor } from './docx.extractor';
import { TextExtractor } from './text.extractor';
import { MarkdownExtractor } from './markdown.extractor';
import { WebExtractor } from './web.extractor';
import { YoutubeExtractor } from './youtube.extractor';
import { LinkedinExtractor } from './linkedin.extractor';
import { OtherExtractor } from './other.extractor';

/** Register every extractor adapter exactly once (idempotent). */
export function registerExtractors(): void {
  extractorRegistry.register(new PdfExtractor());
  extractorRegistry.register(new DocxExtractor());
  extractorRegistry.register(new TextExtractor());
  extractorRegistry.register(new MarkdownExtractor());
  extractorRegistry.register(new WebExtractor());
  extractorRegistry.register(new YoutubeExtractor());
  extractorRegistry.register(new LinkedinExtractor());
  extractorRegistry.register(new OtherExtractor());
}

export { extractorRegistry };
export type { DocumentExtractor, ExtractSource } from './extractor';
export { getYouTubeVideoId } from './youtube.extractor';
export { htmlToKnowledgeMarkdown } from './docx.extractor';
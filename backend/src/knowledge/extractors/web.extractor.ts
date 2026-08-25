import * as cheerio from 'cheerio';
import { KnowledgeError } from '../knowledge.errors';
import { logger } from '@/utils/logger';
import type { DocumentExtractor, ExtractSource } from './extractor';
import { isHtmlSource } from './extractor';
import type { ExtractionResult } from '../knowledge.types';

const NOISE_SELECTORS = [
  'script',
  'style',
  'noscript',
  'template',
  'svg',
  'canvas',
  'iframe',
  'form',
  'nav',
  'footer',
  'header',
  'aside',
  '.advertisement',
  '.ad',
  '.adsbygoogle',
  '[class*="adsbygoogle"]',
  '[class*=" cookie-"]',
  '[id*="cookie"]',
  '[class*="cookie"]',
  '[class*="popup"]',
  '[class*="modal"]',
  '[class*="banner"]',
  '[aria-label*="cookie"]',
  '.social-share',
  '[class*="tracking"]',
];

/**
 * WebExtractor — turns fetched HTML into readable article/main content.
 * It strips navigation/ads/cookie chrome (never indexed as knowledge), prefers
 * the <article>/<main>/[role=main] element, and emits headings as markdown so
 * downstream chunking preserves structure. All-HTML text is DOM-based (cheerio)
 * and numeric-entity-safe; images/media are intentionally dropped.
 */
export class WebExtractor implements DocumentExtractor {
  readonly id = 'web';

  supports(source: ExtractSource): boolean {
    return source.type === 'URL' && (isHtmlSource(source) || !!source.buffer);
  }

  async extract(source: ExtractSource): Promise<ExtractionResult> {
    if (!source.buffer) {
      throw new KnowledgeError('FETCH_FAILED', undefined, 'Web source is missing fetched body');
    }
    try {
      const html = source.buffer.toString('utf8');
      const $ = cheerio.load(html as any);
      $(NOISE_SELECTORS.join(',')).remove();

      const root =
        $('article').first().length > 0
          ? $('article').first()
          : $('main').first().length > 0
            ? $('main').first()
            : $('[role="main"]').first().length > 0
              ? $('[role="main"]').first()
              : $('body').first();

      const parts: string[] = [];
      root
        .find('p, h1, h2, h3, h4, h5, h6, li, pre, blockquote, figcaption, td')
        .each((_i: number, el: any) => {
          const elTag = el?.tagName?.toLowerCase();
          const text = ($(el).text() || '').replace(/\s+/g, ' ').trim();
          if (!text) return;
          if (elTag && /^h[1-6]$/.test(elTag)) {
            parts.push(`${'#'.repeat(Number(elTag[1]))} ${text}`);
          } else {
            parts.push(text);
          }
        });

      let content = parts.join('\n\n').trim();
      if (!content) {
        content = (root.text() || '').replace(/\s+/g, ' ').trim();
      }

      const title =
        $('meta[property="og:title"]').attr('content') ||
        $('title').first().text().trim() ||
        (source.name || source.url || 'Web Page');
      const language = ($('html').attr('lang') || 'en').slice(0, 10);

      return {
        title,
        content,
        mimeType: 'text/html',
        language,
        sourceUrl: source.url,
        metadata: {
          extractor: this.id,
          sourceType: 'URL',
          canonicalUrl: source.url,
        },
      };
    } catch (err) {
      logger.warn({ err, url: source.url }, 'Web extraction failed');
      throw new KnowledgeError('EXTRACTION_FAILED', { url: source.url });
    }
  }
}
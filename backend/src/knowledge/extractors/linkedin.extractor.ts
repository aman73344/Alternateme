import { KnowledgeError } from '../knowledge.errors';
import type { DocumentExtractor, ExtractSource } from './extractor';
import type { ExtractionResult } from '../knowledge.types';

/**
 * LinkedinExtractor — deliberately non-scraping.
 *
 * LinkedIn profile/posts sit behind an authentication wall. We do not bypass
 * logins, CAPTCHAs, rate limits or access controls and we never invent data.
 * Only content the platform owner explicitly provides (public page, official
 * API responses) is eligible. When a LinkedIn source cannot be retrieved, the
 * pipeline marks the TrainingSource FAILED with LINKEDIN_ACCESS_UNAVAILABLE.
 */
export class LinkedinExtractor implements DocumentExtractor {
  readonly id = 'linkedin';

  supports(source: ExtractSource): boolean {
    return source.type === 'LINKEDIN';
  }

  async extract(_source: ExtractSource): Promise<ExtractionResult> {
    throw new KnowledgeError(
      'LINKEDIN_ACCESS_UNAVAILABLE',
      undefined,
      'LinkedIn content requires authorization and could not be retrieved.',
    );
  }
}
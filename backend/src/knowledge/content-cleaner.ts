import type { CleanedContent, ExtractionResult } from './knowledge.types';

const CONTROL_RE = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;
const HTTP_TAG_RE = /<[^>]*>/g;
const ENTITY_RE = /&(amp|lt|gt|quot|apos|nbsp|#\d+|#x[0-9a-fA-F]+);/g;
const MULTI_SPACE_RE = /[ \t]{2,}/g;
const MULTI_NL_RE = /\n{3,}/g;
const ZERO_WIDTH_RE = /[\u200b-\u200d\u2060\ufeff]/g;

function decodeEntities(html: string): string {
  const entities: Record<string, string> = {
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'",
    nbsp: ' ',
  };
  return html.replace(ENTITY_RE, (m, name) => {
    if (name in entities) return entities[name];
    if (name.startsWith('#x')) return String.fromCodePoint(parseInt(name.slice(2), 16));
    if (name.startsWith('#')) return String.fromCodePoint(parseInt(name.slice(1), 10));
    return m;
  });
}

/** Fix common UTF-8-read-as-Latin-1 mojibake sequences (e.g. "Ã©" → "é"). */
function fixMojibake(text: string): string {
  // "Ã" (U+00C3) is the Latin-1 rendering of UTF-8 lead byte 0xC3. The next
  // character in the unsuitable range [0x80..0xC2] represents the mojibaked
  // continuation byte (0xA9 for "é", 0xC2 for "Â", ...). Real Latin-1 text
  // like Portuguese "São" never contains "Ã" followed by such a character.
  const pattern = /Ã[\u0080-\u00C2]/g;
  const charset = (text.match(pattern) || []).length;
  if (charset < 2) return text;
  try {
    return Buffer.from(text, 'latin1').toString('utf8');
  } catch {
    return text;
  }
}

/** Strip repeated boilerplate lines (cookies bars, page titles, footers). */
function stripRepeatedBoilerplate(text: string): string {
  const lines = text.split('\n');
  const freq = new Map<string, { count: number }>();
  const trimmed = lines.map((l) => l.trim());
  for (const line of trimmed) {
    if (!line || line.length > 120) continue;
    if (/^[#>*`-]/.test(line)) continue; // preserve markdown markers
    const key = line.toLowerCase();
    freq.set(key, { count: (freq.get(key)?.count || 0) + 1 });
  }

  return lines
    .map((raw, i) => {
      const line = raw.trim();
      if (!line || line.length > 120) return raw;
      const entry = freq.get(line.toLowerCase());
      if (entry && entry.count >= 3 && !/^[#>*`-]/.test(line)) {
        return '';
      }
      return i === 0 || lines[i - 1].trim() === '' ? raw : raw.replace(/^\s+/, '');
    })
    .filter((l, i, arr) => {
      // Drop empty lines produced by boilerplate removal.
      if (l.trim() !== '') return true;
      return !(arr[i - 1] === undefined || arr[i - 1].trim() === '');
    })
    .join('\n');
}

export interface CleanerOptions {
  maxCharacters?: number;
}

/**
 * ContentCleaner — turns the raw extraction of any source type into normalized
 * content that is safe to chunk. Kept independent of extraction so it can be
 * reused by every adapter (PDF, DOCX, web, YouTube, ...) and unit tested in
 * isolation.
 */
export class ContentCleaner {
  constructor(private readonly options: CleanerOptions = {}) {}

  clean(raw: ExtractionResult | { content: string; metadata?: Record<string, unknown> }): CleanedContent {
    let text = raw.content || '';

    // 1. Fix encoding problems before any structural work.
    text = fixMojibake(text);

    // 2. Unicode normalization (compose + remove zero-width chars).
    text = text.normalize('NFKC').replace(ZERO_WIDTH_RE, '');

    // 3. Strip residual HTML from web/email layers (tags + entities).
    text = decodeEntities(text.replace(HTTP_TAG_RE, ''));

    // 4. Normalize line endings + kill stray control characters.
    text = text.replace(/\r\n?/g, '\n').replace(CONTROL_RE, '');

    // 5. Remove empty sections (a paragraph containing only whitespace/punct).
    text = text
      .split(/\n{2,}/)
      .filter((section) => {
        const compact = section.replace(/\s+/g, ' ');
        return compact.trim().length >= 2;
      })
      .join('\n\n');

    // 6. Repeated boilerplate (headers/footers/nav) removal.
    text = stripRepeatedBoilerplate(text);

    // 7. Whitespace hygiene; preserve markdown structure.
    text = text
      .split('\n')
      .map((line) => (line.startsWith(' ') && line.trim() ? line.replace(/^ {2,}/, '  ') : line))
      .join('\n')
      .replace(HTTP_TAG_RE, '')
      .replace(MULTI_SPACE_RE, ' ')
      .replace(MULTI_NL_RE, '\n\n')
      .trim();

    if (this.options.maxCharacters && text.length > this.options.maxCharacters) {
      text = text.slice(0, this.options.maxCharacters);
    }

    return {
      content: text,
      language: (raw as ExtractionResult).language,
      metadata: raw.metadata || {},
    };
  }
}
import { estimateTokens } from './tokenizer';
import type { Chunk } from './knowledge.types';

export interface ChunkingOptions {
  chunkSize?: number; // target characters per chunk
  overlap?: number; // characters of overlap between consecutive chunks
  maxChunkSize?: number; // hard ceiling (never split a unit larger than this)
  minChunkSize?: number; // merge trailing fragments smaller than this into the prior chunk
}

interface Segment {
  text: string;
  type: 'heading' | 'paragraph' | 'list' | 'code';
  level: number; // heading level 1..6, 0 otherwise
}

const HEADING_RE = /^(#{1,6})\s+(.*)$/;
const CODE_FENCE_RE = /^```/;

/** Sentence boundary heuristic — keeps abbreviations ("Dr.", "U.S.") intact. */
export function splitIntoSentences(text: string): string[] {
  const parts = text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"'(])/);
  return parts.filter((p) => p.trim().length > 0);
}

/**
 * Split cleaned content into semantic segments: headings, fenced code blocks,
 * list blocks and paragraphs. Blank lines separate blocks; a heading always
 * terminates the preceding paragraph so sections stay attributable.
 */
export function tokenizeSegments(content: string): Segment[] {
  const segments: Segment[] = [];
  const lines = content.split('\n');
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      i += 1;
      continue;
    }

    // Code block — fences stay intact so code semantics survive chunking.
    if (CODE_FENCE_RE.test(trimmed)) {
      const blockLines: string[] = [line];
      i += 1;
      while (i < lines.length && !CODE_FENCE_RE.test(lines[i].trim())) {
        blockLines.push(lines[i]);
        i += 1;
      }
      if (i < lines.length) blockLines.push(lines[i]); // closing fence
      i += 1;
      segments.push({ text: blockLines.join('\n'), type: 'code', level: 0 });
      continue;
    }

    // Markdown heading — a single logical unit; following paragraphs carry it
    // as their active-heading prefix (see ChunkingService.chunk).
    const headingMatch = trimmed.match(HEADING_RE);
    if (headingMatch) {
      segments.push({ text: trimmed, type: 'heading', level: headingMatch[1].length });
      i += 1;
      continue;
    }

    // Paragraph or list item: collect until a blank line, fence or heading,
    // preserving list markers.
    const block: string[] = [line];
    i += 1;
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !CODE_FENCE_RE.test(lines[i].trim()) &&
      !HEADING_RE.test(lines[i].trim())
    ) {
      block.push(lines[i]);
      i += 1;
    }
    const isList = block.every((l) => /^(\s*[-*+]|\s*\d+[.)])\s/.test(l.trim()));
    segments.push({ text: block.join('\n'), type: isList ? 'list' : 'paragraph', level: 0 });
  }
  return segments;
}

/** Greedy-pack semantic units into chunk-sized strings without splitting units. */
function greedyPack(
  units: string[],
  options: { chunkSize: number; maxChunkSize: number },
): string[] {
  const chunks: string[] = [];
  let current = '';
  for (const unit of units) {
    if (current && current.length + unit.length + 1 > options.chunkSize) {
      chunks.push(current.trimEnd());
      current = unit;
    } else {
      current = current ? `${current}\n\n${unit}` : unit;
    }

    // Overshooting the hard ceiling gets sentence-split, then hard-wrapped.
    if (current.length > options.maxChunkSize) {
      const sentences = splitIntoSentences(current);
      for (const sentence of sentences) {
        if (
          chunks.length === 0 ||
          chunks[chunks.length - 1].length + sentence.length + 1 > options.chunkSize
        ) {
          chunks.push(sentence.trimEnd());
        } else {
          chunks[chunks.length - 1] = `${chunks[chunks.length - 1]}\n\n${sentence}`.trimEnd();
        }
      }
      // A single sentence can still exceed the ceiling — hard-wrap it.
      for (let k = 0; k < chunks.length; k += 1) {
        if (chunks[k].length > options.maxChunkSize) {
          const pieces: string[] = [];
          for (let start = 0; start < chunks[k].length; start += options.maxChunkSize) {
            const piece = chunks[k].slice(start, start + options.maxChunkSize).trimEnd();
            if (piece) pieces.push(piece);
          }
          chunks.splice(k, 1, ...pieces);
          k += pieces.length - 1;
        }
      }
      current = '';
    }
  }
  if (current) chunks.push(current.trimEnd());
  return chunks.filter((c) => c.length > 0);
}

function applyOverlap(rawChunks: string[], overlap: number): string[] {
  if (overlap <= 0 || rawChunks.length <= 1) return rawChunks;
  const out: string[] = [rawChunks[0]];
  for (let i = 1; i < rawChunks.length; i += 1) {
    const tail = rawChunks[i - 1].slice(-overlap).trim();
    out.push(tail ? `${tail}\n\n${rawChunks[i]}` : rawChunks[i]);
  }
  return out;
}

function mergeTrailingFragments(chunks: string[], minChunkSize: number): string[] {
  if (chunks.length < 2) return chunks;
  const last = chunks[chunks.length - 1];
  if (last.length < minChunkSize) {
    chunks[chunks.length - 2] = `${chunks[chunks.length - 2]}\n\n${last}`.trimEnd();
    chunks.pop();
  }
  return chunks;
}

/**
 * ChunkingService — deterministic, structure-aware chunking.
 *
 * Flow: Document → sections (headings/code/lists) → paragraphs → sentences →
 * chunks. Chunks respect semantic boundaries (headings start chunks, sentences
 * are not split unless a unit exceeds the hard max) and expose the current
 * heading + paragraph/section metadata.
 */
export class ChunkingService {
  constructor(private readonly options: ChunkingOptions = {}) {}

  private resolveOptions(): Required<ChunkingOptions> {
    return {
      chunkSize: this.options.chunkSize ?? 1000,
      overlap: this.options.overlap ?? 150,
      maxChunkSize: this.options.maxChunkSize ?? 2048,
      minChunkSize: this.options.minChunkSize ?? 64,
    };
  }

  chunk(content: string, baseMetadata: Record<string, unknown> = {}): Chunk[] {
    const { chunkSize, overlap, maxChunkSize, minChunkSize } = this.resolveOptions();
    const segments = tokenizeSegments(content);

    // Build paragraph-sized semantic units (paragraphs and list blocks stay
    // together). Markdown heading lines keep their raw `#` markers in the chunk
    // content (spec: don't destroy Markdown semantics unnecessarily), while the
    // stripped text is used as the descriptive prefix for following sections.
    const units: string[] = [];
    const headings: string[] = [];
    for (const seg of segments) {
      if (seg.type === 'heading') {
        headings.push(seg.text.replace(/^#+\s*/, ''));
        units.push(seg.text);
      } else {
        const prefix = headings.length > 0 ? headings[headings.length - 1] : undefined;
        units.push(prefix ? `${prefix}\n\n${seg.text}` : seg.text);
      }
    }

    let raw = greedyPack(units, { chunkSize, maxChunkSize });
    raw = applyOverlap(raw, overlap);
    raw = mergeTrailingFragments(raw, minChunkSize);

    return raw.map((text, index) => {
      const contentText = text.trim();
      const firstLine = contentText.split('\n')[0] || '';
      const parsedHeading = firstLine.replace(/^#+\s*/, '').trim();
      return {
        content: contentText,
        index,
        heading: parsedHeading.length > 0 && parsedHeading.length < 200 ? parsedHeading : undefined,
        tokenCount: estimateTokens(contentText),
        characterCount: contentText.length,
        metadata: { ...baseMetadata, chunkIndex: index },
      };
    });
  }
}

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  ChunkingService,
  tokenizeSegments,
  splitIntoSentences,
} from '@/knowledge/chunking.service';
import { ContentCleaner } from '@/knowledge/content-cleaner';
import { estimateTokens } from '@/knowledge/tokenizer';
import { validateUploadedFile, hashBuffer } from '@/knowledge/file-validator';
import { KnowledgeError } from '@/knowledge/knowledge.errors';
import { isPrivateAddress, isAcceptedContentType } from '@/knowledge/url-fetcher';
import { registerExtractors, extractorRegistry } from '@/knowledge/extractors';
import { DeterministicEmbeddingProvider } from '@/knowledge/embedding/deterministic-embedding.provider';
import { EmbeddingService } from '@/knowledge/embedding/embedding.service';

const FIXTURES = path.join(__dirname, '..', 'fixtures');
function fixture(name: string): Buffer {
  return fs.readFileSync(path.join(FIXTURES, name));
}

describe('tokenizer', () => {
  it('estimates latin tokens at roughly one per four characters', () => {
    expect(estimateTokens('aaaa')).toBe(1);
    expect(estimateTokens('a'.repeat(40))).toBe(10);
  });

  it('counts CJK characters individually', () => {
    expect(estimateTokens('漢字')).toBe(2);
  });

  it('is monotonic and never zero for non-empty text', () => {
    const short = estimateTokens('hello world');
    const long = estimateTokens('hello world '.repeat(50));
    expect(long).toBeGreaterThan(short);
    expect(short).toBeGreaterThan(0);
  });
});

describe('splitIntoSentences', () => {
  it('splits at sentence punctuation followed by a capital letter', () => {
    expect(splitIntoSentences('First sentence. Second sentence! Third?')).toHaveLength(3);
  });

  it('keeps decimal abbreviations intact', () => {
    const parts = splitIntoSentences('The U.S. market grew. It kept growing.');
    expect(parts).toHaveLength(2);
  });
});

describe('tokenizeSegments', () => {
  it('keeps fenced code blocks intact as a single segment', () => {
    const segments = tokenizeSegments('line before\n```js\nconst a = 1;\n\nconst b = 2;\n```\nline after');
    const code = segments.filter((s) => s.type === 'code');
    expect(code).toHaveLength(1);
    expect(code[0].text).toContain('const a = 1;');
    expect(code[0].text).toContain('const b = 2;');
  });

  it('treats headings as their own segment', () => {
    const segments = tokenizeSegments('# Title\nBody text.');
    expect(segments[0].type).toBe('heading');
    expect(segments[1].type).toBe('paragraph');
  });
});

describe('ChunkingService', () => {
  const service = new ChunkingService({
    chunkSize: 400,
    overlap: 60,
    maxChunkSize: 800,
    minChunkSize: 32,
  });

  const longDoc = [
    '# Cat Breeds',
    'The Maine Coon is a large domesticated cat breed. It has a distinctive physical appearance',
    'and valuable hunting skills. The breed was popular in cat shows in the late nineteenth century.',
    '',
    '## Siamese',
    'The Siamese cat is one of the first distinctly recognized breeds of Asian cat. It derives from',
    'the Wichianmat landrace variety of Thailand. Original genetics established several key traits.',
    '',
    '### Care',
    'Siamese cats require engagement and stimulation. They are known for being vocal and social.',
    'They bond strongly to a single person and crave companionship.',
  ].join('\n');

  it('produces deterministic output', () => {
    const a = JSON.stringify(service.chunk(longDoc));
    const b = JSON.stringify(service.chunk(longDoc));
    expect(a).toBe(b);
  });

  it('assigns sequential indexes and rich metadata to chunks', () => {
    const chunks = service.chunk(longDoc, { sourceType: 'FILE' });
    expect(chunks.length).toBeGreaterThan(0);
    chunks.forEach((c, i) => {
      expect(c.index).toBe(i);
      expect(c.metadata?.chunkIndex).toBe(i);
      expect(c.tokenCount).toBeGreaterThan(0);
      expect(c.characterCount).toBeGreaterThan(0);
      expect(c.content.length).toBeGreaterThan(0);
    });
    const joined = chunks.map((c) => c.content).join('\n---\n');
    expect(joined).toContain('Maine Coon');
    expect(joined).toContain('Siamese');
  });

  it('never exceeds maxChunkSize', () => {
    const noOverlap = new ChunkingService({
      chunkSize: 400,
      overlap: 0,
      maxChunkSize: 800,
      minChunkSize: 32,
    });
    const hugeParagraph = 'word '.repeat(3000); // single gigantic run of text
    const chunks = noOverlap.chunk(hugeParagraph, {});
    for (const c of chunks) {
      expect(c.characterCount).toBeLessThanOrEqual(800 + 4);
    }
  });

  it('keeps code blocks whole when they fit', () => {
    const doc = '```\n' + Array.from({ length: 5 }, (_, i) => `line ${i}`).join('\n') + '\n```';
    const chunks = service.chunk(doc);
    expect(
      chunks.some((c) => c.content.includes('line 0') && c.content.includes('line 4')),
    ).toBe(true);
  });
});
describe('ContentCleaner', () => {
  const cleaner = new ContentCleaner();

  it('strips HTML tags and decodes entities', () => {
    const out = cleaner.clean({
      content: '<p>Fish &amp; chips</p><div>Tom &lt;3 Jerry</div>',
    });
    expect(out.content).toContain('Fish & chips');
    expect(out.content).toContain('Tom <3 Jerry');
    expect(out.content).not.toContain('<p>');
  });

  it('normalizes unicode NFKC and removes zero-width characters', () => {
    const out = cleaner.clean({ content: 'ﬁne\u200btext\u200bx' });
    expect(out.content).toContain('fine'); // ligature decomposed
    expect(out.content).not.toContain('\u200b');
  });

  it('removes control characters and normalizes line endings', () => {
    const out = cleaner.clean({ content: 'a\u0007b\r\n\r\nc\rd' });
    expect(out.content).not.toContain('\r');
    expect(out.content).not.toContain('\u0007');
  });

  it('fixes double-encoded mojibake', () => {
    const mojibake = 'cafÃ© menu ';
    const out = cleaner.clean({ content: mojibake.repeat(6) });
    expect(out.content).not.toContain('Ã©');
  });

  it('drops repeated boilerplate lines but keeps markdown headings', () => {
    const junk = ['Menu', 'body one', '# Title', 'Menu', 'body two', 'Menu', 'body three'].join('\n');
    const out = cleaner.clean({ content: junk });
    expect(out.content.split('\n').filter((l) => l.trim() === 'Menu')).toHaveLength(0);
    expect(out.content).toContain('body one');
    expect(out.content).toContain('# Title');

    const headingJunk = ['# Heading', 'x', '# Heading', '# Heading'].join('\n');
    const headingOut = cleaner.clean({ content: headingJunk });
    expect(headingOut.content.split('# Heading').length - 1).toBe(3);
  });

  it('removes empty sections entirely', () => {
    const out = cleaner.clean({
      content: 'real content here.\n\n\n\n   \n\n\n\nmore real content.',
    });
    expect(out.content).toContain('real content here.');
    expect(out.content).toContain('more real content.');
    expect(out.content.split('\n\n').length).toBe(2);
  });
});

describe('file-validator', () => {
  it('accepts a real PDF by magic bytes regardless of the file name', () => {
    const pdf = fixture('sample.pdf');
    const result = validateUploadedFile(pdf, 'weird-name.bin');
    expect(result.mimeType).toBe('application/pdf');
    expect(result.checksum).toBe(hashBuffer(pdf));
    expect(result.size).toBe(pdf.length);
  });

  it('rejects executables even when renamed to .pdf', () => {
    const exe = Buffer.concat([Buffer.from('MZ'), Buffer.alloc(600, 1)]);
    expect(() => validateUploadedFile(exe, 'evil.pdf')).toThrow(KnowledgeError);
  });

  it('rejects empty buffers with EMPTY_DOCUMENT', () => {
    try {
      validateUploadedFile(Buffer.alloc(0), 'empty.txt');
      throw new Error('should have thrown');
    } catch (err) {
      expect((err as KnowledgeError).code).toBe('EMPTY_DOCUMENT');
    }
  });

  it('rejects path-traversal filenames', () => {
    expect(() =>
      validateUploadedFile(Buffer.from('hello world content here more'), '../secrets.txt'),
    ).toThrow(KnowledgeError);
  });

  it('rejects oversized uploads with FILE_TOO_LARGE', () => {
    const big = Buffer.alloc(26 * 1024 * 1024, 65); // 26 MB
    try {
      validateUploadedFile(big, 'big.txt');
      throw new Error('should have thrown');
    } catch (err) {
      expect((err as KnowledgeError).code).toBe('FILE_TOO_LARGE');
    }
  });
});

describe('url-fetcher guards', () => {
  it('detects private/reserved IPv4 addresses', () => {
    for (const bad of [
      '127.0.0.1',
      '10.0.0.9',
      '172.16.0.1',
      '192.168.1.1',
      '169.254.169.254',
      '0.0.0.0',
    ]) {
      expect(isPrivateAddress(bad)).toBe(true);
    }
    expect(isPrivateAddress('172.32.0.1')).toBe(false); // outside 172.16/12
    expect(isPrivateAddress('8.8.8.8')).toBe(false);
  });

  it('detects private/reserved IPv6 addresses', () => {
    for (const bad of ['::1', 'fe80::1', 'fd00::abcd', '::ffff:127.0.0.1']) {
      expect(isPrivateAddress(bad)).toBe(true);
    }
    expect(isPrivateAddress('2606:4700::1111')).toBe(false);
  });

  it('enforces an allowlist of ingestible content types', () => {
    expect(isAcceptedContentType('text/html; charset=utf-8')).toBe(true);
    expect(isAcceptedContentType('application/pdf')).toBe(true);
    expect(isAcceptedContentType('text/markdown')).toBe(true);
    expect(isAcceptedContentType('image/png')).toBe(false);
    expect(isAcceptedContentType('video/mp4')).toBe(false);
  });
});
describe('extractor registry routing', () => {
  registerExtractors();

  function resolve(partial: {
    type?: string;
    mimeType?: string;
    fileName?: string;
    url?: string;
    buffer?: Buffer;
  }) {
    return extractorRegistry.resolve({
      type: (partial.type ?? 'FILE') as 'FILE' | 'URL' | 'YOUTUBE' | 'LINKEDIN' | 'OTHER',
      mimeType: partial.mimeType,
      fileName: partial.fileName,
      url: partial.url,
      buffer: partial.buffer,
    });
  }

  it('routes each extension/MIME to the correct adapter', () => {
    expect(resolve({ mimeType: 'application/pdf', fileName: 'a.pdf' })?.id).toBe('pdf');
    expect(
      resolve({
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        fileName: 'a.docx',
      })?.id,
    ).toBe('docx');
    expect(resolve({ mimeType: 'text/plain', fileName: 'a.txt' })?.id).toBe('text');
    expect(resolve({ mimeType: 'text/markdown', fileName: 'a.md' })?.id).toBe('markdown');
    expect(resolve({ type: 'URL', mimeType: 'text/html', buffer: Buffer.from('<html/>') })?.id).toBe('web');
    expect(resolve({ type: 'YOUTUBE', url: 'https://youtube.com/watch?v=dQw4w9WgXcQ' })?.id).toBe('youtube');
    expect(resolve({ type: 'LINKEDIN', url: 'https://linkedin.com/in/x' })?.id).toBe('linkedin');
  });
});

describe('file extractors', () => {
  registerExtractors();

  it('extracts TXT exactly as given', async () => {
    const src = fixture('sample.txt').toString('utf8');
    const extractor = extractorRegistry.get('text');
    const out = await extractor!.extract({
      type: 'FILE',
      mimeType: 'text/plain',
      fileName: 'sample.txt',
      buffer: fixture('sample.txt'),
    });
    expect(out.content.trim()).toBe(src.trim());
    expect(out.mimeType).toBe('text/plain');
  });

  it('extracts Markdown preserving structure', async () => {
    const extractor = extractorRegistry.get('markdown');
    const out = await extractor!.extract({
      type: 'FILE',
      mimeType: 'text/markdown',
      fileName: 'sample.md',
      buffer: fixture('sample.md'),
    });
    expect(out.content).toContain('# Intro');
    expect(out.content).toContain('## Details');
    expect(out.content).toContain('```');
    expect(out.content).toContain('- bullet one');
  });

  it('extracts DOCX with headings, paragraphs, lists and tables', async () => {
    const extractor = extractorRegistry.get('docx');
    const out = await extractor!.extract({
      type: 'FILE',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      fileName: 'sample.docx',
      buffer: fixture('sample.docx'),
    });
    expect(out.content).toContain('# Docx Fixture Title');
    expect(out.content).toContain('zebra unicorns');
    expect(out.content).toContain('List item alpha');
    expect(out.content).toContain('Cell A1');
  });

  it('extracts PDF text and reports page count', async () => {
    const extractor = extractorRegistry.get('pdf');
    const out = await extractor!.extract({
      type: 'FILE',
      mimeType: 'application/pdf',
      fileName: 'sample.pdf',
      buffer: fixture('sample.pdf'),
    });
    expect(out.content).toContain('Hello knowledge pipeline');
    expect(out.pageCount ?? 0).toBeGreaterThanOrEqual(1);
    expect(out.ocrRequired).toBeFalsy();
  });

  it('flags scanned PDFs as OCR_REQUIRED instead of inventing knowledge', async () => {
    const extractor = extractorRegistry.get('pdf');
    const out = await extractor!.extract({
      type: 'FILE',
      mimeType: 'application/pdf',
      fileName: 'scan.pdf',
      buffer: fixture('sample-blank.pdf'),
    });
    expect(out.ocrRequired).toBe(true);
    expect(out.content).toBe('');
  });

  it('rejects a corrupt PDF with CORRUPT_DOCUMENT', async () => {
    const extractor = extractorRegistry.get('pdf');
    const bogus = Buffer.from('%PDF-1.4 nonsense that is not a real document body');
    await expect(
      extractor!.extract({ type: 'FILE', mimeType: 'application/pdf', fileName: 'bad.pdf', buffer: bogus }),
    ).rejects.toMatchObject({ code: 'CORRUPT_DOCUMENT' });
  });

  it('rejects an empty TXT with EMPTY_DOCUMENT', async () => {
    const extractor = extractorRegistry.get('text');
    await expect(
      extractor!.extract({ type: 'FILE', mimeType: 'text/plain', fileName: 'empty.txt', buffer: Buffer.from('   \n  ') }),
    ).rejects.toMatchObject({ code: 'EMPTY_DOCUMENT' });
  });
});

describe('deterministic embedding provider', () => {
  it('returns stable vectors with the configured dimensions', async () => {
    const provider = new DeterministicEmbeddingProvider({ dimensions: 8 } as never);
    const [v1] = (await provider.embedTexts(['alpha'])).vectors;
    const [v2] = (await provider.embedTexts(['alpha'])).vectors;
    const [other] = (await provider.embedTexts(['beta'])).vectors;
    expect(v1).toHaveLength(8);
    expect(v1).toEqual(v2);
    expect(other).not.toEqual(v1);
    expect(await provider.ping()).toBe(true);
  });
});

describe('EmbeddingService', () => {
  it('batches and returns one vector per text with the configured model', async () => {
    const service = new EmbeddingService({ provider: 'deterministic', dimensions: 1536 });
    const { vectors } = await service.embed(['hello world', 'second chunk text']);
    expect(vectors).toHaveLength(2);
    expect(vectors[0]).toHaveLength(1536);
    expect(vectors[1]).toHaveLength(1536);
  });

  it('is a no-op for empty input', async () => {
    const service = new EmbeddingService({ provider: 'deterministic' });
    await expect(service.embed([])).resolves.toEqual({ vectors: [], tokenCounts: [] });
  });

  it('rejects unknown providers with EMBEDDING_PROVIDER_ERROR', async () => {
    const service = new EmbeddingService({ provider: 'does-not-exist' });
    await expect(service.embed(['x'])).rejects.toMatchObject({ code: 'EMBEDDING_PROVIDER_ERROR' });
  });
});
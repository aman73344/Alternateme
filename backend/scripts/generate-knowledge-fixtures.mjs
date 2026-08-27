/**
 * Generates deterministic binary knowledge fixtures for Phase 3 tests:
 *   - sample.txt / sample.md   (plain text)
 *   - sample.pdf               (minimal single-page PDF with a valid xref)
 *   - sample-blank.pdf         (valid PDF whose page has NO extractable text → OCR_REQUIRED path)
 *   - sample.docx              (minimal OOXML zip: [Content_Types].xml, .rels, word/document.xml)
 *
 * Run: node scripts/generate-knowledge-fixtures.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import JSZip from 'jszip';

const outDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/tests/fixtures');
fs.mkdirSync(outDir, { recursive: true });

// ------------------------------------------------------------------ txt / md
fs.writeFileSync(
  path.join(outDir, 'sample.txt'),
  [
    'Alternate Me knowledge fixture.',
    '',
    'This plain-text document is ingested end to end.',
    'It contains multiple sentences so the chunker can demonstrate sentence preservation. Cache coherence matters.',
    '',
    'The quick brown fox jumps over the lazy dog repeatedly.',
  ].join('\n'),
);

fs.writeFileSync(
  path.join(outDir, 'sample.md'),
  [
    '# Intro',
    '',
    'Markdown fixture intro paragraph with **bold** text.',
    '',
    '## Details',
    '',
    '- bullet one',
    '- bullet two',
    '',
    '```',
    'const keep = "code fences intact";',
    '```',
    '',
    'Closing paragraph after a fenced code block. Repeated repeated repeated.',
  ].join('\n'),
);

function crc32Table() {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
}
const CRC_TABLE = crc32Table();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function buildPdf(text) {
  const esc = (t) => t.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  const ops = text ? `BT\n/F1 18 Tf\n72 700 Td\n(${esc(text)}) Tj\nET\n` : '';
  const parts = [Buffer.from('%PDF-1.4\n', 'latin1')];
  const offsets = [];
  const addObj = (num, body) => {
    offsets[num] = Buffer.byteLength(Buffer.concat(parts), 'latin1');
    parts.push(Buffer.from(`${num} 0 obj\n${body}\nendobj\n`, 'latin1'));
  };

  addObj(1, '<< /Type /Catalog /Pages 2 0 R >>');
  addObj(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  addObj(
    3,
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
  );
  addObj(4, `<< /Length ${ops.length} >>\nstream\n${ops}endstream`);
  addObj(5, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');

  const xrefStart = Buffer.byteLength(Buffer.concat(parts), 'latin1');
  let xref = 'xref\n0 6\n0000000000 65535 f \n';
  for (let i = 1; i <= 5; i += 1) xref += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  xref += `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;

  parts.push(Buffer.from(xref, 'latin1'));
  return Buffer.concat(parts);
}

fs.writeFileSync(path.join(outDir, 'sample.pdf'), buildPdf('Hello knowledge pipeline from a generated PDF fixture.'));
fs.writeFileSync(path.join(outDir, 'sample-blank.pdf'), buildPdf(''));
console.log(`Base fixtures written to ${outDir}`);

// --------------------------------------------------------------------- DOCX
/** Stored-method zip writer (no compression) — enough for mammoth to read. */
function buildZip(entries) {
  const enc = new TextEncoder();
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  const dosTime = 0;
  const dosDate = (44 << 9) | (1 << 5) | 1; // fixed timestamp

  for (const entry of entries) {
    const nameBytes = enc.encode(entry.name);
    const dataBytes = typeof entry.data === 'string' ? enc.encode(entry.data) : entry.data;
    const crc = crc32(dataBytes);

    const lfh = Buffer.alloc(30);
    lfh.writeUInt32LE(0x04034b50, 0); // signature
    lfh.writeUInt16LE(20, 4); // version needed
    lfh.writeUInt16LE(0x0800, 6); // UTF-8 flag
    lfh.writeUInt16LE(0, 8); // method = stored
    lfh.writeUInt16LE(dosTime, 10);
    lfh.writeUInt16LE(dosDate, 12);
    lfh.writeUInt32LE(crc, 14);
    lfh.writeUInt32LE(dataBytes.length, 18);
    lfh.writeUInt32LE(dataBytes.length, 22);
    lfh.writeUInt16LE(nameBytes.length, 26);
    lfh.writeUInt16LE(0, 28);
    localParts.push(lfh, nameBytes, dataBytes);

    const cdh = Buffer.alloc(46);
    // Central directory header — APPNOTE.TXT layout, absolute offsets:
    // 0 sig | 4 verMade | 6 verNeeded | 8 flags | 10 method | 12 time |
    // 14 date | 16 crc | 20 csize | 24 usize | 28 nameLen | 30 extraLen |
    // 32 commentLen | 34 diskStart | 36 intAttr | 38 extAttr | 42 LHO | 46 name
    cdh.writeUInt32LE(0x02014b50, 0);
    cdh.writeUInt16LE(20, 4);
    cdh.writeUInt16LE(20, 6);
    cdh.writeUInt16LE(0x0800, 8);
    cdh.writeUInt16LE(0, 10);
    cdh.writeUInt16LE(dosTime, 12);
    cdh.writeUInt16LE(dosDate, 14);
    cdh.writeUInt32LE(crc, 16);
    cdh.writeUInt32LE(dataBytes.length, 20);
    cdh.writeUInt32LE(dataBytes.length, 24);
    cdh.writeUInt16LE(nameBytes.length, 28);
    cdh.writeUInt32LE(offset, 42); // relative offset of local header
    centralParts.push(cdh, nameBytes);

    offset += 30 + nameBytes.length + dataBytes.length;
  }

  const centralBuf = Buffer.concat(centralParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...localParts, centralBuf, eocd]);
}

const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>
<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Docx Fixture Title</w:t></w:r></w:p>
<w:p><w:r><w:t>First paragraph from the DOCX fixture.</w:t></w:r></w:p>
<w:p><w:r><w:t>Second paragraph mentions zebra unicorns.</w:t></w:r></w:p>
<w:p><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr><w:r><w:t>List item alpha</w:t></w:r></w:p>
<w:p><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr><w:r><w:t>List item beta</w:t></w:r></w:p>
<w:tbl>
<w:tr><w:tc><w:p><w:r><w:t>Cell A1</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>Cell B1</w:t></w:r></w:p></w:tc></w:tr>
<w:tr><w:tc><w:p><w:r><w:t>Cell A2</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>Cell B2</w:t></w:r></w:p></w:tc></w:tr>
</w:tbl>
</w:body>
</w:document>`;

const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

fs.writeFileSync(
  path.join(outDir, 'sample.docx'),
  buildZip([
    { name: '[Content_Types].xml', data: contentTypes },
    { name: '_rels/.rels', data: rels },
    { name: 'word/document.xml', data: documentXml },
  ]),
);

console.log(`All fixtures written to ${outDir}`);


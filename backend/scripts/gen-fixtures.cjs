/**
 * Generates deterministic binary test fixtures for the Phase 3 knowledge
 * pipeline without extra dependencies:
 *   - fixtures/minimal.pdf   — valid single-page PDF (xref offsets computed)
 *   - fixtures/minimal.docx  — minimal OOXML document in a STORED-mode zip
 *
 * Run: node scripts/gen-fixtures.cjs
 */
const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, '..', 'src', 'knowledge', '__tests__', 'fixtures');
fs.mkdirSync(OUT_DIR, { recursive: true });

// ---------------------------------------------------------------------------
// PDF builder
// ---------------------------------------------------------------------------
function buildPdf(lines) {
  const textOps = lines
    .map((line, i) => {
      const escaped = line.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
      return `BT /F1 14 Tf 72 ${720 - i * 24} Td (${escaped}) Tj ET`;
    })
    .join('\n');

  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${Buffer.byteLength(textOps, 'ascii')} >>\nstream\n${textOps}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];

  let body = '%PDF-1.4\n';
  const offsets = [];
  objects.forEach((obj, i) => {
    offsets.push(Buffer.byteLength(body, 'ascii'));
    body += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  });

  const xrefStart = Buffer.byteLength(body, 'ascii');
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) xref += `${String(off).padStart(10, '0')} 00000 n \n`;
  const trailer =
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;

  return Buffer.from(body + xref + trailer, 'ascii');
}

// ---------------------------------------------------------------------------
// Minimal DOCX (stored zip) builder
// ---------------------------------------------------------------------------
const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let crc = -1;
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ buf[i]) & 0xff];
  return (crc ^ -1) >>> 0;
}

function buildStoredZip(entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const { name, data } of entries) {
    const nameBuf = Buffer.from(name, 'utf8');
    const dataBuf = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf8');
    const crc = crc32(dataBuf);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); // signature
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0, 6); // flags
    local.writeUInt16LE(0, 8); // method: stored
    local.writeUInt16LE(0x2100, 12); // date (2000-01-01)
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(dataBuf.length, 18);
    local.writeUInt32LE(dataBuf.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);

    localParts.push(local, nameBuf, dataBuf);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(0x2100, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(dataBuf.length, 20);
    central.writeUInt32LE(dataBuf.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt32LE(offset, 42);

    centralParts.push(central, nameBuf);
    offset += 30 + nameBuf.length + dataBuf.length;
  }

  const centralSize = centralParts.reduce((n, b) => n + b.length, 0);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralSize, 12);
  eocd.writeUInt32LE(offset, 16);

  return Buffer.concat([...localParts, ...centralParts, eocd]);
}

// ---------------------------------------------------------------------------
// DOCX content
// ---------------------------------------------------------------------------
function buildDocx() {
  const contentTypes =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
    '</Types>';
  const rels =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
    '</Relationships>';

  const para = (text, heading) =>
    heading
      ? `<w:p><w:pPr><w:pStyle w:val="${heading}"/></w:pPr><w:r><w:t>${text}</w:t></w:r></w:p>`
      : `<w:p><w:r><w:t xml:space="preserve">${text}</w:t></w:r></w:p>`;

  const body =
    para('Alternate Me phase three knowledge ingestion sample document.') +
    para('Introduction', 'Heading1') +
    para('This paragraph describes how knowledge is ingested and embedded.') +
    para('Architecture Overview', 'Heading1') +
    para('The pipeline runs extract, clean, chunk and embed stages asynchronously.');

  const documentXml =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' +
    body +
    '</w:body></w:document>';

  return buildStoredZip([
    { name: '[Content_Types].xml', data: contentTypes },
    { name: '_rels/.rels', data: rels },
    { name: 'word/document.xml', data: documentXml },
  ]);
}

// ---------------------------------------------------------------------------
const pdf = buildPdf([
  'Phase Three Knowledge Ingestion Sample',
  'This PDF is generated by scripts/gen-fixtures.cjs',
  'It contains deterministic ASCII text used by pipeline tests.',
]);
const docx = buildDocx();

fs.writeFileSync(path.join(OUT_DIR, 'minimal.pdf'), pdf);
fs.writeFileSync(path.join(OUT_DIR, 'minimal.docx'), docx);
console.log(
  `Wrote fixtures/minimal.pdf (${pdf.length} bytes) and fixtures/minimal.docx (${docx.length} bytes)`,
);


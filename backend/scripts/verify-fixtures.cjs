// Verify Phase 3 fixtures parse. Run: node scripts/verify-fixtures.cjs
const fs = require('fs');
const path = require('path');

(async () => {
  const dir = path.resolve(__dirname, '../src/tests/fixtures');

  // PDF
  const { PDFParse } = require('pdf-parse');
  const pdf = fs.readFileSync(path.join(dir, 'sample.pdf'));
  const parser = new PDFParse({ data: new Uint8Array(pdf) });
  const textResult = await parser.getText({ pageJoiner: '\n\n' });
  console.log('PDF text:', JSON.stringify(textResult.text.slice(0, 80)));
  console.log('PDF pages:', textResult.pages.length);
  await parser.destroy();

  const blank = fs.readFileSync(path.join(dir, 'sample-blank.pdf'));
  const blankParser = new PDFParse({ data: new Uint8Array(blank) });
  const blankResult = await blankParser.getText();
  console.log('BLANK textLen(non-ws):', blankResult.text.replace(/\s/g, '').length);
  await blankParser.destroy();

  // DOCX
  const mammoth = require('mammoth');
  const docx = await mammoth.convertToHtml({
    buffer: fs.readFileSync(path.join(dir, 'sample.docx')),
  });
  console.log('DOCX html:', docx.value.slice(0, 140).replace(/\n/g, ' '));

  // TXT
  console.log('TXT first line:', fs.readFileSync(path.join(dir, 'sample.txt'), 'utf8').split('\n')[0]);

  // MD
  console.log('MD first line:', fs.readFileSync(path.join(dir, 'sample.md'), 'utf8').split('\n')[0]);

  console.log('FIXTURES OK');
})().catch((e) => {
  console.error('FIXTURE FAIL:', e.message);
  process.exit(1);
});

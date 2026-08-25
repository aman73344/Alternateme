const { PDFDocument, StandardFonts } = require('pdf-lib');

async function main() {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  let page = doc.addPage([400, 400]);
  page.drawText('Hello World PDF Text', { x: 50, y: 340, size: 16, font });
  page.drawText('Second paragraph line one.', { x: 50, y: 300, size: 12, font });
  const bytes = await doc.save();
  console.log('PDF_BYTES', bytes.length);

  const pdfParse = require('pdf-parse');
  console.log('TYPE', typeof pdfParse, Array.isArray(pdfParse) ? 'array' : pdfParse && typeof pdfParse === 'object' ? Object.keys(pdfParse) : '');
  console.log('PDFParseClass', typeof pdfParse.PDFParse, 'default', typeof pdfParse.default);

  // Try class API
  const mod = pdfParse.PDFParse ? pdfParse : require('pdf-parse');
  if (typeof mod.PDFParse === 'function') {
    const parser = new mod.PDFParse({ data: new Uint8Array(bytes), verbosity: 0 });
    const info = await parser.getText({ pageJoiner: '\n\n' });
    console.log('PAGES', info.pages.length);
    console.log('TEXT_SNIP', (info.text || '').slice(0, 80));
    await parser.destroy();
  } else if (typeof pdfParse === 'function') {
    console.log('FUNC_TEXTLEN', (await pdfParse(bytes)).text.length);
  }
}

main().catch((e) => { console.log('ERR', e.message); process.exit(1); });
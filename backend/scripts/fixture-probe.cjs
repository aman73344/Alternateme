// Probe: load the DOCX fixture with mammoth's own JSZip and list entries.
const JSZIP_PATH =
  'C:/Users/User/Alternate me/backend/node_modules/.pnpm/mammoth@1.12.1/node_modules/jszip';
const J = require(JSZIP_PATH);
const fs = require('fs');

(async () => {
  const buf = fs.readFileSync('src/tests/fixtures/sample.docx');
  const z = await J.loadAsync(buf);
  console.log('FILES:', Object.keys(z.files));
  const doc = z.file('word/document.xml');
  console.log('document.xml present:', !!doc);
  const rels = z.file('_rels/.rels');
  console.log('.rels present:', !!rels);
})().catch((e) => {
  console.error('ERR', e && e.message);
  process.exit(1);
});

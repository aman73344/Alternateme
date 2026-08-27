import fs from 'fs';

const b = fs.readFileSync('src/tests/fixtures/sample.docx');
// Locate EOCD
let i = b.length - 22;
while (i >= 0 && b.readUInt32LE(i) !== 0x06054b50) i -= 1;
const n = b.readUInt16LE(i + 10);
const cdOff = b.readUInt32LE(i + 16);
console.log('entries', n, 'cdOffset', cdOff);
let p = cdOff;
for (let k = 0; k < n; k += 1) {
  const sig = b.readUInt32LE(p);
  const nameLen = b.readUInt16LE(p + 28);
  const extraLen = b.readUInt16LE(p + 30);
  const cmtLen = b.readUInt16LE(p + 32);
  const lho = b.readUInt32LE(p + 40);
  const csize = b.readUInt32LE(p + 20);
  const name = b.slice(p + 46, p + 46 + nameLen).toString();
  const lhSig = b.readUInt32LE(lho);
  const lhNameLen = b.readUInt16LE(lho + 26);
  const lhExtraLen = b.readUInt16LE(lho + 28);
  const dataStart = lho + 30 + lhNameLen + lhExtraLen;
  console.log(
    `#${k} ${name} cdSig=0x${sig.toString(16)} lho=${lho} lhSig=0x${lhSig.toString(16)} csize=${csize} dataStart=${dataStart}`,
  );
  p += 46 + nameLen + extraLen + cmtLen;
}

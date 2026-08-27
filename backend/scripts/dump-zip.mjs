// Dump the central directory of a ZIP to verify structure.
import fs from 'fs';

const file = process.argv[2];
if (!file) {
  console.error('usage: node scripts/dump-zip.mjs <zipfile>');
  process.exit(1);
}
const b = fs.readFileSync(file);
let i = b.length - 22;
while (i >= 0 && b.readUInt32LE(i) !== 0x06054b50) i--;
const n = b.readUInt16LE(i + 10);
const cdOff = b.readUInt32LE(i + 16);
console.log(`EOCD: entries=${n} cdOffset=${cdOff} fileSize=${b.length}`);
let p = cdOff;
for (let k = 0; k < n; k++) {
  const sig = b.readUInt32LE(p);
  const method = b.readUInt16LE(p + 10);
  const cs = b.readUInt32LE(p + 20);
  const us = b.readUInt32LE(p + 24);
  const nameLen = b.readUInt16LE(p + 28);
  const extraLen = b.readUInt16LE(p + 30);
  const cmtLen = b.readUInt16LE(p + 32);
  const lho = b.readUInt32LE(p + 40);
  const name = b.slice(p + 46, p + 46 + nameLen).toString();
  console.log(
    `entry ${k}: ${name} method=${method} csize=${cs} usize=${us} localHeaderOffset=${lho}`,
  );
  // show first bytes of the local payload
  const lhNameLen = b.readUInt16LE(lho + 26);
  const lhExtraLen = b.readUInt16LE(lho + 28);
  const dataStart = lho + 30 + lhNameLen + lhExtraLen;
  console.log(`   local: sig=0x${b.readUInt32LE(lho).toString(16)} dataStart=${dataStart} payloadHead=[${Array.from(b.slice(dataStart, Math.min(dataStart + 24, dataStart + cs))).join(',')}]`);
  p += 46 + nameLen + extraLen + cmtLen;
}

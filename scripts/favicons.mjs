/**
 * Renders public/favicon.svg to favicon.ico (32×32 PNG-in-ICO) and apple-touch-icon.png (180×180).
 * Run: node scripts/favicons.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const publicDir = path.join(root, 'public');
const svgPath = path.join(publicDir, 'favicon.svg');

function renderPng(svg, width) {
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: width },
    background: '#070707',
  });
  return resvg.render().asPng();
}

/** Single PNG image inside a Vista-style .ico (no extra BMP header). */
function pngToIco(png) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);

  const entry = Buffer.alloc(16);
  entry.writeUInt8(32, 0);
  entry.writeUInt8(32, 1);
  entry.writeUInt8(0, 2);
  entry.writeUInt8(0, 3);
  entry.writeUInt16LE(0, 4);
  entry.writeUInt16LE(0, 6);
  entry.writeUInt32LE(png.length, 8);
  entry.writeUInt32LE(22, 12);

  return Buffer.concat([header, entry, png]);
}

const svg = fs.readFileSync(svgPath, 'utf8');
const png32 = renderPng(svg, 32);
const png180 = renderPng(svg, 180);

fs.writeFileSync(path.join(publicDir, 'favicon.ico'), pngToIco(png32));
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), png180);

console.log('Wrote public/favicon.ico, public/apple-touch-icon.png');

/**
 * Pikentää etusivun hero-kuva: sama kuva `public/images/hero.webp` + pienempi `hero.jpg`.
 *
 *   npm run optimize:hero
 */

import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const MAX_WIDTH = 2048;

function formatKb(bytes: number) {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

async function main() {
  const outDir = path.join(process.cwd(), 'public/images');
  const jpegPath = path.join(outDir, 'hero.jpg');
  const webpPath = path.join(outDir, 'hero.webp');
  const jpegTmpPath = path.join(outDir, '.hero.jpg.tmp');

  if (!fs.existsSync(jpegPath)) {
    console.error('Puuttuu: public/images/hero.jpg');
    process.exit(1);
  }

  const inputStat = fs.statSync(jpegPath);
  console.log(`Lähde (hero.jpg): ${formatKb(inputStat.size)}`);

  const incoming = await sharp(jpegPath).rotate().metadata();
  const iw = incoming.width ?? MAX_WIDTH;
  const ih = incoming.height ?? MAX_WIDTH;
  const scale = iw > MAX_WIDTH ? MAX_WIDTH / iw : 1;
  const outW = Math.round(iw * scale);
  const outH = Math.round(ih * scale);

  const pixelBuf = await sharp(jpegPath)
    .rotate()
    .resize({
      width: outW,
      height: outH,
      fit: 'fill',
    })
    .toBuffer();

  await sharp(pixelBuf)
    .webp({ quality: 82, effort: 6, smartSubsample: true })
    .toFile(webpPath);

  await sharp(pixelBuf)
    .jpeg({
      quality: 82,
      mozjpeg: true,
      progressive: true,
      chromaSubsampling: '4:2:0',
    })
    .toFile(jpegTmpPath);

  fs.renameSync(jpegTmpPath, jpegPath);

  const jSz = fs.statSync(jpegPath).size;
  const wSz = fs.statSync(webpPath).size;
  console.log(`Tulos ${outW}×${outH} px`);
  console.log(`  hero.webp  ${formatKb(wSz)}`);
  console.log(`  hero.jpg   ${formatKb(jSz)}`);
  console.log(`Säästö vs. alkuperäinen lähde: ${((1 - jSz / inputStat.size) * 100).toFixed(0)} % (JPEG), WebP lisäksi nopeampi lataus.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

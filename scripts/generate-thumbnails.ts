/**
 * Generoi jaksokuvat paikallisesti ilman täyttä Astro-buildia (sama renderöinti kuin sivulla).
 *
 *   npm run thumbs -- --slug=raakaa-0-esittely
 *   npm run thumbs -- --all
 *   npm run thumbs -- --slug=... --formats=og,square --out=./export
 *
 * Oletusulostulo: ./local-thumbnails/  (gitignore)
 */

import fs from 'node:fs';
import path from 'node:path';
import {
  getEpisodeArtMime,
  renderEpisodeArt,
  type EpisodeArtFormat,
} from '../src/lib/ogImage';
import { getEpisodesFromRSS, type Episode } from '../src/lib/rss';

const FORMATS: EpisodeArtFormat[] = ['square', 'youtube', 'og'];
const SUFFIX: Record<EpisodeArtFormat, string> = {
  square: 'square-3000.jpg',
  youtube: 'youtube-1920x1080.png',
  og: 'og-1200x630.png',
};

function parseArgs(argv: string[]) {
  let slug = '';
  let all = false;
  let outDir = path.join(process.cwd(), 'local-thumbnails');
  let formats: EpisodeArtFormat[] = [...FORMATS];
  for (const a of argv) {
    if (a === '--all') all = true;
    else if (a.startsWith('--slug=')) slug = a.slice(7).trim();
    else if (a.startsWith('--out=')) outDir = path.resolve(a.slice(6).trim());
    else if (a.startsWith('--formats=')) {
      const parts = a
        .slice(10)
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
      const next: EpisodeArtFormat[] = [];
      for (const p of parts) {
        if (p === 'og' || p === 'youtube' || p === 'square') next.push(p);
        else {
          console.error(`Tuntematon formaatti: ${p} (sallittu: og, youtube, square)`);
          process.exit(1);
        }
      }
      if (next.length) formats = next;
    } else if (a === '--help' || a === '-h') {
      printHelp();
      process.exit(0);
    }
  }
  return { slug, all, outDir, formats };
}

function printHelp() {
  console.log(`
Raakaa — paikallinen jaksokuvageneraattori

Käyttö:
  npm run thumbs -- --slug=<rss-slug>
  npm run thumbs -- --all
  npm run thumbs -- --slug=... --formats=og,square,youtube --out=./polku

Valinnat:
  --slug=    Yhden jakson slug (RSS-otsikosta johdettu)
  --all      Kaikki RSS:ssä olevat jaksot
  --out=     Tulostuskansio (oletus: ./local-thumbnails)
  --formats= pilkulla eroteltu: og, youtube, square (oletus: kaikki)
`);
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.length === 0) {
    printHelp();
    process.exit(1);
  }

  const { slug, all, outDir, formats } = parseArgs(argv);
  if (!all && !slug) {
    console.error('Anna --slug=... tai --all');
    printHelp();
    process.exit(1);
  }

  const raw = process.env.RSS_FEED_URL || process.env.PUBLIC_RSS_FEED_URL;
  const feedUrl = raw?.trim() || undefined;
  const episodes = await getEpisodesFromRSS(feedUrl);
  if (episodes.length === 0) {
    console.error('Ei jaksoja RSS:stä.');
    process.exit(1);
  }

  let targets: Episode[];
  if (all) targets = episodes;
  else {
    const ep = episodes.find((e) => e.slug === slug);
    if (!ep) {
      console.error(`Slugia "${slug}" ei löydy RSS:stä. Kokeile: npm run rss:list`);
      process.exit(1);
    }
    targets = [ep];
  }

  fs.mkdirSync(outDir, { recursive: true });

  for (const ep of targets) {
    for (const fmt of formats) {
      const buf = await renderEpisodeArt(ep, fmt);
      const name = `${ep.slug}-${SUFFIX[fmt]}`;
      const dest = path.join(outDir, name);
      fs.writeFileSync(dest, buf);
      const kb = (buf.length / 1024).toFixed(1);
      console.log(`✓ ${dest}  (${kb} kiB, ${getEpisodeArtMime(fmt)})`);
    }
  }

  console.log(`\nValmis: ${targets.length} jakso(a), kansio ${outDir}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

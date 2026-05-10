/**
 * Tulosta RSS-jaksot taulukkona (slug, numero, otsikko) — copy-paste thumbs/Decap-apuun.
 *
 *   npm run rss:list
 */

import { getEpisodesFromRSS } from '../src/lib/rss';

const raw = process.env.RSS_FEED_URL || process.env.PUBLIC_RSS_FEED_URL;
const feedUrl = raw?.trim() || undefined;

async function main() {
  const episodes = await getEpisodesFromRSS(feedUrl);
  if (episodes.length === 0) {
    console.error('Ei jaksoja RSS:stä.');
    process.exit(1);
  }

  const w = Math.max(...episodes.map((e) => e.slug.length), 4);
  console.log(`${'slug'.padEnd(w)}  ep#  title`);
  console.log('-'.repeat(Math.min(w + 50, 100)));

  for (const e of episodes) {
    const num = e.episodeNumber != null ? String(e.episodeNumber) : '—';
    console.log(`${e.slug.padEnd(w)}  ${num.padStart(3)}  ${e.title}`);
  }

  console.log(`\nYhteensä ${episodes.length} jaksoa.`);
  console.log(
    'Paikalliset kuvat: npm run thumbs -- --slug=<slug>\n' +
      'Tuotanto-URLit (buildin jälkeen): https://www.raakaa.fi/admin/kuvat',
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

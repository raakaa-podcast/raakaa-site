/**
 * Yhdistä RSS + Decap-episodi yhteen yhteenvetoon (copy-paste / debug).
 *
 *   npm run episode:info -- --slug=raakaa-0-esittely
 */

import { getEpisodesFromRSS } from '../src/lib/rss';
import { getEpisodeRecord } from '../src/lib/episodeMeta';

function parseSlug(argv: string[]): string {
  for (const a of argv) {
    if (a.startsWith('--slug=')) return a.slice(7).trim();
  }
  return '';
}

async function main() {
  const slug = parseSlug(process.argv.slice(2));
  if (!slug) {
    console.error('Käyttö: npm run episode:info -- --slug=<rss-slug>');
    process.exit(1);
  }

  const raw = process.env.RSS_FEED_URL || process.env.PUBLIC_RSS_FEED_URL;
  const episodes = await getEpisodesFromRSS(raw?.trim() || undefined);
  const ep = episodes.find((e) => e.slug === slug);
  if (!ep) {
    console.error(`Slug "${slug}" ei löydy RSS:stä. npm run rss:list`);
    process.exit(1);
  }

  const rec = getEpisodeRecord(ep);
  const lines: string[] = [
    `slug:          ${ep.slug}`,
    `guid:          ${ep.guid}`,
    `rss title:     ${ep.title}`,
    `published:     ${ep.publishedAt}`,
    `audio:         ${ep.audioUrl}`,
    `cover (rss):   ${ep.imageUrl ?? '—'}`,
    `duration:      ${ep.duration ?? '—'}`,
    `episode #:     ${ep.episodeNumber ?? '—'}`,
    '',
  ];

  if (rec) {
    lines.push(
      `decap title:   ${rec.title ?? '—'}`,
      `summary:       ${(rec.summary ?? '').slice(0, 120)}${(rec.summary?.length ?? 0) > 120 ? '…' : ''}`,
      `topics:        ${(rec.topics ?? []).join(', ') || '—'}`,
      `guests:        ${(rec.guests ?? []).join(', ') || '—'}`,
      `youtubeUrl:    ${rec.youtubeUrl || '—'}`,
      `transcript:    ${rec.body?.trim() ? `${rec.body.length} merkkiä` : 'tyhjä'}`,
      `pdfUrl:        ${rec.pdfUrl || '—'}`,
    );
  } else {
    lines.push('decap:         (ei src/content/episodes/<slug>.md)');
  }

  console.log(lines.join('\n'));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

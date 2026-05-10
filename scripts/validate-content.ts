/**
 * Pre-publish checks: RSS ↔ episode files, guests, transcripts, YouTube embed URL, link HEAD probes.
 *
 * Run: npm run validate
 * Strict (exit 1 on warnings too): npm run validate -- --strict
 */

import fs from 'node:fs';
import path from 'node:path';
import { getEpisodesFromRSS } from '../src/lib/rss';
import {
  getAllEpisodeRecords,
  getEpisodeRecord,
  getGuestBySlug,
  type Guest,
} from '../src/lib/episodeMeta';

type Severity = 'error' | 'warn';

function log(sev: Severity, msg: string) {
  const p = sev === 'error' ? 'ERROR' : 'WARN ';
  console.log(`[${p}] ${msg}`);
}

function youtubeVideoIdFromUrl(url: string): string | null {
  const value = url.trim();
  if (!value) return null;
  try {
    const parsed = new URL(value);
    const host = parsed.hostname.toLowerCase();
    if (host === 'youtu.be') {
      const id = parsed.pathname.split('/').filter(Boolean)[0];
      return id || null;
    }
    if (host.includes('youtube.com')) {
      if (parsed.pathname === '/watch') return parsed.searchParams.get('v');
      if (parsed.pathname.startsWith('/embed/')) {
        return parsed.pathname.split('/').filter(Boolean)[1] ?? null;
      }
      if (parsed.pathname.startsWith('/shorts/')) {
        return parsed.pathname.split('/').filter(Boolean)[1] ?? null;
      }
    }
  } catch {
    return null;
  }
  return null;
}

async function checkUrl(url: string, label: string, timeoutMs = 12_000): Promise<boolean> {
  const fetchWithTimeout = (method: string) => {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    return fetch(url, {
      method,
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'user-agent': 'RAAKAA-site-validator/1.0' },
    }).finally(() => clearTimeout(t));
  };

  try {
    const res = await fetchWithTimeout('HEAD');
    if (res.status === 405 || res.status === 501) {
      const res2 = await fetchWithTimeout('GET');
      if (res2.status >= 400) {
        if (res2.status === 403 || res2.status === 401) return false;
        log('warn', `Link may be broken (${res2.status}): ${label} → ${url}`);
        return true;
      }
      return false;
    }
    if (res.status >= 400) {
      if (res.status === 403 || res.status === 401) return false;
      log('warn', `Link may be broken (${res.status}): ${label} → ${url}`);
      return true;
    }
  } catch {
    log('warn', `Link check failed (timeout or network): ${label} → ${url}`);
    return true;
  }
  return false;
}

function loadGuestsFromDisk(): Guest[] {
  const raw = fs.readFileSync(path.join(process.cwd(), 'src', 'data', 'guests.json'), 'utf8');
  const data = JSON.parse(raw) as Guest[] | { guests?: Guest[] };
  return Array.isArray(data) ? data : data.guests ?? [];
}

async function main() {
  const strict = process.argv.includes('--strict');
  let errors = 0;
  let warns = 0;
  const bump = (sev: Severity) => {
    if (sev === 'error') errors += 1;
    else warns += 1;
  };

  console.log('Fetching RSS…');
  const episodes = await getEpisodesFromRSS();
  if (episodes.length === 0) {
    log('error', 'No episodes from RSS feed (check network or PUBLIC_RSS_FEED_URL).');
    process.exit(1);
  }

  const rssBySlug = new Set(episodes.map((e) => e.slug));
  const guests = loadGuestsFromDisk();

  for (const ep of episodes) {
    const prefix = `Episode "${ep.slug}"`;
    const rec = getEpisodeRecord(ep);

    if (!rec) {
      log('error', `${prefix}: no matching src/content/episodes/*.md (slug or episodeGuid).`);
      bump('error');
      continue;
    }

    if (rec.episodeSlug && rec.episodeSlug !== ep.slug) {
      log('warn', `${prefix}: frontmatter episodeSlug "${rec.episodeSlug}" differs from RSS-derived slug "${ep.slug}".`);
      bump('warn');
    }

    for (const gSlug of rec.guests ?? []) {
      if (!getGuestBySlug(gSlug)) {
        log('error', `${prefix}: unknown guest slug "${gSlug}" (not in src/data/guests.json).`);
        bump('error');
      }
    }

    if (!rec.summary?.trim()) {
      log('warn', `${prefix}: missing summary (kortti ja kansikuvat käyttävät sitä).`);
      bump('warn');
    }

    const hasTranscript = Boolean(rec.body?.trim());
    const hasPdf = Boolean(rec.pdfUrl?.trim());
    if (!hasTranscript && !hasPdf) {
      log('warn', `${prefix}: no transcript body and no pdfUrl.`);
      bump('warn');
    }

    const yt = rec.youtubeUrl?.trim();
    if (yt) {
      const id = youtubeVideoIdFromUrl(yt);
      if (!id) {
        log(
          'error',
          `${prefix}: youtubeUrl is not an embeddable video URL (käytä watch?v=, youtu.be tai /embed/). Nykyinen: ${yt}`,
        );
        bump('error');
      }
    }

    const cover = rec.customCoverImage?.trim();
    if (cover && /^https?:\/\//i.test(cover)) {
      if (await checkUrl(cover, `${prefix} customCoverImage`)) bump('warn');
    }

    const pdf = rec.pdfUrl?.trim();
    if (pdf && /^https?:\/\//i.test(pdf)) {
      if (await checkUrl(pdf, `${prefix} pdfUrl`)) bump('warn');
    }
  }

  const records = getAllEpisodeRecords();
  for (const rec of records) {
    const slug = rec.episodeSlug;
    if (!slug) continue;
    if (!rssBySlug.has(slug)) {
      log('warn', `Episode file for slug "${slug}" not in current RSS (luonnos tai poistettu syötteestä?).`);
      bump('warn');
    }
  }

  for (const guest of guests) {
    const img = guest.image?.trim();
    if (img && img.startsWith('http')) {
      if (await checkUrl(img, `Guest ${guest.slug} image`)) bump('warn');
    }
    for (const link of guest.links ?? []) {
      const u = link.url?.trim();
      if (u && /^https?:\/\//i.test(u)) {
        if (await checkUrl(u, `Guest ${guest.slug} link "${link.label}"`)) bump('warn');
      }
    }
  }

  console.log('\n---');
  if (errors > 0) {
    console.log(`Done: ${errors} error(s), ${warns} warning(s).`);
    process.exit(1);
  }
  if (warns > 0 && strict) {
    console.log(`Done: 0 error(s), ${warns} warning(s) — strict mode exits with failure.`);
    process.exit(1);
  }
  console.log(`Done: 0 error(s), ${warns} warning(s).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

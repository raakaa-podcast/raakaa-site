/**
 * Vain kun RSS-syötteen sisältö muuttuu (SHA-256 koko XML:stä):
 *   1) Päivittää src/data/rss-feed-fingerprint.txt
 *   2) Luo stubit uusille GUIDeille (kuten aiemmin)
 *   3) Commit + push → Netlify rakentaa tavallisesti pushista
 *
 * Jos syöte on sama kuin tallennettu sormenjälki: ei tiedostomuutoksia, ei git pushia.
 *
 *   npm run rss-sync:dry     — näytä mitä tapahtuisi
 *   npm run rss-sync -- --force  — ohita sormenjälki (testi / korjaus)
 */

import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';
import matter from 'gray-matter';
import { DEFAULT_RSS_FEED_URL, parseEpisodesFromRssXml, type Episode } from '../src/lib/rss';

const EPISODES_DIR = path.join(process.cwd(), 'src', 'content', 'episodes');
const FINGERPRINT_FILE = path.join(process.cwd(), 'src', 'data', 'rss-feed-fingerprint.txt');

function resolveFeedUrl(): string {
  const raw = process.env.RSS_FEED_URL || process.env.PUBLIC_RSS_FEED_URL;
  const t = raw?.trim();
  return t || DEFAULT_RSS_FEED_URL;
}

function readStoredFingerprint(): string | null {
  try {
    const line = fs.readFileSync(FINGERPRINT_FILE, 'utf8').split('\n')[0]?.trim();
    return line || null;
  } catch {
    return null;
  }
}

function sha256Hex(body: string): string {
  return createHash('sha256').update(body, 'utf8').digest('hex');
}

function toIsoDateOnly(pubDate: string): string | undefined {
  if (!pubDate?.trim()) return undefined;
  const d = new Date(pubDate);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString().slice(0, 10);
}

type ExistingIndex = {
  guids: Set<string>;
  slugFiles: Map<string, string>;
};

function loadExisting(): ExistingIndex {
  const guids = new Set<string>();
  const slugFiles = new Map<string, string>();
  if (!fs.existsSync(EPISODES_DIR)) return { guids, slugFiles };

  for (const file of fs.readdirSync(EPISODES_DIR)) {
    if (!file.endsWith('.md')) continue;
    const full = path.join(EPISODES_DIR, file);
    const raw = fs.readFileSync(full, 'utf8');
    const { data } = matter(raw);
    const g = typeof data.episodeGuid === 'string' ? data.episodeGuid.trim() : '';
    if (g) guids.add(g);
    const slug =
      typeof data.episodeSlug === 'string' && data.episodeSlug.trim()
        ? data.episodeSlug.trim()
        : file.replace(/\.md$/i, '');
    slugFiles.set(slug, full);
  }
  return { guids, slugFiles };
}

function buildStubFrontmatter(ep: Episode): string {
  const pub = toIsoDateOnly(ep.publishedAt);
  const lines = [
    '---',
    `title: ${JSON.stringify(ep.title)}`,
    `episodeSlug: ${ep.slug}`,
    `episodeGuid: ${ep.guid}`,
    ...(pub ? [`publishDate: ${pub}`] : []),
    'excerpt: ""',
    'summary: ""',
    'youtubeUrl: ""',
    'customCoverImage: ""',
    'pdfUrl: ""',
    'topics: []',
    'guests: []',
    '---',
    '',
    '<!-- Täytä litterointi ja metat Decapissa tai tähän. Stub luotu automaattisesti RSS-GUIDin perusteella. -->',
    '',
  ];
  return lines.join('\n');
}

/** Palauttaa luotujen stub-tiedostojen absoluuttiset polut. */
function writeNewStubs(episodes: Episode[], dryRun: boolean): string[] {
  const { guids, slugFiles } = loadExisting();
  const created: string[] = [];

  for (const ep of episodes) {
    if (guids.has(ep.guid)) continue;

    if (slugFiles.has(ep.slug)) {
      console.warn(
        `[rss-sync] Skip "${ep.slug}": tiedosto on jo mutta episodeGuid ei täsmää tai puuttuu. GUID=${ep.guid}`,
      );
      continue;
    }

    const file = path.join(EPISODES_DIR, `${ep.slug}.md`);
    const body = buildStubFrontmatter(ep);
    if (dryRun) {
      console.log(`[dry-run] Uusi stub: ${path.relative(process.cwd(), file)}`);
      created.push(file);
      continue;
    }

    fs.mkdirSync(EPISODES_DIR, { recursive: true });
    fs.writeFileSync(file, body, 'utf8');
    console.log(`[rss-sync] Luotu ${path.relative(process.cwd(), file)}`);
    created.push(file);
    guids.add(ep.guid);
    slugFiles.set(ep.slug, file);
  }

  return created;
}

function runGit(args: string) {
  execSync(args, { stdio: 'inherit', cwd: process.cwd() });
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const force = process.argv.includes('--force') || process.env.FORCE_RSS_SYNC === '1';

  const feedUrl = resolveFeedUrl();
  console.log(`[rss-sync] Haetaan ${feedUrl}`);

  const res = await fetch(feedUrl);
  if (!res.ok) {
    console.error(`[rss-sync] RSS HTTP ${res.status}`);
    process.exit(1);
  }

  const xml = await res.text();
  const fp = sha256Hex(xml);
  const stored = readStoredFingerprint();

  if (!force && stored === fp) {
    console.log('[rss-sync] RSS ei muuttunut (sormenjälki sama). Ei commitia eikä pushia.');
    process.exit(0);
  }

  if (force) {
    console.log('[rss-sync] --force: sormenjälkivertailu ohitettu.');
  } else if (stored === null) {
    console.log('[rss-sync] Ensimmäinen ajo tai sormenjälki puuttuu — käsitellään syöte uutena.');
  } else {
    console.log('[rss-sync] RSS muuttui (uusi sormenjälki) → päivitetään repo ja push.');
  }

  const episodes = parseEpisodesFromRssXml(xml);
  if (episodes.length === 0) {
    console.error('[rss-sync] Ei jaksoja XML:stä');
    process.exit(1);
  }

  const fingerprintLine = `${fp}\n`;
  if (dryRun) {
    console.log(`[dry-run] Sormenjälki päivittyisi: ${fp.slice(0, 12)}…`);
    writeNewStubs(episodes, true);
    process.exit(0);
  }

  fs.mkdirSync(path.dirname(FINGERPRINT_FILE), { recursive: true });
  fs.writeFileSync(FINGERPRINT_FILE, fingerprintLine, 'utf8');

  const newStubPaths = writeNewStubs(episodes, false);

  if (process.env.CI === 'true') {
    runGit('git config user.name "github-actions[bot]"');
    runGit('git config user.email "github-actions[bot]@users.noreply.github.com"');
  }

  const branch =
    process.env.GITHUB_REF?.replace(/^refs\/heads\//, '') ||
    execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();

  runGit(`git add "${FINGERPRINT_FILE}"`);
  for (const file of newStubPaths) {
    runGit(`git add "${file}"`);
  }

  try {
    execSync('git diff --staged --quiet', { stdio: 'ignore', cwd: process.cwd() });
    console.log('[rss-sync] Ei staged-muutoksia (odottamaton).');
    process.exit(0);
  } catch {
    /* has changes */
  }

  runGit(`git commit -m "chore: RSS-syöte päivittyi (automaattinen synkronointi)"`);
  runGit(`git push origin HEAD:${branch}`);
  console.log('[rss-sync] Push valmis — Netlify käynnistää buildin, jos deploy on kytketty git-pushiin.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

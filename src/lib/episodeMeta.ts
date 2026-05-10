import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import guestsJson from '../data/guests.json';
import type { Episode } from './rss';

export type EpisodeMeta = {
  episodeSlug?: string;
  episodeGuid?: string;
  guests?: string[];
  topics?: string[];
  summary?: string;
  youtubeUrl?: string;
};

export type EpisodeRecord = EpisodeMeta & {
  title?: string;
  publishDate?: string;
  excerpt?: string;
  customCoverImage?: string;
  pdfUrl?: string;
  body: string;
};

export type GuestLink = { label: string; url: string };

export type Guest = {
  slug: string;
  name: string;
  role?: string;
  bio: string;
  image?: string;
  links?: GuestLink[];
};

const EPISODES_DIR = path.join(process.cwd(), 'src', 'content', 'episodes');

const recordsBySlug = new Map<string, EpisodeRecord>();
const recordsByGuid = new Map<string, EpisodeRecord>();

/**
 * Load all episode markdown files at module init. This is build-time only;
 * the cost is paid once and every subsequent `getEpisodeMeta(...)` call is
 * a plain Map lookup — keeping the public API synchronous so existing
 * callers (EpisodeCard, [slug].astro, ogImage.ts, etc.) don't need to be
 * refactored to async.
 */
function loadEpisodes(): void {
  let files: string[] = [];
  try {
    files = fs.readdirSync(EPISODES_DIR).filter((f) => f.endsWith('.md'));
  } catch {
    // Episodes folder may not exist on first run / clean builds.
    return;
  }

  for (const file of files) {
    try {
      const raw = fs.readFileSync(path.join(EPISODES_DIR, file), 'utf8');
      const { data, content } = matter(raw);
      const slugFromFile = file.replace(/\.md$/, '');
      const record: EpisodeRecord = {
        episodeSlug: (data.episodeSlug as string | undefined) ?? slugFromFile,
        episodeGuid: data.episodeGuid as string | undefined,
        guests: Array.isArray(data.guests) ? (data.guests as string[]) : [],
        topics: Array.isArray(data.topics) ? (data.topics as string[]) : [],
        summary: data.summary as string | undefined,
        youtubeUrl: data.youtubeUrl as string | undefined,
        title: data.title as string | undefined,
        publishDate: typeof data.publishDate === 'string'
          ? data.publishDate
          : data.publishDate instanceof Date
            ? data.publishDate.toISOString().slice(0, 10)
            : undefined,
        excerpt: data.excerpt as string | undefined,
        customCoverImage: data.customCoverImage as string | undefined,
        pdfUrl: data.pdfUrl as string | undefined,
        body: content.trim(),
      };
      if (record.episodeSlug) recordsBySlug.set(record.episodeSlug, record);
      if (record.episodeGuid) recordsByGuid.set(record.episodeGuid, record);
    } catch (err) {
      console.warn(`[episodeMeta] Failed to load ${file}:`, err);
    }
  }
}

loadEpisodes();

function findRecord(episode: Pick<Episode, 'slug' | 'guid'>): EpisodeRecord | null {
  return (
    recordsBySlug.get(episode.slug) ??
    (episode.guid ? recordsByGuid.get(episode.guid) ?? null : null)
  );
}

const guestsSource = guestsJson as Guest[] | { guests?: Guest[] };
const guests: Guest[] = Array.isArray(guestsSource)
  ? guestsSource
  : Array.isArray(guestsSource?.guests)
    ? guestsSource.guests
    : [];

export function getEpisodeMeta(episode: Pick<Episode, 'slug' | 'guid'>): EpisodeMeta {
  const rec = findRecord(episode);
  if (!rec) return {};
  return {
    episodeSlug: rec.episodeSlug,
    episodeGuid: rec.episodeGuid,
    guests: rec.guests,
    topics: rec.topics,
    summary: rec.summary,
    youtubeUrl: rec.youtubeUrl,
  };
}

/** Full record including transcript body + extra fields. Use when more than `EpisodeMeta` is needed. */
export function getEpisodeRecord(episode: Pick<Episode, 'slug' | 'guid'>): EpisodeRecord | null {
  return findRecord(episode);
}

export function getAllEpisodeRecords(): EpisodeRecord[] {
  return Array.from(recordsBySlug.values());
}

export function getGuestBySlug(slug: string): Guest | null {
  return guests.find((g) => g.slug === slug) ?? null;
}

export function getAllGuests(): Guest[] {
  return [...guests].sort((a, b) => a.name.localeCompare(b.name, 'fi'));
}

export function getEpisodesForGuest(guestSlug: string, episodes: Episode[]): Episode[] {
  return episodes.filter((episode) => {
    const m = getEpisodeMeta(episode);
    return (m.guests ?? []).includes(guestSlug);
  });
}

export function getAllTopics(): string[] {
  const set = new Set<string>();
  for (const rec of recordsBySlug.values()) {
    for (const t of rec.topics ?? []) set.add(t);
  }
  return [...set].sort((a, b) => a.localeCompare(b, 'fi'));
}

export function resolveGuestNames(slugs: string[]): { slug: string; name: string }[] {
  return slugs.map((slug) => {
    const g = getGuestBySlug(slug);
    return g ? { slug: g.slug, name: g.name } : { slug, name: slug };
  });
}

/**
 * Pick episodes related to `currentEpisode` for the "Lisää jaksoja" section.
 *
 * Strategy:
 * 1. Score every other episode by the number of topics it shares with the
 *    current episode and return the top matches (ties broken by recency).
 * 2. If there aren't enough topic-related candidates, fill the rest with the
 *    most recent remaining episodes.
 * 3. If the current episode has no topics at all, just return the most recent
 *    other episodes.
 */
export function getRelatedEpisodes(
  currentEpisode: Pick<Episode, 'slug' | 'guid' | 'publishedAt'>,
  allEpisodes: Episode[],
  count = 3,
): Episode[] {
  const others = allEpisodes.filter((ep) => ep.slug !== currentEpisode.slug);
  if (others.length === 0) return [];

  const byRecency = (a: Episode, b: Episode) =>
    new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();

  const currentTopics = new Set((getEpisodeMeta(currentEpisode).topics ?? []));

  if (currentTopics.size === 0) {
    return [...others].sort(byRecency).slice(0, count);
  }

  const scored = others
    .map((ep) => {
      const overlap = (getEpisodeMeta(ep).topics ?? []).filter((t) =>
        currentTopics.has(t),
      ).length;
      return { ep, overlap };
    })
    .filter((s) => s.overlap > 0)
    .sort((a, b) => {
      if (b.overlap !== a.overlap) return b.overlap - a.overlap;
      return byRecency(a.ep, b.ep);
    });

  const picked = scored.slice(0, count).map((s) => s.ep);
  if (picked.length >= count) return picked;

  const pickedSlugs = new Set(picked.map((e) => e.slug));
  const fillers = others
    .filter((e) => !pickedSlugs.has(e.slug))
    .sort(byRecency)
    .slice(0, count - picked.length);

  return [...picked, ...fillers];
}

/**
 * Normalize an RSS itunes:duration value into total seconds.
 * Accepts strings like "HH:MM:SS" / "MM:SS" / "1234", or already-numeric values
 * (fast-xml-parser may coerce purely numeric durations into numbers).
 */
function parseDurationToSeconds(raw: unknown): number {
  if (raw == null) return 0;
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return Math.max(0, Math.floor(raw));
  }
  const value = String(raw).trim();
  if (!value) return 0;
  if (value.includes(':')) {
    const parts = value.split(':').map((p) => Number.parseInt(p, 10));
    if (parts.some(Number.isNaN)) return 0;
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return parts[0] || 0;
  }
  const n = Number.parseInt(value, 10);
  return Number.isNaN(n) ? 0 : n;
}

/**
 * Format an RSS itunes:duration value as a Finnish human-readable string,
 * e.g. "1 t 23 min" / "45 min". Returns null when unknown.
 */
export function formatDuration(raw?: unknown): string | null {
  const totalSeconds = parseDurationToSeconds(raw);
  if (totalSeconds <= 0) return null;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.round((totalSeconds % 3600) / 60);
  if (hours > 0) {
    return minutes > 0 ? `${hours} t ${minutes} min` : `${hours} t`;
  }
  return `${Math.max(1, minutes)} min`;
}

/** ISO 8601 duration for schema.org (e.g. "PT1H23M"). */
export function durationToISO(raw?: unknown): string | null {
  const totalSeconds = parseDurationToSeconds(raw);
  if (totalSeconds <= 0) return null;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  let iso = 'PT';
  if (hours > 0) iso += `${hours}H`;
  if (minutes > 0) iso += `${minutes}M`;
  if (seconds > 0 && hours === 0) iso += `${seconds}S`;
  return iso === 'PT' ? null : iso;
}

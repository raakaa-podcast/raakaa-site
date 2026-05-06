import episodeMetaJson from '../data/episode-meta.json';
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

export type GuestLink = { label: string; url: string };

export type Guest = {
  slug: string;
  name: string;
  role?: string;
  bio: string;
  image?: string;
  links?: GuestLink[];
};

const metaSource = episodeMetaJson as EpisodeMeta[] | { episodes?: EpisodeMeta[] };
const guestsSource = guestsJson as Guest[] | { guests?: Guest[] };
const meta: EpisodeMeta[] = Array.isArray(metaSource) ? metaSource : Array.isArray(metaSource?.episodes) ? metaSource.episodes : [];
const guests: Guest[] = Array.isArray(guestsSource) ? guestsSource : Array.isArray(guestsSource?.guests) ? guestsSource.guests : [];

export function getEpisodeMeta(episode: Pick<Episode, 'slug' | 'guid'>): EpisodeMeta {
  return (
    meta.find(
      (m) =>
        (m.episodeSlug && m.episodeSlug === episode.slug) ||
        (m.episodeGuid && m.episodeGuid === episode.guid),
    ) ?? {}
  );
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
  for (const m of meta) {
    for (const t of m.topics ?? []) set.add(t);
  }
  return [...set].sort((a, b) => a.localeCompare(b, 'fi'));
}

export function resolveGuestNames(slugs: string[]): { slug: string; name: string }[] {
  return slugs
    .map((slug) => {
      const g = getGuestBySlug(slug);
      return g ? { slug: g.slug, name: g.name } : { slug, name: slug };
    });
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

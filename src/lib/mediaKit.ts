import { getEpisodeMeta } from './episodeMeta';
import { getEpisodesFromRSS, type Episode } from './rss';

type ExternalNumber = number | null;

export type PlatformSnapshot = {
  spotifyFollowers: ExternalNumber;
  spotifyMonthlyListeners: ExternalNumber;
  youtubeSubscribers: ExternalNumber;
  youtubeViews: ExternalNumber;
  appleRating: ExternalNumber;
  appleRatingsCount: ExternalNumber;
};

export type MediaKitSnapshot = {
  generatedAt: string;
  totalEpisodes: number;
  totalRuntimeMinutes: number;
  avgEpisodeMinutes: number;
  uniqueGuests: number;
  uniqueTopics: number;
  episodesWithYoutube: number;
  releasesLast30Days: number;
  firstEpisodeDate: string | null;
  latestEpisodeDate: string | null;
  platform: PlatformSnapshot;
};

function parseDurationToMinutes(value?: string | number): number {
  if (!value) return 0;
  const trimmed = String(value).trim();
  if (!trimmed) return 0;

  if (/^\d+$/.test(trimmed)) {
    const seconds = Number.parseInt(trimmed, 10);
    return Number.isFinite(seconds) ? Math.round(seconds / 60) : 0;
  }

  const parts = trimmed.split(':').map((p) => Number.parseInt(p, 10));
  if (parts.some((p) => Number.isNaN(p))) return 0;
  if (parts.length === 2) {
    const [mm, ss] = parts;
    return Math.round((mm * 60 + ss) / 60);
  }
  if (parts.length === 3) {
    const [hh, mm, ss] = parts;
    return Math.round((hh * 3600 + mm * 60 + ss) / 60);
  }
  return 0;
}

function parseDateMs(value: string): number | null {
  const ms = new Date(value).getTime();
  return Number.isNaN(ms) ? null : ms;
}

function parseEnvNumber(name: string): number | null {
  const raw = envValue(name);
  const n = coerceNumber(raw);
  return n === undefined ? null : n;
}

function envValue(name: string): string | undefined {
  const astroEnv = import.meta.env as Record<string, unknown> | undefined;
  const fromAstro = astroEnv?.[name];
  if (typeof fromAstro === 'string') return fromAstro;
  const fromProcess = process.env[name];
  return typeof fromProcess === 'string' ? fromProcess : undefined;
}

type ExternalMetricsPayload = Partial<{
  spotifyFollowers: number;
  spotifyMonthlyListeners: number;
  youtubeSubscribers: number;
  youtubeViews: number;
  appleRating: number;
  appleRatingsCount: number;
}>;

const PLATFORM_KEYS = [
  'spotifyFollowers',
  'spotifyMonthlyListeners',
  'youtubeSubscribers',
  'youtubeViews',
  'appleRating',
  'appleRatingsCount',
] as const satisfies readonly (keyof ExternalMetricsPayload)[];

function coerceNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const cleaned = value.trim().replace(/\s/g, '').replace(',', '.');
    if (!cleaned) return undefined;
    const n = Number.parseFloat(cleaned);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

/** Accepts flat JSON, `{ "platform": { ... } }`, or numeric strings from hand-written JSON. */
function extractPlatformMetrics(raw: unknown): ExternalMetricsPayload {
  const root = asRecord(raw);
  if (!root) return {};

  const nested = asRecord(root.platform);
  const out: ExternalMetricsPayload = {};

  for (const key of PLATFORM_KEYS) {
    const v = root[key] ?? nested?.[key];
    const n = coerceNumber(v);
    if (n !== undefined) out[key] = n;
  }
  return out;
}

async function loadExternalMetrics(): Promise<ExternalMetricsPayload> {
  const url = envValue('MEDIAKIT_METRICS_URL');
  if (typeof url !== 'string' || !url.trim()) return {};
  const token = envValue('MEDIAKIT_METRICS_TOKEN');

  try {
    const headers: Record<string, string> = { accept: 'application/json' };
    if (token?.trim()) headers.authorization = `Bearer ${token.trim()}`;
    const res = await fetch(url.trim(), { headers });
    if (!res.ok) {
      console.warn(`[media-kit] MEDIAKIT_METRICS_URL returned ${res.status}`);
      return {};
    }
    const raw: unknown = await res.json();
    return extractPlatformMetrics(raw);
  } catch (err) {
    console.warn('[media-kit] External metrics fetch failed:', err);
    return {};
  }
}

function computeEpisodeStats(episodes: Episode[]) {
  const now = Date.now();
  const days30 = 30 * 24 * 60 * 60 * 1000;

  const guests = new Set<string>();
  const topics = new Set<string>();

  let totalRuntimeMinutes = 0;
  let releasesLast30Days = 0;
  let episodesWithYoutube = 0;

  let oldestMs: number | null = null;
  let newestMs: number | null = null;

  for (const ep of episodes) {
    totalRuntimeMinutes += parseDurationToMinutes(ep.duration);

    const dateMs = parseDateMs(ep.publishedAt);
    if (dateMs !== null) {
      if (now - dateMs <= days30) releasesLast30Days += 1;
      if (oldestMs === null || dateMs < oldestMs) oldestMs = dateMs;
      if (newestMs === null || dateMs > newestMs) newestMs = dateMs;
    }

    const meta = getEpisodeMeta(ep);
    for (const guest of meta.guests ?? []) guests.add(guest);
    for (const topic of meta.topics ?? []) topics.add(topic.trim().replace(/^#+/u, '').toLowerCase());
    if (meta.youtubeUrl?.trim()) episodesWithYoutube += 1;
  }

  const totalEpisodes = episodes.length;
  const avgEpisodeMinutes =
    totalEpisodes > 0 ? Math.round((totalRuntimeMinutes / totalEpisodes) * 10) / 10 : 0;

  return {
    totalEpisodes,
    totalRuntimeMinutes,
    avgEpisodeMinutes,
    uniqueGuests: guests.size,
    uniqueTopics: topics.size,
    episodesWithYoutube,
    releasesLast30Days,
    firstEpisodeDate: oldestMs ? new Date(oldestMs).toISOString() : null,
    latestEpisodeDate: newestMs ? new Date(newestMs).toISOString() : null,
  };
}

function mergePlatform(
  fromUrl: ExternalMetricsPayload,
): PlatformSnapshot {
  return {
    spotifyFollowers:
      fromUrl.spotifyFollowers ?? parseEnvNumber('MEDIAKIT_SPOTIFY_FOLLOWERS') ?? 0,
    spotifyMonthlyListeners:
      fromUrl.spotifyMonthlyListeners ??
      parseEnvNumber('MEDIAKIT_SPOTIFY_MONTHLY_LISTENERS') ??
      0,
    youtubeSubscribers:
      fromUrl.youtubeSubscribers ?? parseEnvNumber('MEDIAKIT_YOUTUBE_SUBSCRIBERS') ?? 0,
    youtubeViews: fromUrl.youtubeViews ?? parseEnvNumber('MEDIAKIT_YOUTUBE_VIEWS') ?? 0,
    appleRating: fromUrl.appleRating ?? parseEnvNumber('MEDIAKIT_APPLE_RATING') ?? 0,
    appleRatingsCount:
      fromUrl.appleRatingsCount ?? parseEnvNumber('MEDIAKIT_APPLE_RATINGS_COUNT') ?? 0,
  };
}

export async function getMediaKitSnapshot(): Promise<MediaKitSnapshot> {
  const episodes = await getEpisodesFromRSS();
  const computed = computeEpisodeStats(episodes);
  const fromUrl = await loadExternalMetrics();

  return {
    generatedAt: new Date().toISOString(),
    ...computed,
    platform: mergePlatform(fromUrl),
  };
}

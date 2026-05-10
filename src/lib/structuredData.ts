import { durationToISO, resolveGuestNames, type EpisodeMeta } from './episodeMeta';
import type { Episode } from './rss';

/**
 * Centralized JSON-LD builders for the RAAKAA site.
 *
 * The Person (Markus) and PodcastSeries nodes are exposed via stable @ids
 * so that other nodes (PodcastEpisode, etc.) can reference them without
 * duplicating fields, and so that crawlers merge repeated declarations
 * into a single canonical entity per page.
 */

export const SITE_URL = 'https://www.raakaa.fi';
export const RSS_FEED_URL = 'https://media.rss.com/raakaapodcast/feed.xml';

export const PERSON_ID = `${SITE_URL}/#markus`;
export const SERIES_ID = `${SITE_URL}/#podcast`;

const SITE_IMAGE = `${SITE_URL}/images/raakaa-logo.png`;
const MARKUS_IMAGE = `${SITE_URL}/images/markus-suominen.jpg`;

const SERIES_DESCRIPTION =
  'Sitoutumaton, rehellinen ja kiehtova suomalainen keskusteluohjelma, jossa käsitellään yhteiskuntaa, ihmismieltä ja ajankohtaisia aiheita pitkillä keskusteluilla.';

const MARKUS_DESCRIPTION =
  'Markus Suominen on RAAKAA Podcastin juontaja, ensihoitaja ja monitoimimies. Yli 40 maata, PADI Rescue Diver, enduro ja muutama laskuvarjohyppy myöhemmin uskoo, että uteliaisuus vie pidemmälle kuin asiantuntijuus.';

const SERIES_SAME_AS = [
  'https://www.youtube.com/@RaakaaPodcast',
  'https://open.spotify.com/show/5nPxykti9rWnsb4MpAgLkY',
  'https://podcasts.apple.com/fi/podcast/raakaa/id1896272431',
  'https://rss.com/podcasts/raakaapodcast/',
  'https://www.instagram.com/raakaapodcast',
  'https://x.com/raakaapodcast',
];

const MARKUS_SAME_AS = [
  'https://www.instagram.com/raakaapodcast',
  'https://www.youtube.com/@RaakaaPodcast',
  'https://x.com/raakaapodcast',
];

export type JsonLd = Record<string, unknown>;

/** Person schema for Markus Suominen, the host. */
export function getMarkusPersonSchema(): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    '@id': PERSON_ID,
    name: 'Markus Suominen',
    jobTitle: 'Podcast-juontaja',
    url: `${SITE_URL}/markus`,
    image: MARKUS_IMAGE,
    description: MARKUS_DESCRIPTION,
    worksFor: {
      '@type': 'Organization',
      name: 'RAAKAA Podcast',
      url: SITE_URL,
    },
    sameAs: MARKUS_SAME_AS,
  };
}

/** PodcastSeries schema for the main RAAKAA show. */
export function getPodcastSeriesSchema(): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'PodcastSeries',
    '@id': SERIES_ID,
    name: 'RAAKAA Podcast',
    description: SERIES_DESCRIPTION,
    url: SITE_URL,
    inLanguage: 'fi',
    image: SITE_IMAGE,
    webFeed: RSS_FEED_URL,
    author: { '@id': PERSON_ID },
    publisher: { '@id': PERSON_ID },
    sameAs: SERIES_SAME_AS,
  };
}

/**
 * Try to derive an episode number from RSS data or the title.
 * RSS feeds expose `<itunes:episode>` for sequential episodes, but the
 * RAAKAA feed currently encodes the number in the title (e.g. "RAAKAA #0 - Esittely").
 */
function resolveEpisodeNumber(episode: Episode): number | undefined {
  if (typeof episode.episodeNumber === 'number' && Number.isFinite(episode.episodeNumber)) {
    return episode.episodeNumber;
  }
  const match = episode.title.match(/#\s*(\d+)/);
  if (match) {
    const n = Number.parseInt(match[1], 10);
    if (!Number.isNaN(n)) return n;
  }
  return undefined;
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Normalize an RFC 2822 / arbitrary date string to ISO 8601 for schema.org. */
function toIsoDate(raw: string): string | undefined {
  if (!raw) return undefined;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
}

/**
 * PodcastEpisode schema for a single episode page. References the
 * canonical PodcastSeries and Person nodes by @id rather than inlining them.
 */
export function getPodcastEpisodeSchema(
  episode: Episode,
  meta: EpisodeMeta = {},
): JsonLd {
  const url = `${SITE_URL}/jaksot/${episode.slug}`;
  const description = stripHtml(episode.description).slice(0, 500);
  const isoDuration = durationToISO(episode.duration);
  const episodeNumber = resolveEpisodeNumber(episode);
  const guests = resolveGuestNames(meta.guests ?? []);
  const topics = meta.topics ?? [];

  const audio: JsonLd = {
    '@type': 'AudioObject',
    contentUrl: episode.audioUrl,
    encodingFormat: 'audio/mpeg',
  };
  if (isoDuration) audio.duration = isoDuration;

  const schema: JsonLd = {
    '@context': 'https://schema.org',
    '@type': 'PodcastEpisode',
    name: episode.title,
    url,
    inLanguage: 'fi',
    description,
    associatedMedia: audio,
    partOfSeries: { '@id': SERIES_ID },
    author: { '@id': PERSON_ID },
  };

  const datePublished = toIsoDate(episode.publishedAt);
  if (datePublished) schema.datePublished = datePublished;
  if (typeof episodeNumber === 'number') schema.episodeNumber = episodeNumber;
  if (episode.imageUrl) schema.image = episode.imageUrl;
  if (isoDuration) schema.timeRequired = isoDuration;
  if (topics.length > 0) schema.keywords = topics.join(', ');
  if (guests.length > 0) {
    schema.actor = guests.map((g) => ({
      '@type': 'Person',
      name: g.name,
      url: `${SITE_URL}/vieraat/${g.slug}`,
    }));
  }

  return schema;
}

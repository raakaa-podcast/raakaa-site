import { XMLParser } from 'fast-xml-parser';

export type Episode = {
  guid: string;
  slug: string;
  title: string;
  description: string;
  publishedAt: string;
  audioUrl: string;
  link?: string;
  duration?: string;
  imageUrl?: string;
  episodeNumber?: number;
};

type RssItem = {
  guid?: string | { '#text'?: string };
  title?: string;
  description?: string;
  link?: string;
  pubDate?: string;
  enclosure?: { '@_url'?: string; '@_type'?: string };
  'itunes:duration'?: string;
  'itunes:image'?: { '@_href'?: string };
  'itunes:episode'?: string | number;
};

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  trimValues: true,
});
export const DEFAULT_RSS_FEED_URL = 'https://media.rss.com/raakaapodcast/feed.xml';

function createSlug(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 96);
}

function toText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && '#text' in (value as Record<string, unknown>)) {
    const text = (value as Record<string, unknown>)['#text'];
    return typeof text === 'string' ? text : '';
  }
  return '';
}

export async function getEpisodesFromRSS(feedUrl?: string): Promise<Episode[]> {
  const url = feedUrl ?? import.meta.env?.PUBLIC_RSS_FEED_URL ?? DEFAULT_RSS_FEED_URL;

  if (!url) {
    return [];
  }

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`RSS fetch failed: ${response.status}`);
    }

    const xml = await response.text();
    return parseEpisodesFromRssXml(xml);
  } catch (error) {
    console.error('RSS parsing error:', error);
    return [];
  }
}

/** Parse already-fetched RSS XML (same rules as the live fetch). */
export function parseEpisodesFromRssXml(xml: string): Episode[] {
  try {
    const parsed = parser.parse(xml) as {
      rss?: { channel?: { item?: RssItem | RssItem[]; image?: { url?: string } } };
    };

    const channel = parsed.rss?.channel;
    if (!channel?.item) {
      return [];
    }

    const feedImage = channel.image?.url;
    const items = Array.isArray(channel.item) ? channel.item : [channel.item];

    return items
      .map((item): Episode | null => {
        const title = item.title?.trim() ?? '';
        const guid = toText(item.guid).trim() || title;
        const slug = createSlug(title || guid || 'jakso');
        const audioUrl = item.enclosure?.['@_url']?.trim() ?? '';

        if (!title || !audioUrl) {
          return null;
        }

        const rawEpisodeNumber = item['itunes:episode'];
        let episodeNumber: number | undefined;
        if (typeof rawEpisodeNumber === 'number' && Number.isFinite(rawEpisodeNumber)) {
          episodeNumber = rawEpisodeNumber;
        } else if (typeof rawEpisodeNumber === 'string' && rawEpisodeNumber.trim()) {
          const parsedEp = Number.parseInt(rawEpisodeNumber, 10);
          if (!Number.isNaN(parsedEp)) episodeNumber = parsedEp;
        }

        return {
          guid,
          slug,
          title,
          description: (item.description ?? '').trim(),
          link: item.link?.trim(),
          publishedAt: item.pubDate ?? '',
          audioUrl,
          duration: item['itunes:duration'],
          imageUrl: item['itunes:image']?.['@_href'] ?? feedImage,
          episodeNumber,
        };
      })
      .filter((item): item is Episode => item !== null);
  } catch (error) {
    console.error('RSS XML parse error:', error);
    return [];
  }
}

export function formatFinnishDate(dateString: string): string {
  if (!dateString) return 'Päivämäärä puuttuu';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return 'Päivämäärä puuttuu';
  return new Intl.DateTimeFormat('fi-FI', {
    dateStyle: 'long',
  }).format(date);
}

export function getRssEmbedUrl(link?: string): string | null {
  if (!link) return null;

  const match = link.match(/rss\.com\/podcasts\/([^/]+)\/([^/]+)\/*$/i);
  if (!match) return null;

  const [, showSlug, episodeSlug] = match;
  return `https://player.rss.com/${showSlug}/${episodeSlug}?theme=dark`;
}

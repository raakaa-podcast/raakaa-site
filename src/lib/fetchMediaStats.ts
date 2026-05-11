/**
 * src/lib/fetchMediaStats.ts
 *
 * Ajetaan Astro-buildin AIKANA (ei selaimessa).
 * Hakee tilastot YouTubesta ja Apple Podcastsista,
 * parsii RSS-feedin jaksoluvun ja yhdistää manuaalisiin tietoihin.
 */

// ---------------------------------------------------------------------------
// Tyypit
// ---------------------------------------------------------------------------

export interface YouTubeStats {
  subscribers: number;
  totalViews: number;
  videoCount: number;
}

export interface AppleStats {
  episodeCount: number;
  rating: number | null;       // esim. 4.8
  ratingCount: number | null;  // arvostelujen lukumäärä
}

export interface ManualStats {
  spotifyFollowers: number | null;
  instagramFollowers: number | null;
  twitterFollowers: number | null;
  totalDownloads: number | null;   // RSS.com-dashboardilta käsin
  updatedAt: string;               // "2026-05-01" – milloin manuaaliset luvut päivitetty
}

export interface MediaStats {
  youtube: YouTubeStats | null;
  apple: AppleStats | null;
  rssEpisodeCount: number | null;
  manual: ManualStats;
  builtAt: string;  // ISO-timestamp buildista
}

// ---------------------------------------------------------------------------
// 1) YouTube Data API v3
//    Env-muuttuja: YOUTUBE_API_KEY  (aseta Netlifyyn, älä commitoi)
//    Channel ID:   UC...            (aseta YOUTUBE_CHANNEL_ID)
// ---------------------------------------------------------------------------

async function fetchYouTubeStats(): Promise<YouTubeStats | null> {
  const apiKey = import.meta.env.YOUTUBE_API_KEY;
  const channelId = import.meta.env.YOUTUBE_CHANNEL_ID;

  if (!apiKey || !channelId) {
    console.warn("[media] YOUTUBE_API_KEY tai YOUTUBE_CHANNEL_ID puuttuu – ohitetaan.");
    return null;
  }

  try {
    const url =
      `https://www.googleapis.com/youtube/v3/channels` +
      `?part=statistics&id=${channelId}&key=${apiKey}`;

    const res = await fetch(url);
    if (!res.ok) {
      console.error(`[media] YouTube API virhe: ${res.status} ${res.statusText}`);
      return null;
    }

    const data = await res.json();
    const stats = data?.items?.[0]?.statistics;
    if (!stats) return null;

    return {
      subscribers: parseInt(stats.subscriberCount ?? "0", 10),
      totalViews:  parseInt(stats.viewCount ?? "0", 10),
      videoCount:  parseInt(stats.videoCount ?? "0", 10),
    };
  } catch (err) {
    console.error("[media] YouTube-haku epäonnistui:", err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// 2) iTunes Lookup API – ei vaadi avainta
//    Podcast ID löytyy Apple Podcasts -URL:sta: id1896272431
// ---------------------------------------------------------------------------

async function fetchAppleStats(podcastId: string): Promise<AppleStats | null> {
  try {
    const url = `https://itunes.apple.com/lookup?id=${podcastId}&entity=podcastEpisode&limit=1`;
    const res = await fetch(url);
    if (!res.ok) return null;

    const data = await res.json();
    const podcast = data?.results?.find((r: any) => r.kind === "podcast" || r.wrapperType === "track");

    // episodeCount tulee resultCount - 1 (yksi on podcast itse)
    const episodeCount = Math.max(0, (data?.resultCount ?? 1) - 1);

    return {
      episodeCount,
      rating:      podcast?.averageUserRating      ?? null,
      ratingCount: podcast?.userRatingCount         ?? null,
    };
  } catch (err) {
    console.error("[media] Apple-haku epäonnistui:", err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// 3) RSS-feed – parsii jaksojen lukumäärän suoraan feedistä
//    Käyttää samaa PUBLIC_RSS_FEED_URL-muuttujaa kuin muu sivusto
// ---------------------------------------------------------------------------

async function fetchRssEpisodeCount(): Promise<number | null> {
  const feedUrl = import.meta.env.PUBLIC_RSS_FEED_URL;
  if (!feedUrl) return null;

  try {
    const res = await fetch(feedUrl);
    if (!res.ok) return null;

    const xml = await res.text();
    // Lasketaan <item>-elementtien määrä (jokainen = yksi jakso)
    const matches = xml.match(/<item[\s>]/g);
    return matches ? matches.length : 0;
  } catch (err) {
    console.error("[media] RSS-haku epäonnistui:", err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// 4) Manuaaliset tilastot – luetaan src/data/media-stats-manual.json
// ---------------------------------------------------------------------------

import manualStatsRaw from "../data/media-stats-manual.json";

function loadManualStats(): ManualStats {
  return manualStatsRaw as ManualStats;
}

// ---------------------------------------------------------------------------
// Pääfunktio – kutsu tätä media.astro-sivun frontmatterista
// ---------------------------------------------------------------------------

export async function fetchAllMediaStats(): Promise<MediaStats> {
  const [youtube, apple, rssEpisodeCount] = await Promise.all([
    fetchYouTubeStats(),
    fetchAppleStats("1896272431"),   // ← RAAKAA:n Apple Podcasts ID
    fetchRssEpisodeCount(),
  ]);

  return {
    youtube,
    apple,
    rssEpisodeCount,
    manual:   loadManualStats(),
    builtAt:  new Date().toISOString(),
  };
}

/**
 * RAAKAA external media metrics endpoint (Cloudflare Worker).
 *
 * Endpoint:
 *   GET /media-kit
 *
 * Returns JSON shape compatible with src/lib/mediaKit.ts:
 * {
 *   "spotifyFollowers": 1200,
 *   "spotifyMonthlyListeners": 4500,
 *   "youtubeSubscribers": 800,
 *   "youtubeViews": 125000,
 *   "appleRating": 4.8,
 *   "appleRatingsCount": 120
 * }
 *
 * Configure Worker environment variables:
 * - YOUTUBE_API_KEY                 (required for automatic YouTube stats)
 * - YOUTUBE_CHANNEL_ID              (required for automatic YouTube stats)
 * - SPOTIFY_FOLLOWERS               (optional numeric fallback/manual value)
 * - SPOTIFY_MONTHLY_LISTENERS       (optional numeric fallback/manual value)
 * - APPLE_RATING                    (optional numeric fallback/manual value)
 * - APPLE_RATINGS_COUNT             (optional numeric fallback/manual value)
 * - ACCESS_TOKEN                    (optional bearer token for endpoint protection)
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method !== 'GET') {
      return json({ error: 'Method not allowed' }, 405);
    }

    if (url.pathname === '/health') {
      return json({ ok: true, service: 'media-metrics-worker' }, 200);
    }

    if (url.pathname !== '/media-kit') {
      return json({ error: 'Not found' }, 404);
    }

    if (env.ACCESS_TOKEN) {
      const auth = request.headers.get('authorization') || '';
      const expected = `Bearer ${env.ACCESS_TOKEN}`;
      if (auth !== expected) return json({ error: 'Unauthorized' }, 401);
    }

    const youtube = await fetchYouTubeStats(env);

    const payload = {
      spotifyFollowers: toNumberOrNull(env.SPOTIFY_FOLLOWERS),
      spotifyMonthlyListeners: toNumberOrNull(env.SPOTIFY_MONTHLY_LISTENERS),
      youtubeSubscribers: youtube.subscribers,
      youtubeViews: youtube.views,
      appleRating: toNumberOrNull(env.APPLE_RATING),
      appleRatingsCount: toNumberOrNull(env.APPLE_RATINGS_COUNT),
      generatedAt: new Date().toISOString(),
      source: {
        youtube: youtube.ok ? 'youtube-data-api-v3' : 'unavailable',
      },
    };

    return json(payload, 200, {
      // Cache briefly to avoid hammering APIs during repeated builds/retries.
      'cache-control': 'public, max-age=300',
    });
  },
};

async function fetchYouTubeStats(env) {
  const apiKey = stringOrNull(env.YOUTUBE_API_KEY);
  const channelId = stringOrNull(env.YOUTUBE_CHANNEL_ID);
  if (!apiKey || !channelId) {
    return { ok: false, subscribers: null, views: null };
  }

  const endpoint = new URL('https://www.googleapis.com/youtube/v3/channels');
  endpoint.searchParams.set('part', 'statistics');
  endpoint.searchParams.set('id', channelId);
  endpoint.searchParams.set('key', apiKey);

  try {
    const res = await fetch(endpoint.toString(), {
      headers: { accept: 'application/json' },
    });
    if (!res.ok) return { ok: false, subscribers: null, views: null };

    const data = await res.json();
    const item = data?.items?.[0];
    const stats = item?.statistics ?? {};

    return {
      ok: true,
      subscribers: toNumberOrNull(stats.subscriberCount),
      views: toNumberOrNull(stats.viewCount),
    };
  } catch {
    return { ok: false, subscribers: null, views: null };
  }
}

function stringOrNull(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function toNumberOrNull(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return null;
  const cleaned = value.trim().replace(/\s/g, '').replace(',', '.');
  if (!cleaned) return null;
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...extraHeaders,
    },
  });
}

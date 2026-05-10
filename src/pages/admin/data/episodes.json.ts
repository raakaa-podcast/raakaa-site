import type { APIRoute } from 'astro';
import { getEpisodesFromRSS } from '../../../lib/rss';

/**
 * Lightweight RSS-derived episode list for the Decap preview pane.
 * Provides title + cover image so the live thumbnail preview can resolve
 * the correct cover for a draft by matching `episodeSlug` or `episodeGuid`.
 */
export const GET: APIRoute = async () => {
  const episodes = await getEpisodesFromRSS();
  const payload = episodes.map((ep) => ({
    slug: ep.slug,
    guid: ep.guid,
    title: ep.title,
    publishedAt: ep.publishedAt,
    imageUrl: ep.imageUrl ?? null,
    episodeNumber: ep.episodeNumber ?? null,
  }));
  return new Response(JSON.stringify(payload), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      // Astro static endpoints don't honor runtime cache headers, but this
      // is correct documentation of intent (preview pane re-fetches per session).
      'cache-control': 'public, max-age=300',
    },
  });
};

export const prerender = true;

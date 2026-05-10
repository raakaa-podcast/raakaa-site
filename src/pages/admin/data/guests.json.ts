import type { APIRoute } from 'astro';
import { getAllGuests } from '../../../lib/episodeMeta';

/**
 * Static guest directory for the Decap preview pane. Used to resolve
 * `guests: [slug, ...]` from a draft into human-readable names without
 * forcing the editor to save/publish first.
 */
export const GET: APIRoute = async () => {
  const guests = getAllGuests().map((g) => ({
    slug: g.slug,
    name: g.name,
    role: g.role ?? null,
    image: g.image ?? null,
  }));
  return new Response(JSON.stringify(guests), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'public, max-age=300',
    },
  });
};

export const prerender = true;

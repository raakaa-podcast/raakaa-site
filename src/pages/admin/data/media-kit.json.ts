import type { APIRoute } from 'astro';
import { getMediaKitSnapshot } from '../../../lib/mediaKit';

/**
 * Media kit snapshot JSON for automation/preview/debug use.
 * Keeps page data and machine-readable stats in sync.
 */
export const GET: APIRoute = async () => {
  const snapshot = await getMediaKitSnapshot();
  return new Response(JSON.stringify(snapshot), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'public, max-age=300',
    },
  });
};

export const prerender = true;

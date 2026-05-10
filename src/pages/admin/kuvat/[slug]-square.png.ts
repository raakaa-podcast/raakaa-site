import type { APIRoute } from 'astro';
import { getEpisodesFromRSS, type Episode } from '../../../lib/rss';
import { renderEpisodeArt } from '../../../lib/ogImage';

export async function getStaticPaths() {
  const episodes = await getEpisodesFromRSS();
  return episodes.map((episode) => ({
    params: { slug: episode.slug },
    props: { episode },
  }));
}

export const GET: APIRoute = async ({ props }) => {
  const episode = (props as { episode: Episode }).episode;
  const png = await renderEpisodeArt(episode, 'square');
  return new Response(new Uint8Array(png), {
    status: 200,
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400',
    },
  });
};

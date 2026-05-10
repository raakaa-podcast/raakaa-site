import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

import { getEpisodeMeta, resolveGuestNames } from './episodeMeta';
import type { Episode } from './rss';

/**
 * Build-time renderer for episode Open Graph images (1200x630).
 *
 * Resources are loaded once and cached across page generations:
 * - Inter (latin) WOFF font, shipped by @fontsource/inter
 * - Episode cover images, fetched and embedded as data URIs (since Satori
 *   does not run a fetcher of its own when rendering)
 */

const require = createRequire(import.meta.url);

const FONT_PATHS = {
  regular: require.resolve('@fontsource/inter/files/inter-latin-400-normal.woff'),
  bold: require.resolve('@fontsource/inter/files/inter-latin-700-normal.woff'),
};

let fontCache: Awaited<ReturnType<typeof loadFonts>> | null = null;
const coverCache = new Map<string, string | null>();

async function loadFonts() {
  const [regular, bold] = await Promise.all([
    readFile(FONT_PATHS.regular),
    readFile(FONT_PATHS.bold),
  ]);
  return [
    { name: 'Inter', data: regular, weight: 400 as const, style: 'normal' as const },
    { name: 'Inter', data: bold, weight: 700 as const, style: 'normal' as const },
  ];
}

async function getFonts() {
  if (!fontCache) fontCache = await loadFonts();
  return fontCache;
}

async function fetchCoverDataUri(url: string): Promise<string | null> {
  if (coverCache.has(url)) return coverCache.get(url) ?? null;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    const contentType = res.headers.get('content-type') ?? 'image/jpeg';
    const dataUri = `data:${contentType};base64,${buf.toString('base64')}`;
    coverCache.set(url, dataUri);
    return dataUri;
  } catch (err) {
    console.warn(`[ogImage] Failed to fetch cover ${url}:`, err);
    coverCache.set(url, null);
    return null;
  }
}

/** Build the Satori-compatible VNode tree for one episode card. */
function buildTree(args: {
  title: string;
  guestLine: string;
  cover: string | null;
}) {
  const { title, guestLine, cover } = args;

  const coverNode = cover
    ? {
        type: 'img',
        props: {
          src: cover,
          width: 380,
          height: 380,
          style: {
            width: '380px',
            height: '380px',
            borderRadius: '24px',
            objectFit: 'cover',
            border: '2px solid rgba(255,255,255,0.18)',
          },
        },
      }
    : {
        type: 'div',
        props: {
          style: {
            display: 'flex',
            width: '380px',
            height: '380px',
            borderRadius: '24px',
            background: 'rgba(255,255,255,0.05)',
            border: '2px solid rgba(255,255,255,0.18)',
          },
        },
      };

  const guestNode = guestLine
    ? {
        type: 'div',
        props: {
          style: {
            display: 'flex',
            fontSize: '30px',
            color: '#bcbcbc',
            fontWeight: 400,
          },
          children: `Vieras: ${guestLine}`,
        },
      }
    : null;

  return {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        width: '1200px',
        height: '630px',
        background:
          'linear-gradient(135deg, #070707 0%, #141414 60%, #1f1a05 100%)',
        color: '#f7f7f7',
        fontFamily: 'Inter',
        position: 'relative',
        padding: '64px',
      },
      children: [
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              position: 'absolute',
              top: '0',
              right: '0',
              width: '520px',
              height: '8px',
              background: '#ffd400',
            },
          },
        },
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              alignItems: 'center',
              marginRight: '56px',
            },
            children: [coverNode],
          },
        },
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              flexDirection: 'column',
              flex: 1,
              justifyContent: 'space-between',
              padding: '4px 0',
            },
            children: [
              {
                type: 'div',
                props: {
                  style: {
                    display: 'flex',
                    fontSize: '34px',
                    fontWeight: 700,
                    letterSpacing: '0.22em',
                    textTransform: 'uppercase',
                    color: '#ffd400',
                  },
                  children: 'RAAKAA Podcast',
                },
              },
              {
                type: 'div',
                props: {
                  style: {
                    display: 'flex',
                    flexDirection: 'column',
                  },
                  children: [
                    {
                      type: 'div',
                      props: {
                        style: {
                          display: '-webkit-box',
                          fontSize: '60px',
                          fontWeight: 700,
                          lineHeight: 1.08,
                          color: '#ffffff',
                          marginBottom: '20px',
                          // @ts-expect-error satori-supported clamp props
                          WebkitLineClamp: 3,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        },
                        children: title,
                      },
                    },
                    ...(guestNode ? [guestNode] : []),
                  ],
                },
              },
              {
                type: 'div',
                props: {
                  style: {
                    display: 'flex',
                    fontSize: '22px',
                    color: '#bcbcbc',
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    fontWeight: 700,
                  },
                  children: 'raakaa.fi',
                },
              },
            ],
          },
        },
      ],
    },
  };
}

/** Render an episode OG image as a PNG buffer. */
export async function renderEpisodeOgImage(episode: Episode): Promise<Buffer> {
  const meta = getEpisodeMeta(episode);
  const guests = resolveGuestNames(meta.guests ?? []);
  const guestLine = guests.map((g) => g.name).join(' & ');

  const [fonts, cover] = await Promise.all([
    getFonts(),
    episode.imageUrl ? fetchCoverDataUri(episode.imageUrl) : Promise.resolve(null),
  ]);

  const tree = buildTree({
    title: episode.title,
    guestLine,
    cover,
  });

  // Satori expects a React-element-shaped tree; the manually-built object above
  // matches that shape, so we cast through `unknown` to satisfy the types.
  const svg = await satori(tree as unknown as Parameters<typeof satori>[0], {
    width: 1200,
    height: 630,
    fonts,
  });

  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: 1200 },
    background: '#070707',
  });
  return resvg.render().asPng();
}

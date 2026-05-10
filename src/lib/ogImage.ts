import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

import { getEpisodeMeta, resolveGuestNames } from './episodeMeta';
import type { Episode } from './rss';

/**
 * Build-time renderer for episode artwork in three formats:
 *   - 'og'      → 1200x630  (Open Graph / social previews)
 *   - 'youtube' → 1920x1080 (YouTube thumbnails, Spotify Video, social video)
 *   - 'square'  → 3000x3000 JPEG (Apple Podcasts, Spotify audio, RSS host episode art;
 *                  lossy encode keeps files under typical 5 MB RSS limits)
 *
 * The OG and YouTube formats share a horizontal "cover left / text right"
 * layout. The square format uses the cover as a full-bleed background with
 * a dark gradient and overlaid title.
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

export type EpisodeArtFormat = 'og' | 'youtube' | 'square';

type FormatSpec = {
  width: number;
  height: number;
  /** "horizontal" = cover-left / text-right; "square" = cover full-bleed bg */
  layout: 'horizontal' | 'square';
  padding: number;
  coverSize: number;
  brandSize: number;
  brandLetterSpacing: string;
  titleSize: number;
  titleMarginBottom: number;
  guestSize: number;
  footerSize: number;
  accentStripeWidth: number;
  accentStripeHeight: number;
  coverRadius: number;
};

const FORMAT_SPECS: Record<EpisodeArtFormat, FormatSpec> = {
  og: {
    width: 1200,
    height: 630,
    layout: 'horizontal',
    padding: 64,
    coverSize: 380,
    brandSize: 34,
    brandLetterSpacing: '0.22em',
    titleSize: 60,
    titleMarginBottom: 20,
    guestSize: 30,
    footerSize: 22,
    accentStripeWidth: 520,
    accentStripeHeight: 8,
    coverRadius: 24,
  },
  youtube: {
    width: 1920,
    height: 1080,
    layout: 'horizontal',
    padding: 110,
    coverSize: 720,
    brandSize: 56,
    brandLetterSpacing: '0.22em',
    titleSize: 100,
    titleMarginBottom: 36,
    guestSize: 50,
    footerSize: 36,
    accentStripeWidth: 880,
    accentStripeHeight: 14,
    coverRadius: 40,
  },
  square: {
    width: 3000,
    height: 3000,
    layout: 'square',
    padding: 180,
    coverSize: 0, // full-bleed
    brandSize: 110,
    brandLetterSpacing: '0.24em',
    titleSize: 200,
    titleMarginBottom: 56,
    guestSize: 90,
    footerSize: 70,
    accentStripeWidth: 1400,
    accentStripeHeight: 24,
    coverRadius: 0,
  },
};

function buildHorizontalTree(args: {
  title: string;
  guestLine: string;
  cover: string | null;
  spec: FormatSpec;
}) {
  const { title, guestLine, cover, spec } = args;

  const coverNode = cover
    ? {
        type: 'img',
        props: {
          src: cover,
          width: spec.coverSize,
          height: spec.coverSize,
          style: {
            width: `${spec.coverSize}px`,
            height: `${spec.coverSize}px`,
            borderRadius: `${spec.coverRadius}px`,
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
            width: `${spec.coverSize}px`,
            height: `${spec.coverSize}px`,
            borderRadius: `${spec.coverRadius}px`,
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
            fontSize: `${spec.guestSize}px`,
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
        width: `${spec.width}px`,
        height: `${spec.height}px`,
        background:
          'linear-gradient(135deg, #070707 0%, #141414 60%, #1f1a05 100%)',
        color: '#f7f7f7',
        fontFamily: 'Inter',
        position: 'relative',
        padding: `${spec.padding}px`,
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
              width: `${spec.accentStripeWidth}px`,
              height: `${spec.accentStripeHeight}px`,
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
              marginRight: `${Math.round(spec.padding * 0.85)}px`,
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
                    fontSize: `${spec.brandSize}px`,
                    fontWeight: 700,
                    letterSpacing: spec.brandLetterSpacing,
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
                          fontSize: `${spec.titleSize}px`,
                          fontWeight: 700,
                          lineHeight: 1.08,
                          color: '#ffffff',
                          marginBottom: `${spec.titleMarginBottom}px`,
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
                    fontSize: `${spec.footerSize}px`,
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

function buildSquareTree(args: {
  title: string;
  guestLine: string;
  cover: string | null;
  spec: FormatSpec;
}) {
  const { title, guestLine, cover, spec } = args;
  const { width, height, padding } = spec;

  // Full-bleed cover or dark fallback
  const backgroundLayer = cover
    ? {
        type: 'img',
        props: {
          src: cover,
          width,
          height,
          style: {
            position: 'absolute',
            top: '0',
            left: '0',
            width: `${width}px`,
            height: `${height}px`,
            objectFit: 'cover',
          },
        },
      }
    : {
        type: 'div',
        props: {
          style: {
            display: 'flex',
            position: 'absolute',
            top: '0',
            left: '0',
            width: `${width}px`,
            height: `${height}px`,
            background:
              'linear-gradient(135deg, #070707 0%, #141414 60%, #1f1a05 100%)',
          },
        },
      };

  // Dark gradient overlay so title is readable over any cover
  const gradientOverlay = {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        position: 'absolute',
        top: '0',
        left: '0',
        width: `${width}px`,
        height: `${height}px`,
        background:
          'linear-gradient(180deg, rgba(7,7,7,0.55) 0%, rgba(7,7,7,0.15) 35%, rgba(7,7,7,0.55) 65%, rgba(7,7,7,0.92) 100%)',
      },
    },
  };

  const accentStripe = {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        position: 'absolute',
        top: '0',
        right: '0',
        width: `${spec.accentStripeWidth}px`,
        height: `${spec.accentStripeHeight}px`,
        background: '#ffd400',
      },
    },
  };

  const brandRow = {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        position: 'absolute',
        top: `${padding}px`,
        left: `${padding}px`,
        right: `${padding}px`,
        fontSize: `${spec.brandSize}px`,
        fontWeight: 700,
        letterSpacing: spec.brandLetterSpacing,
        textTransform: 'uppercase',
        color: '#ffd400',
      },
      children: 'RAAKAA Podcast',
    },
  };

  const titleNode = {
    type: 'div',
    props: {
      style: {
        display: '-webkit-box',
        fontSize: `${spec.titleSize}px`,
        fontWeight: 700,
        lineHeight: 1.05,
        color: '#ffffff',
        marginBottom: `${spec.titleMarginBottom}px`,
        // @ts-expect-error satori-supported clamp props
        WebkitLineClamp: 3,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
      },
      children: title,
    },
  };

  const guestNode = guestLine
    ? {
        type: 'div',
        props: {
          style: {
            display: 'flex',
            fontSize: `${spec.guestSize}px`,
            color: '#dddddd',
            fontWeight: 400,
            marginBottom: `${spec.titleMarginBottom}px`,
          },
          children: `Vieras: ${guestLine}`,
        },
      }
    : null;

  const footerNode = {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        fontSize: `${spec.footerSize}px`,
        color: '#ffd400',
        letterSpacing: '0.18em',
        textTransform: 'uppercase',
        fontWeight: 700,
      },
      children: 'raakaa.fi',
    },
  };

  const bottomBlock = {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        flexDirection: 'column',
        position: 'absolute',
        left: `${padding}px`,
        right: `${padding}px`,
        bottom: `${padding}px`,
      },
      children: [titleNode, ...(guestNode ? [guestNode] : []), footerNode],
    },
  };

  return {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        width: `${width}px`,
        height: `${height}px`,
        background: '#070707',
        color: '#f7f7f7',
        fontFamily: 'Inter',
        position: 'relative',
      },
      children: [backgroundLayer, gradientOverlay, accentStripe, brandRow, bottomBlock],
    },
  };
}

function buildTree(args: {
  title: string;
  guestLine: string;
  cover: string | null;
  spec: FormatSpec;
}) {
  return args.spec.layout === 'square'
    ? buildSquareTree(args)
    : buildHorizontalTree(args);
}

export type EpisodeArtMime = 'image/png' | 'image/jpeg';

/** MIME for the buffer returned by `renderEpisodeArt` (square is JPEG for smaller RSS uploads). */
export function getEpisodeArtMime(format: EpisodeArtFormat): EpisodeArtMime {
  return format === 'square' ? 'image/jpeg' : 'image/png';
}

/** Render an episode image. OG and YouTube are PNG; square is JPEG after PNG raster pass. */
export async function renderEpisodeArt(
  episode: Episode,
  format: EpisodeArtFormat = 'og',
): Promise<Buffer> {
  const meta = getEpisodeMeta(episode);
  const guests = resolveGuestNames(meta.guests ?? []);
  const guestLine = guests.map((g) => g.name).join(' & ');
  const spec = FORMAT_SPECS[format];

  const [fonts, cover] = await Promise.all([
    getFonts(),
    episode.imageUrl ? fetchCoverDataUri(episode.imageUrl) : Promise.resolve(null),
  ]);

  const tree = buildTree({
    title: episode.title,
    guestLine,
    cover,
    spec,
  });

  const svg = await satori(tree as unknown as Parameters<typeof satori>[0], {
    width: spec.width,
    height: spec.height,
    fonts,
  });

  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: spec.width },
    background: '#070707',
  });
  const png = resvg.render().asPng();
  if (format !== 'square') return png;

  return sharp(png)
    .jpeg({
      quality: 84,
      mozjpeg: true,
      chromaSubsampling: '4:2:0',
      progressive: true,
    })
    .toBuffer();
}

/** Backwards-compatible alias for the existing /og/jaksot/[slug].png endpoint. */
export const renderEpisodeOgImage = (episode: Episode) =>
  renderEpisodeArt(episode, 'og');

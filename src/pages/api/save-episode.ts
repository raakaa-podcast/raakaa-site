import fs from 'node:fs/promises';
import path from 'node:path';
import type { APIRoute } from 'astro';

type Guest = {
  slug: string;
  name: string;
  role?: string;
  bio: string;
  image?: string;
  links?: { label: string; url: string }[];
};

type EpisodeMeta = {
  episodeSlug?: string;
  episodeGuid?: string;
  guests?: string[];
  topics?: string[];
  summary?: string;
  youtubeUrl?: string;
};

type PdfItem = {
  title: string;
  episodeSlug?: string;
  publishDate?: string;
  excerpt?: string;
  pdfUrl: string;
};

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 96);
}

function validateSlug(slug: string): boolean {
  return /^[a-z0-9-]+$/.test(slug);
}

async function readJson<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function writeJson(filePath: string, value: unknown) {
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export const POST: APIRoute = async ({ request }) => {
  if (!import.meta.env.DEV) {
    return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });
  }

  try {
    const body = (await request.json()) as {
      mode?: 'upsert' | 'delete';
      previousSlug?: string;
      episode?: {
        slug?: string;
        title?: string;
        summary?: string;
        guestName?: string;
        guestRole?: string;
        guestBio?: string;
        guestImage?: string;
        youtubeUrl?: string;
        tags?: string;
        pdfUrl?: string;
      };
    };

    const mode = body.mode ?? 'upsert';
    const payload = body.episode ?? {};
    const slug = (payload.slug || '').trim();
    const previousSlug = (body.previousSlug || slug).trim();

    if (!previousSlug) {
      return new Response(JSON.stringify({ error: 'Missing episode slug.' }), { status: 400 });
    }

    if (mode !== 'delete') {
      if (!slug || !validateSlug(slug)) {
        return new Response(JSON.stringify({ error: 'Invalid slug.' }), { status: 400 });
      }
    }

    const repoRoot = process.cwd();
    const metaPath = path.join(repoRoot, 'src', 'data', 'episode-meta.json');
    const guestsPath = path.join(repoRoot, 'src', 'data', 'guests.json');
    const pdfPath = path.join(repoRoot, 'src', 'data', 'litteroinnit.json');

    const metaRows = await readJson<EpisodeMeta[]>(metaPath, []);
    const guests = await readJson<Guest[]>(guestsPath, []);
    const pdfRows = await readJson<PdfItem[]>(pdfPath, []);

    const duplicate = mode !== 'delete' && metaRows.some((m) => m.episodeSlug === slug && m.episodeSlug !== previousSlug);
    if (duplicate) {
      return new Response(JSON.stringify({ error: 'Slug already exists.' }), { status: 400 });
    }

    if (mode === 'delete') {
      const nextMeta = metaRows.filter((m) => m.episodeSlug !== previousSlug);
      const nextPdf = pdfRows.filter((p) => p.episodeSlug !== previousSlug);
      await writeJson(metaPath, nextMeta);
      await writeJson(pdfPath, nextPdf);
      return new Response(JSON.stringify({ ok: true }));
    }

    const topics = (payload.tags || '')
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean);

    let guestSlug = '';
    if ((payload.guestName || '').trim()) {
      guestSlug = slugify(payload.guestName || slug);
      const guestRecord: Guest = {
        slug: guestSlug,
        name: (payload.guestName || '').trim(),
        role: (payload.guestRole || '').trim() || undefined,
        bio: (payload.guestBio || '').trim() || '',
        image: (payload.guestImage || '').trim() || undefined,
      };
      const existingGuestIndex = guests.findIndex((g) => g.slug === guestSlug);
      if (existingGuestIndex >= 0) guests[existingGuestIndex] = guestRecord;
      else guests.push(guestRecord);
    }

    const metaRecord: EpisodeMeta = {
      episodeSlug: slug,
      guests: guestSlug ? [guestSlug] : [],
      topics,
      summary: (payload.summary || '').trim() || undefined,
      youtubeUrl: (payload.youtubeUrl || '').trim() || undefined,
    };

    const cleanMetaRecord = Object.fromEntries(Object.entries(metaRecord).filter(([, v]) => v != null)) as EpisodeMeta;
    const metaIndex = metaRows.findIndex((m) => m.episodeSlug === previousSlug);
    if (metaIndex >= 0) metaRows[metaIndex] = cleanMetaRecord;
    else metaRows.push(cleanMetaRecord);

    const pdfUrl = (payload.pdfUrl || '').trim();
    const pdfIndex = pdfRows.findIndex((row) => row.episodeSlug === previousSlug || row.episodeSlug === slug);
    if (pdfUrl) {
      const pdfRecord: PdfItem = {
        title: (payload.title || slug).trim(),
        episodeSlug: slug,
        publishDate: undefined,
        excerpt: (payload.summary || '').trim() || undefined,
        pdfUrl,
      };
      if (pdfIndex >= 0) pdfRows[pdfIndex] = pdfRecord;
      else pdfRows.push(pdfRecord);
    } else if (pdfIndex >= 0) {
      pdfRows.splice(pdfIndex, 1);
    }

    await writeJson(metaPath, metaRows);
    await writeJson(guestsPath, guests);
    await writeJson(pdfPath, pdfRows);

    return new Response(JSON.stringify({ ok: true }));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown save error';
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
};

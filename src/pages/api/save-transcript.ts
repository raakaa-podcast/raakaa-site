import fs from 'node:fs/promises';
import path from 'node:path';
import type { APIRoute } from 'astro';

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 96);
}

function toPosixPath(value: string): string {
  return value.replace(/\\/g, '/');
}

function asSafeTranscriptPath(slug: string, inputPath?: string): string {
  const fallback = `src/content/transcripts/${slug}.md`;
  const normalized = toPosixPath((inputPath || fallback).trim() || fallback);
  const expectedPrefix = 'src/content/transcripts/';
  if (!normalized.startsWith(expectedPrefix)) return fallback;
  if (!normalized.endsWith('.md')) return fallback;
  if (normalized.includes('..')) return fallback;
  return normalized;
}

export const POST: APIRoute = async ({ request }) => {
  if (!import.meta.env.DEV) {
    return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });
  }

  try {
    const body = (await request.json()) as {
      mode?: 'save' | 'delete';
      slug?: string;
      title?: string;
      publishDate?: string;
      summary?: string;
      transcriptText?: string;
      transcriptPath?: string;
    };

    const mode = body.mode ?? 'save';
    const slug = slugify((body.slug || '').trim());
    if (!slug) {
      return new Response(JSON.stringify({ error: 'Missing slug.' }), { status: 400 });
    }

    const repoRoot = process.cwd();
    const relativePath = asSafeTranscriptPath(slug, body.transcriptPath);
    const absolutePath = path.join(repoRoot, ...relativePath.split('/'));

    if (mode === 'delete') {
      try {
        await fs.unlink(absolutePath);
      } catch {
        // Ignore if missing.
      }
      return new Response(JSON.stringify({ ok: true }));
    }

    const title = (body.title || slug).trim();
    const publishDate = (body.publishDate || '').trim();
    const summary = (body.summary || '').trim();
    const transcriptText = (body.transcriptText || '').trim();

    const frontmatter = [
      '---',
      `title: ${title || slug}`,
      `episodeSlug: ${slug}`,
      ...(publishDate ? [`publishDate: ${publishDate}`] : []),
      ...(summary ? [`excerpt: ${summary.replace(/\n+/g, ' ')}`] : []),
      '---',
      '',
    ];

    const bodyText = transcriptText || '# Litterointi\n\nLisaa litteroinnin teksti tahan.';
    const markdown = `${frontmatter.join('\n')}${bodyText}\n`;

    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, markdown, 'utf8');

    return new Response(JSON.stringify({ ok: true, path: relativePath }));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Litteroinnin tallennus epaonnistui';
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
};

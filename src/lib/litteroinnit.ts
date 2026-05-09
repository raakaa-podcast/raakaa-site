import fs from 'node:fs/promises';
import path from 'node:path';
import litteroinnitJson from '../data/litteroinnit.json';
import type { Episode } from './rss';

export type PdfTranscriptData = {
  title: string;
  pdfUrl: string;
  episodeSlug?: string;
  episodeGuid?: string;
  publishDate?: string;
  excerpt?: string;
};

const PDF_DIR = path.join(process.cwd(), 'src', 'content', 'pdf-transcripts');

function manifestRows(): PdfTranscriptData[] {
  if (Array.isArray(litteroinnitJson)) {
    return litteroinnitJson as PdfTranscriptData[];
  }
  const obj = litteroinnitJson as { pdfs?: PdfTranscriptData[]; items?: PdfTranscriptData[] };
  return obj.items ?? obj.pdfs ?? [];
}

/** Minimal key: value parser for flat YAML files (content collection `.yml` entries). */
function parseFlatYaml(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of raw.replace(/\r\n/g, '\n').split('\n')) {
    const m = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    out[m[1]] = v;
  }
  return out;
}

async function pdfFromContentFiles(episode: Episode): Promise<PdfTranscriptData | null> {
  try {
    const files = await fs.readdir(PDF_DIR, { withFileTypes: true });
    for (const file of files) {
      if (!file.isFile() || !/\.ya?ml$/i.test(file.name)) continue;
      const raw = await fs.readFile(path.join(PDF_DIR, file.name), 'utf8');
      const o = parseFlatYaml(raw);
      if (o.episodeGuid === episode.guid || o.episodeSlug === episode.slug) {
        if (!o.title || !o.pdfUrl) continue;
        return {
          title: o.title,
          pdfUrl: o.pdfUrl,
          episodeSlug: o.episodeSlug,
          episodeGuid: o.episodeGuid,
          publishDate: o.publishDate,
          excerpt: o.excerpt,
        };
      }
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * PDF litterointi from `src/data/litteroinnit.json` (or Decap-targeted manifest) and repo `pdf-transcripts` YAML.
 * Does not use `getCollection` so static builds stay reliable.
 */
export async function getPdfTranscriptForEpisode(
  episode: Episode,
): Promise<{ data: PdfTranscriptData } | null> {
  const fromManifest = manifestRows().find(
    (row) => row.episodeSlug === episode.slug || (row.episodeGuid && row.episodeGuid === episode.guid),
  );
  if (fromManifest) {
    return { data: fromManifest };
  }
  const fromFile = await pdfFromContentFiles(episode);
  return fromFile ? { data: fromFile } : null;
}

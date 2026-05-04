import litteroinnitJson from '../data/litteroinnit.json';
import { getCollection } from 'astro:content';
import type { Episode } from './rss';

export type PdfTranscriptData = {
  title: string;
  pdfUrl: string;
  episodeSlug?: string;
  episodeGuid?: string;
  publishDate?: string;
  excerpt?: string;
};

function manifestRows(): PdfTranscriptData[] {
  if (Array.isArray(litteroinnitJson)) {
    return litteroinnitJson as PdfTranscriptData[];
  }
  const obj = litteroinnitJson as { pdfs?: PdfTranscriptData[] };
  return obj.pdfs ?? [];
}

function keyFor(data: PdfTranscriptData): string {
  return data.episodeSlug || data.episodeGuid || data.title;
}

export async function getAllPdfTranscriptItems(): Promise<PdfTranscriptData[]> {
  const fromManifest = manifestRows();
  const collection = await getCollection('pdfTranscripts');
  const merged = new Map<string, PdfTranscriptData>();

  for (const entry of collection) {
    merged.set(keyFor(entry.data), entry.data);
  }
  for (const row of fromManifest) {
    merged.set(keyFor(row), row);
  }

  return [...merged.values()].sort((a, b) => {
    const da = a.publishDate ?? '';
    const db = b.publishDate ?? '';
    return db.localeCompare(da);
  });
}

export async function getPdfTranscriptForEpisode(episode: Episode): Promise<{ data: PdfTranscriptData } | null> {
  const fromManifest = manifestRows().find(
    (row) => row.episodeSlug === episode.slug || (row.episodeGuid && row.episodeGuid === episode.guid),
  );
  if (fromManifest) {
    return { data: fromManifest };
  }

  const pdfTranscripts = await getCollection('pdfTranscripts');
  const entry =
    pdfTranscripts.find((e) => e.data.episodeGuid === episode.guid) ||
    pdfTranscripts.find((e) => e.data.episodeSlug === episode.slug) ||
    null;

  return entry ? { data: entry.data } : null;
}

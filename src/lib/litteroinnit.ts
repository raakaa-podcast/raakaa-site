import { getEpisodeRecord } from './episodeMeta';
import type { Episode } from './rss';

export type PdfTranscriptData = {
  title: string;
  pdfUrl: string;
  episodeSlug?: string;
  episodeGuid?: string;
  publishDate?: string;
  excerpt?: string;
};

/**
 * PDF litterointi read from the unified episode markdown file
 * (`src/content/episodes/<slug>.md`). Returns null when no `pdfUrl`
 * is set on the episode.
 */
export async function getPdfTranscriptForEpisode(
  episode: Episode,
): Promise<{ data: PdfTranscriptData } | null> {
  const rec = getEpisodeRecord(episode);
  if (!rec?.pdfUrl) return null;
  return {
    data: {
      title: rec.title ?? episode.title,
      pdfUrl: rec.pdfUrl,
      episodeSlug: rec.episodeSlug,
      episodeGuid: rec.episodeGuid,
      publishDate: rec.publishDate,
      excerpt: rec.excerpt,
    },
  };
}

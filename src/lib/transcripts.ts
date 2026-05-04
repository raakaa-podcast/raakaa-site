import { getCollection } from 'astro:content';
import type { Episode } from './rss';

export async function getTranscriptForEpisode(episode: Episode) {
  const transcripts = await getCollection('transcripts');

  return (
    transcripts.find((entry) => entry.data.episodeGuid === episode.guid) ||
    transcripts.find((entry) => entry.data.episodeSlug === episode.slug) ||
    null
  );
}

export { getPdfTranscriptForEpisode, getAllPdfTranscriptItems } from './litteroinnit';
export type { PdfTranscriptData } from './litteroinnit';

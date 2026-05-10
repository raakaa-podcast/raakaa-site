import { marked } from 'marked';
import { getEpisodeRecord } from './episodeMeta';
import type { Episode } from './rss';

/** Plain markdown body for the episode, read from `src/content/episodes/<slug>.md`. */
export function getTranscriptMarkdownForEpisode(episode: Episode): string | null {
  const rec = getEpisodeRecord(episode);
  if (!rec) return null;
  const body = rec.body?.trim();
  return body ? body : null;
}

/** HTML for the episode transcript. */
export async function getTranscriptHtmlForEpisode(episode: Episode): Promise<string | null> {
  const md = getTranscriptMarkdownForEpisode(episode);
  if (!md) return null;
  return marked.parse(md, { async: false }) as string;
}

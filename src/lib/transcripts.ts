import fs from 'node:fs/promises';
import path from 'node:path';
import { marked } from 'marked';
import type { Episode } from './rss';

const TRANSCRIPTS_DIR = path.join(process.cwd(), 'src', 'content', 'transcripts');

function parseFrontmatter(raw: string): { frontmatter: Record<string, string>; body: string } {
  const normalized = raw.replace(/\r\n/g, '\n');
  const match = normalized.match(/^---\s*\n([\s\S]*?)\n---\s*\n?/);
  if (!match) return { frontmatter: {}, body: normalized.trim() };
  const frontmatter: Record<string, string> = {};
  for (const line of match[1].split('\n')) {
    const parts = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (!parts) continue;
    let value = parts[2]?.trim() ?? '';
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    frontmatter[parts[1]] = value;
  }
  return { frontmatter, body: normalized.slice(match[0].length).trim() };
}

/** Plain markdown body for the episode, read from `src/content/transcripts/*.md`. */
export async function getTranscriptMarkdownForEpisode(episode: Episode): Promise<string | null> {
  try {
    const files = await fs.readdir(TRANSCRIPTS_DIR, { withFileTypes: true });
    for (const file of files) {
      if (!file.isFile() || !file.name.endsWith('.md')) continue;
      const full = path.join(TRANSCRIPTS_DIR, file.name);
      const raw = await fs.readFile(full, 'utf8');
      const { frontmatter, body } = parseFrontmatter(raw);
      if (frontmatter.episodeGuid === episode.guid || frontmatter.episodeSlug === episode.slug) {
        return body || null;
      }
    }
  } catch {
    return null;
  }
  return null;
}

/** HTML for the episode transcript (avoids `getCollection` during static build, where the content data layer can be empty in worker chunks). */
export async function getTranscriptHtmlForEpisode(episode: Episode): Promise<string | null> {
  const md = await getTranscriptMarkdownForEpisode(episode);
  if (!md) return null;
  return marked.parse(md, { async: false }) as string;
}

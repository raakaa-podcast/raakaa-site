import { getCollection } from 'astro:content';
import fs from 'node:fs/promises';
import type { Episode } from './rss';

export async function getTranscriptForEpisode(episode: Episode) {
  const transcripts = await getCollection('transcripts');

  return (
    transcripts.find((entry) => entry.data.episodeGuid === episode.guid) ||
    transcripts.find((entry) => entry.data.episodeSlug === episode.slug) ||
    null
  );
}

function parseFrontmatter(raw: string): { frontmatter: Record<string, string>; body: string } {
  const normalized = raw.replace(/\r\n/g, '\n');
  const match = normalized.match(/^---\s*\n([\s\S]*?)\n---\s*\n?/);
  if (!match) return { frontmatter: {}, body: normalized.trim() };
  const frontmatter: Record<string, string> = {};
  for (const line of match[1].split('\n')) {
    const parts = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (!parts) continue;
    frontmatter[parts[1]] = parts[2]?.trim() ?? '';
  }
  return { frontmatter, body: normalized.slice(match[0].length).trim() };
}

export async function getTranscriptFallbackTextForEpisode(episode: Episode): Promise<string | null> {
  const dir = new URL('../content/transcripts/', import.meta.url);
  try {
    const files = await fs.readdir(dir, { withFileTypes: true });
    for (const file of files) {
      if (!file.isFile() || !file.name.endsWith('.md')) continue;
      const full = new URL(`../content/transcripts/${file.name}`, import.meta.url);
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

import type { Episode } from './rss';
import { getEpisodeMeta } from './episodeMeta';

/** URL segment for topic landing pages; mirrors RSS slug rules. */
export function topicToTagSlug(topic: string): string {
  return topic
    .trim()
    .replace(/^#+/u, '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 96);
}

export type TopicIndexEntry = { slug: string; label: string };

/** Unique tags across episodes; `label` is first-seen display text (without leading #). */
export function collectTopicIndex(episodes: Episode[]): TopicIndexEntry[] {
  const bySlug = new Map<string, string>();
  for (const ep of episodes) {
    for (const raw of getEpisodeMeta(ep).topics ?? []) {
      const slug = topicToTagSlug(raw);
      if (!slug) continue;
      const label = raw.trim().replace(/^#+/u, '');
      if (!bySlug.has(slug)) bySlug.set(slug, label);
    }
  }
  return [...bySlug.entries()]
    .map(([slug, label]) => ({ slug, label }))
    .sort((a, b) => a.label.localeCompare(b.label, 'fi'));
}

export function episodesForTagSlug(episodes: Episode[], tagSlug: string): Episode[] {
  return episodes.filter((ep) => {
    const topics = getEpisodeMeta(ep).topics ?? [];
    return topics.some((t) => topicToTagSlug(t) === tagSlug);
  });
}

import { getEpisodesFromRSS, type Episode } from './rss';

/** Yksi jaettu lupaus sessiolla (dev + staattinen build), jottei RSSitä haettaisi jokaisesta sivusta uudelleen. */
let latestPromise: Promise<Episode | null> | null = null;

function pickLatest(episodes: Episode[]): Episode | null {
  if (episodes.length === 0) return null;
  const sorted = [...episodes].sort((a, b) => {
    const ta = Date.parse(a.publishedAt);
    const tb = Date.parse(b.publishedAt);
    const na = Number.isNaN(ta) ? 0 : ta;
    const nb = Number.isNaN(tb) ? 0 : tb;
    return nb - na;
  });
  return sorted[0] ?? null;
}

/** Uusin jakso sticky-soittimen build-aikaista esiasetusta varten (yksi verkko‑RST per build-/dev-session). */
export async function getLatestEpisodeForStickyPlayer(): Promise<Episode | null> {
  latestPromise ??= (async () => {
    const list = await getEpisodesFromRSS();
    return pickLatest(list);
  })();
  return latestPromise;
}

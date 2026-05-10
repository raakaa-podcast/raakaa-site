import { defineCollection, z } from 'astro:content';

/** Decap / YAML may emit real dates for YYYY-MM-DD; Zod string would reject them. */
const dateLike = z
  .union([z.string(), z.date()])
  .optional()
  .transform((v) => (v instanceof Date ? v.toISOString().slice(0, 10) : v));

/**
 * Unified episode collection: one markdown file per episode at
 * `src/content/episodes/<slug>.md`. Frontmatter holds the manual metadata
 * (summary, guests, topics, etc.) and the body holds the transcript markdown.
 *
 * This collection is consumed directly via fs in `src/lib/episodeMeta.ts`
 * (not via `getCollection`) to stay deterministic during static builds, but
 * the schema is defined here so future page authors get type/validation help
 * if they ever switch to the content layer.
 */
const episodes = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    episodeSlug: z.string(),
    episodeGuid: z.string().optional(),
    publishDate: dateLike,
    excerpt: z.string().optional(),
    summary: z.string().optional(),
    youtubeUrl: z.string().optional(),
    customCoverImage: z.string().optional(),
    pdfUrl: z.string().optional(),
    topics: z.array(z.string()).optional(),
    guests: z.array(z.string()).optional(),
  }),
});

export const collections = { episodes };

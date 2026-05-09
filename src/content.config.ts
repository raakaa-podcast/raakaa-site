import { defineCollection, z } from 'astro:content';

/** Decap / YAML may emit real dates for YYYY-MM-DD; Zod string would reject them. */
const dateLike = z
  .union([z.string(), z.date()])
  .optional()
  .transform((v) => (v instanceof Date ? v.toISOString().slice(0, 10) : v));

const transcripts = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    episodeGuid: z.string().optional(),
    episodeSlug: z.string().optional(),
    publishDate: dateLike,
    excerpt: z.string().optional(),
  }),
});

const pdfTranscripts = defineCollection({
  type: 'data',
  schema: z.object({
    title: z.string(),
    episodeGuid: z.string().optional(),
    episodeSlug: z.string().optional(),
    publishDate: dateLike,
    excerpt: z.string().optional(),
    pdfUrl: z.string(),
  }),
});

export const collections = { transcripts, pdfTranscripts };

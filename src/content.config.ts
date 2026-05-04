import { defineCollection, z } from 'astro:content';

const transcripts = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    episodeGuid: z.string().optional(),
    episodeSlug: z.string().optional(),
    publishDate: z.string().optional(),
    excerpt: z.string().optional(),
  }),
});

const pdfTranscripts = defineCollection({
  type: 'data',
  schema: z.object({
    title: z.string(),
    episodeGuid: z.string().optional(),
    episodeSlug: z.string().optional(),
    publishDate: z.string().optional(),
    excerpt: z.string().optional(),
    pdfUrl: z.string(),
  }),
});

export const collections = { transcripts, pdfTranscripts };

// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

const SITE_URL = 'https://www.raakaa.fi';

export default defineConfig({
  output: 'static',
  site: SITE_URL,
  integrations: [sitemap()],
  trailingSlash: 'never',
  build: {
    inlineStylesheets: 'auto',
  },
  compressHTML: true,
});

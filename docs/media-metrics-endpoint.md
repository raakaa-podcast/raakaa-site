# External media metrics endpoint (ready setup)

Goal: create a live endpoint for `MEDIAKIT_METRICS_URL` so `/media` gets fresh platform numbers on every Netlify build.

This setup uses a Cloudflare Worker and is the quickest path to production.

## 1) Create Worker

1. Open Cloudflare Dashboard.
2. Go to **Workers & Pages** -> **Create** -> **Create Worker**.
3. Name it, e.g. `raakaa-media-metrics`.
4. Replace default code with `ops/cloudflare-media-metrics-worker.js`.
5. Deploy.

Your endpoint will be:
- `https://<worker-name>.<your-subdomain>.workers.dev/media-kit`

## 2) Set Worker variables

In Worker settings -> **Variables and Secrets**, add:

- `YOUTUBE_API_KEY` (secret)
- `YOUTUBE_CHANNEL_ID`
- `SPOTIFY_FOLLOWERS` (optional)
- `SPOTIFY_MONTHLY_LISTENERS` (optional)
- `APPLE_RATING` (optional)
- `APPLE_RATINGS_COUNT` (optional)
- `ACCESS_TOKEN` (optional but recommended; if set, caller must send `Authorization: Bearer <token>`)

Notes:
- YouTube values are fetched automatically from YouTube Data API each request.
- Spotify/Apple are currently manual env values unless you add a paid analytics API later.

## 3) Point Netlify to the Worker

Netlify -> Site configuration -> Build & deploy -> Environment variables:

- `MEDIAKIT_METRICS_URL = https://<worker-url>/media-kit`

Optional auth support (if you set `ACCESS_TOKEN` in Worker):
- expose same token in Netlify env as `MEDIAKIT_METRICS_TOKEN`
- then extend `src/lib/mediaKit.ts` to send Authorization header
  (not required if endpoint is public read-only)

## 4) Trigger deploy

Run a new deploy (or push commit). During build:
- Astro calls `MEDIAKIT_METRICS_URL`
- Worker returns latest metrics
- `/media` and `/admin/data/media-kit.json` get updated values

## 5) Quick verify

1. Open Worker URL directly:
   - `https://<worker-url>/media-kit`
2. Confirm JSON contains:
   - `spotifyFollowers`
   - `spotifyMonthlyListeners`
   - `youtubeSubscribers`
   - `youtubeViews`
   - `appleRating`
   - `appleRatingsCount`
3. Trigger Netlify deploy and check `/media`.

# Stremio Streamed Addon

A self-hosted Stremio addon for [streamed.st](https://streamed.st) live sports that serves **direct, playable HLS streams** instead of embed pages.

Stremio's player can't play streamed.st's embed pages directly — the underlying CDN (`strmd.st`) only serves playlists to requests carrying `Referer: https://embed.st/`, and its "secure" playlist tokens are single-client and short-lived. This addon runs on Cloudflare Workers and solves that:

- It resolves a fresh stream token by loading the embed player in a headless browser (**Cloudflare Browser Run**).
- It then proxies the tiny playlist requests with the required `Referer` header and rewrites them so segments stream **directly** from streamed's CDN — your Worker only ever handles the lightweight playlist refreshes, not video traffic.
- Tokens are cached in KV and transparently re-resolved when they rotate.

## Deploy to Cloudflare (one click)

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/st-barts/stremio-streamed-addon)

1. Click the button and sign in with your (free) Cloudflare account.
2. The KV namespace and Browser Run binding are provisioned automatically — accept the defaults and deploy.
3. Copy the `workers.dev` URL from the deployment.
4. In Stremio, add the addon using the URL: `{YOUR_WORKERS_DEV_URL}/manifest.json`

> Requires only a free Cloudflare account. Free-tier limits are sufficient for personal use (Browser Run: 10 min/day; KV: 100k reads/day).

## Manual deploy

If you prefer the CLI:

```bash
npm install
npx wrangler login
npx wrangler deploy
```

That's it — no resource setup needed. Wrangler auto-provisions the KV namespace on first deploy and writes its id back to `wrangler.jsonc`.

## Local development

```bash
npm install
CI=1 npx wrangler dev
```

`CI=1` is only needed on Linux without a usable Chrome sandbox — it makes the local dev browser launch with `--no-sandbox`. KV and the browser are simulated/provisioned locally, so no Cloudflare login is required.

Then test while a match is live:

```bash
curl "http://localhost:8787/m3u8/admin/ppv-napoli-vs-bologna/1.m3u8"
```

The first request takes ~5-10s (browser token resolution), subsequent playlist refreshes are fast. Paste the URL into VLC/mpv/Safari or any hls.js player to watch.

## How it works

```
Stremio ──/stream/tv/<id>.json──▶ returns url: <worker>/m3u8/<source>/<id>/<no>.m3u8 (instant)
Player ──/m3u8/...──▶ Worker:
    1. KV lookup of the resolved token URL (cached ~8 min)
    2. miss / 403 ──▶ Browser Run session:
         loads the embed player page, blocks the page's own playlist
         fetch (leaves the CDN token unbound), captures the playlist URL
    3. fetches the playlist with Referer: https://embed.st/ (binds the token to the Worker)
    4. rewrites variant paths to point back at the Worker, segments stay on the CDN
Player ──segments──▶ streamed's CDN directly (no auth needed)
```

## Self-Hosted Only

A deployed version of this addon is not available. You will need to deploy your own, which only requires a free Cloudflare account and a GitHub account.

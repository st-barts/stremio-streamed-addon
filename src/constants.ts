export const STREAMED_ORIGINS = [
  // These are the known origins for streamed's web app and API. We can use any of these to make requests to the API, as they all share the same backend.
  "https://streamed.pk",
  "https://streami.su",
  "https://streamed.st",
];

export const STREAMED_SPORTS_CATALOG_ID = "streamed-sports";
export const STREAMED_LIVE_SPORTS_CATALOG_ID = "streamed-live-sports";

// --- embed.st / strmd.st stream proxying ---

export const EMBED_HOST = "embed.st";

// The CDN serving the playlist rejects every playlist request without this exact Referer.
export const EMBED_REFERER = "https://embed.st/";
export const EMBED_ORIGIN = "https://embed.st";
export const EMBED_USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36";

// Only these hosts may be fetched through the generic playlist passthrough route.
export const STRMD_HOST_SUFFIX = ".strmd.st";

export const KV_TTL_SECONDS = 480; // safety cap; tokens usually die via 403 first
export const NEGATIVE_CACHE_TTL_SECONDS = 180; // remember failed resolutions so a dead match doesn't burn browser minutes

export const BROWSER_GOTO_TIMEOUT_MS = 30_000;
export const BROWSER_CAPTURE_TIMEOUT_MS = 25_000;
export const BROWSER_POLL_INTERVAL_MS = 500;

// Ad / tracker hosts; blocked inside the browser session so popups and
// analytics don't interfere with capturing the playlist URL.
export const AD_BLOCK_HOSTS = [
  "drawerexperienceletting.com",
  "therocketlanguages.com",
  "onepyrincehyarey.org",
  "histats.com",
  "s10.histats.com",
  "a.cdn-lab.shop",
  "ann.cdn-lab.shop",
  "static.cloudflareinsights.com",
  "google-analytics.com",
  "googletagmanager.com",
];

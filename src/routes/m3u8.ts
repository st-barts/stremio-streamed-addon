import { Hono } from "hono";
import type { Env } from "../interface";
import { resolveM3u8UrlDeduped } from "../browser";
import {
  EMBED_ORIGIN,
  EMBED_REFERER,
  EMBED_USER_AGENT,
  KV_TTL_SECONDS,
  NEGATIVE_CACHE_TTL_SECONDS,
  STRMD_HOST_SUFFIX,
} from "../constants";

/**
 * Proxied HLS for embed.st streams.
 *
 * Everything except segments must be fetched with `Referer: https://embed.st/`
 * and the "secure" playlist token binds to the first client that successfully
 * fetches the playlist — so this Worker is the only playlist client (end
 * players only ever see URLs on this Worker). Segment URLs are rewritten to
 * absolute CDN URLs which are served without any auth (verified).
 *
 * Playlist URLs handed to players never contain the raw token; instead they
 * reference `/m3u8/p/:source/:id/:no.m3u8?rel=...` so that on token rotation
 * the relative path can be re-applied to a freshly resolved master URL.
 */

interface CacheEntry {
  url: string;
}

const memCache = new Map<string, CacheEntry>();
const memDead = new Map<string, number>(); // key -> epoch ms until which resolves are skipped
const inflight = new Map<string, Promise<CacheEntry | null>>();

const DEAD_MARKER = "dead";

const isStrmdHost = (url: string): boolean => {
  try {
    return new URL(url).hostname.endsWith(STRMD_HOST_SUFFIX);
  } catch {
    return false;
  }
};

const proxyFetchHeaders = (): HeadersInit => ({
  Referer: EMBED_REFERER,
  Origin: EMBED_ORIGIN,
  "User-Agent": EMBED_USER_AGENT,
  Accept: "*/*",
});

async function fetchFromUpstream(url: string): Promise<Response> {
  return fetch(url, { headers: proxyFetchHeaders() });
}

/**
 * Resolves (with caching) the current master playlist URL for a stream key.
 * Resolutions that fail leave a negative-cache marker so a finished match
 * doesn't keep consuming Browser Run minutes.
 */
async function getMasterUrl(
  env: Env,
  key: string,
  embedUrl: string,
  allowDead: boolean,
): Promise<CacheEntry | null> {
  const deadUntil = memDead.get(key);
  if (deadUntil && Date.now() < deadUntil) return null;

  const mem = memCache.get(key);
  if (mem) return mem;

  const cached = await env.M3U8_CACHE.get(key);
  if (cached) {
    if (cached === DEAD_MARKER) {
      memDead.set(key, Date.now() + NEGATIVE_CACHE_TTL_SECONDS * 1000);
      return null;
    }
    const entry: CacheEntry = { url: cached };
    memCache.set(key, entry);
    return entry;
  }

  const resolved = await resolveAndStore(env, key, embedUrl, allowDead);
  return resolved;
}

async function resolveAndStore(
  env: Env,
  key: string,
  embedUrl: string,
  allowDead: boolean,
): Promise<CacheEntry | null> {
  const existingInflight = inflight.get(key);
  if (existingInflight) return existingInflight;

  const promise = (async (): Promise<CacheEntry | null> => {
    try {
      const url = await resolveM3u8UrlDeduped(env.BROWSER, embedUrl);
      const entry: CacheEntry = { url };
      memCache.set(key, entry);
      await env.M3U8_CACHE.put(key, url, { expirationTtl: KV_TTL_SECONDS });
      return entry;
    } catch (error) {
      console.error(`m3u8 resolve failed for ${key}: ${error}`);
      if (allowDead) {
        memDead.set(key, Date.now() + NEGATIVE_CACHE_TTL_SECONDS * 1000);
        await env.M3U8_CACHE.put(key, DEAD_MARKER, {
          expirationTtl: NEGATIVE_CACHE_TTL_SECONDS,
        });
      }
      return null;
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, promise);
  return promise;
}

function invalidate(env: Env, key: string): void {
  memCache.delete(key);
  env.M3U8_CACHE.delete(key).catch(() => {});
}

/**
 * Rewrites a GOAT-processed playlist so that:
 *  - relative/absolute references to other playlists (`*.m3u8`) are routed
 *    through the passthrough route (they need the Referer header), keeping
 *    their path relative to the master so token rotation stays possible;
 *  - segment references are resolved to absolute CDN URLs and passed through
 *    untouched (segments are served without auth).
 */
function rewritePlaylist(
  body: string,
  upstreamUrl: string,
  masterUrl: string,
  selfOrigin: string,
  routeBase: string,
): string {
  const masterDir = new URL(".", masterUrl).href; // .../1/

  const toProxyPath = (target: string): string | null => {
    if (!target.toLowerCase().endsWith(".m3u8")) return null;
    // Only same-host playlists can be re-derived from a re-resolved master.
    const u = new URL(target);
    if (u.hostname.endsWith(STRMD_HOST_SUFFIX) && u.href.startsWith(masterDir)) {
      const rel = u.href.slice(masterDir.length);
      return `${selfOrigin}${routeBase}?rel=${encodeURIComponent(rel)}`;
    }
    // Different host/shape: proxy by absolute URL (no re-resolution support).
    return `${selfOrigin}${routeBase}?u=${encodeURIComponent(target)}`;
  };

  return body
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return line;

      if (trimmed.startsWith("#EXT-X-KEY") || trimmed.startsWith("#EXT-X-MAP")) {
        return line.replace(/URI="([^"]*)"/, (m, uri) => {
          const abs = new URL(uri, upstreamUrl).href;
          const proxied = toProxyPath(abs);
          return `URI="${proxied ?? abs}"`;
        });
      }

      if (trimmed.startsWith("#")) return line;

      const abs = new URL(trimmed, upstreamUrl).href;
      const proxied = toProxyPath(abs);
      return proxied ?? abs;
    })
    .join("\n");
}

const PLAYLIST_HEADERS = {
  "content-type": "application/vnd.apple.mpegurl",
  "cache-control": "no-store, max-age=0",
};

const m3u8 = new Hono<{ Bindings: Env }>();

// Entry point handed to players. `<source>/<id>/<no>` map 1:1 to the
// streamed.st API's embedUrl (https://embed.st/embed/<source>/<id>/<no>).
m3u8.get("/:source/:id/:no{([^/]*)\\.m3u8}", async (c) => {
  const { source, id, no } = c.req.param();
  const streamNo = no.replace(/\.m3u8$/, "");
  const key = `${source}:${id}:${streamNo}`;
  const embedUrl = `https://embed.st/embed/${source}/${id}/${streamNo}`;

  const entry = await getMasterUrl(c.env, key, embedUrl, true);
  if (!entry) {
    return c.text("Stream is not available right now", 503);
  }

  let upstream = entry.url;
  let res = await fetchFromUpstream(upstream);
  if (!res.ok) {
    // Token expired / rotated / bound elsewhere: resolve a fresh one and retry.
    invalidate(c.env, key);
    const fresh = await getMasterUrl(c.env, key, embedUrl, true);
    if (!fresh) return c.text("Stream is not available right now", 503);
    upstream = fresh.url;
    res = await fetchFromUpstream(upstream);
    if (!res.ok) {
      return c.text(`Upstream responded ${res.status}`, 502);
    }
  }

  const body = await res.text();
  const selfOrigin = new URL(c.req.url).origin;
  const routeBase = `/m3u8/p/${source}/${id}/${streamNo}.m3u8`;
  const rewritten = rewritePlaylist(body, upstream, upstream, selfOrigin, routeBase);
  return new Response(rewritten, { headers: PLAYLIST_HEADERS });
});

// Generic playlist passthrough for variant playlists discovered inside a
// rewritten playlist. Either `rel` (path relative to the current master URL)
// or `u` (absolute strmd.st URL) identifies the upstream target.
m3u8.get("/p/:source/:id/:no{([^/]*)\\.m3u8}", async (c) => {
  const { source, id, no } = c.req.param();
  const streamNo = no.replace(/\.m3u8$/, "");
  const key = `${source}:${id}:${streamNo}`;
  const embedUrl = `https://embed.st/embed/${source}/${id}/${streamNo}`;

  const rel = c.req.query("rel");
  const abs = c.req.query("u");

  let target: string;
  let masterUrl: string;

  if (rel) {
    const entry = await getMasterUrl(c.env, key, embedUrl, true);
    if (!entry) return c.text("Stream is not available right now", 503);
    masterUrl = entry.url;
    target = new URL(rel, new URL(".", masterUrl).href).href;
  } else if (abs && isStrmdHost(abs)) {
    target = abs;
    masterUrl = target;
  } else {
    return c.text("Bad request", 400);
  }

  let res = await fetchFromUpstream(target);

  // Token rotation: re-resolve the master and re-apply the relative path.
  if (!res.ok && rel) {
    invalidate(c.env, key);
    const fresh = await getMasterUrl(c.env, key, embedUrl, true);
    if (fresh) {
      const retryTarget = new URL(rel, new URL(".", fresh.url).href).href;
      const retry = await fetchFromUpstream(retryTarget);
      if (retry.ok) {
        target = retryTarget;
        masterUrl = fresh.url;
        res = retry;
      }
    }
  }

  if (!res.ok) {
    return c.text(`Upstream responded ${res.status}`, 502);
  }

  const body = await res.text();
  const selfOrigin = new URL(c.req.url).origin;
  const routeBase = `/m3u8/p/${source}/${id}/${streamNo}.m3u8`;
  const rewritten = rewritePlaylist(body, target, masterUrl, selfOrigin, routeBase);
  return new Response(rewritten, { headers: PLAYLIST_HEADERS });
});

export default m3u8;

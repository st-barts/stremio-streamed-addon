import { Buffer } from "node:buffer";
import puppeteer, { type BrowserWorker, type Page } from "@cloudflare/puppeteer";
import {
  AD_BLOCK_HOSTS,
  BROWSER_CAPTURE_TIMEOUT_MS,
  BROWSER_GOTO_TIMEOUT_MS,
  BROWSER_POLL_INTERVAL_MS,
  EMBED_USER_AGENT,
} from "./constants";

/**
 * Resolves the direct playlist URL for an embed.st stream.
 *
 * The playlist URL (`https://lb<N>.strmd.st/secure/<TOKEN>/...playlist.m3u8`)
 * is produced by obfuscated `lock.js` + `lock.wasm` running inside the
 * embed.st player page. Rather than reversing that, we load the player page
 * in a Cloudflare Browser Run session, hook fetch/XHR, and capture the
 * playlist URL the player issues.
 *
 * Critical detail: the in-page m3u8 fetch is *rejected* by the hook. The
 * "secure" token binds to the first client that successfully fetches the
 * playlist, so by blocking the browser we leave the token virgin for the
 * Worker itself to bind (with the Referer header) in the proxy route.
 */

const STREAMED_PHP_PATTERN = /https?:\/\/rockystream\.st\/source\/streamed1\.php\?[^"']+/;
const DATA_SOURCE_PATTERN = /data-source="([A-Za-z0-9+/=]+)"/;
const PLAYER_PAGE_MARKER = /id="player"/;

/**
 * Builds the player page URL for an embedUrl.
 *
 * Two page shapes exist:
 *  1. Channel pages (e.g. `embed.st/embed/golf/1179/1`) that embed a
 *     `rockystream.st/source/streamed1.php` iframe, whose HTML contains a
 *     base64 `data-source` attribute with the player URL.
 *  2. Direct player pages (e.g. `embed.st/embed/admin/<id>/1`) that already
 *     contain the `<div id="player">` markup.
 */
export async function derivePlayerUrl(embedUrl: string): Promise<string> {
  const html = await (
    await fetch(embedUrl, { headers: { "User-Agent": EMBED_USER_AGENT } })
  ).text();

  const streamedUrl = html.match(STREAMED_PHP_PATTERN)?.[0];
  if (streamedUrl) {
    const inner = await (
      await fetch(streamedUrl, { headers: { "User-Agent": EMBED_USER_AGENT } })
    ).text();
    const encoded = inner.match(DATA_SOURCE_PATTERN)?.[1];
    if (encoded) {
      return Buffer.from(encoded, "base64").toString("utf8");
    }
    throw new Error(`Could not find data-source in streamed1 page for ${embedUrl}`);
  }

  if (PLAYER_PAGE_MARKER.test(html)) {
    return embedUrl;
  }

  throw new Error(`Unknown embed page structure for ${embedUrl}`);
}

/**
 * Injected before any page script runs. Records every m3u8 URL requested
 * through fetch/XHR into `window.__m3u8Urls` while *rejecting* those requests
 * (leaves the token unbound). Also rejects requests to known ad/tracker hosts.
 */
const CAPTURE_HOOK_SOURCE = `(function () {
  window.__m3u8Urls = [];
  var blocked = ${JSON.stringify(AD_BLOCK_HOSTS)};
  function isBlocked(u) {
    try {
      var h = (new URL(u, location.href)).hostname;
      return blocked.some(function (b) { return h === b || h.endsWith("." + b); });
    } catch (e) { return false; }
  }
  function record(u) {
    try {
      if (u && String(u).indexOf(".m3u8") !== -1 && window.__m3u8Urls.indexOf(u) === -1) {
        window.__m3u8Urls.push(String(u));
      }
    } catch (e) {}
  }
  var nativeFetch = window.fetch;
  window.fetch = function (input, init) {
    try {
      var u = typeof input === "string" ? input : (input && input.url) || "";
      record(u);
      if (String(u).indexOf(".m3u8") !== -1 || isBlocked(u)) {
        return Promise.reject(new TypeError("blocked"));
      }
    } catch (e) {}
    return nativeFetch.apply(this, arguments);
  };
  var nativeOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url) {
    try {
      record(url);
      if (String(url).indexOf(".m3u8") !== -1 || isBlocked(String(url))) {
        throw new Error("blocked");
      }
    } catch (e) {}
    return nativeOpen.apply(this, arguments);
  };
})();`;

/**
 * Runs the player page and captures the playlist URL.
 *
 * Blocking happens at the network layer via `Network.setBlockedURLs` (covers
 * fetches from web workers, which the in-page hook cannot reach); the
 * in-page hook additionally records URLs and rejects ad-host requests.
 * Capture channels: the page buffer and CDP request events.
 */
async function captureM3u8FromPage(page: Page, playerUrl: string): Promise<string> {
  const cdp = await page.createCDPSession();
  await cdp.send("Network.enable", {});
  await cdp.send("Network.setBlockedURLs", {
    urls: ["*.m3u8", "*.m3u8*", ...AD_BLOCK_HOSTS.map((h) => `*${h}/*`)],
  });

  const cdpUrls: string[] = [];
  cdp.on("Network.requestWillBeSent", (params: { request?: { url?: string } }) => {
    const url = params?.request?.url;
    if (url && url.includes(".m3u8") && !cdpUrls.includes(url)) {
      cdpUrls.push(url);
    }
  });

  try {
    await page.evaluateOnNewDocument(CAPTURE_HOOK_SOURCE);
  } catch {
    await cdp.send("Page.addScriptToEvaluateOnNewDocument", {
      source: CAPTURE_HOOK_SOURCE,
    });
  }

  await page.goto(playerUrl, {
    waitUntil: "domcontentloaded",
    timeout: BROWSER_GOTO_TIMEOUT_MS,
  });

  const deadline = Date.now() + BROWSER_CAPTURE_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const inPage = (await page.evaluate(
      "window.__m3u8Urls && window.__m3u8Urls[0]",
    )) as string | undefined;
    if (inPage) return inPage;
    if (cdpUrls[0]) return cdpUrls[0];
    await new Promise((r) => setTimeout(r, BROWSER_POLL_INTERVAL_MS));
  }
  if (cdpUrls[0]) return cdpUrls[0];
  throw new Error(`Timed out capturing m3u8 URL for ${playerUrl}`);
}

export async function resolveM3u8Url(
  browser: BrowserWorker,
  embedUrl: string,
): Promise<string> {
  const playerUrl = await derivePlayerUrl(embedUrl);

  let browserSession;
  try {
    browserSession = await puppeteer.launch(browser);
    const page = await browserSession.newPage();
    page.on("dialog", (d) => {
      d.dismiss().catch(() => {});
    });

    return await captureM3u8FromPage(page, playerUrl);
  } finally {
    if (browserSession) {
      await browserSession.close().catch(() => {});
    }
  }
}

// Module-level per-isolate dedupe so concurrent requests for the same stream
// share one browser session instead of racing the concurrency limits.
const inflight = new Map<string, Promise<string>>();

export function resolveM3u8UrlDeduped(
  browser: BrowserWorker,
  embedUrl: string,
): Promise<string> {
  const existing = inflight.get(embedUrl);
  if (existing) return existing;

  const promise = resolveM3u8Url(browser, embedUrl).finally(() => {
    inflight.delete(embedUrl);
  });
  inflight.set(embedUrl, promise);
  return promise;
}

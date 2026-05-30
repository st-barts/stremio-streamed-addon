import { type Context, Hono } from "hono";
import {
  STREAMED_LIVE_SPORTS_CATALOG_ID,
  STREAMED_SPORTS_CATALOG_ID,
} from "../constants";
import { fetchFromStreamed, doubleBase64UrlEncode } from "../util";
import type { APIMatch } from "../interface";

const catalog = new Hono();

const getCatalog = async (
  c: Context,
  endpoint: string,
  matchedCatalogId: string,
) => {
  const { origin, data } = await fetchFromStreamed<APIMatch[]>(endpoint);

  return c.json({
    metas: data.map((match) => {
      const poster = match.poster ? `${origin}${match.poster}` : "";

      return {
        id: `${matchedCatalogId}-${doubleBase64UrlEncode(match.title, match.id, poster)}`,
        type: "tv",
        name: match.title,
        ...(poster && { poster }),
        posterShape: "landscape",
      };
    }),
  });
};

catalog.get(`/tv/${STREAMED_LIVE_SPORTS_CATALOG_ID}.json`, async (c) => {
  return getCatalog(c, "/api/matches/live", STREAMED_LIVE_SPORTS_CATALOG_ID);
});

catalog.get(`/tv/${STREAMED_SPORTS_CATALOG_ID}.json`, async (c) => {
  return getCatalog(c, "/api/matches/all", STREAMED_SPORTS_CATALOG_ID);
});

catalog.get(
  `/tv/${STREAMED_SPORTS_CATALOG_ID}/:genreRaw{genre=(.*).json}`,
  async (c) => {
    const genreRaw = c.req.param("genreRaw"); // "genre=football.json"
    const genre = genreRaw.match(/^genre=(.+)\.json$/)?.[1]; // "football"

    return getCatalog(c, `/api/matches/${genre}`, STREAMED_SPORTS_CATALOG_ID);
  },
);

export default catalog;

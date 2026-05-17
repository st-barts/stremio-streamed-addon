import { type Context, Hono } from "hono";
import {
  STREAMED_LIVE_SPORTS_CATALOG_ID,
  STREAMED_SPORTS_CATALOG_ID,
} from "../constants";
import { fetchFromStreamed } from "../util";

const catalog = new Hono();

// https://streamed.pk/docs/matches
interface APIMatch {
  id: string; // Unique identifier for the match
  title: string; // Match title (e.g. "Team A vs Team B")
  category: string; // Sport category (e.g. "football", "basketball")
  date: number; // Unix timestamp in milliseconds
  poster?: string; // URL path to match poster image
  popular: boolean; // Whether the match is marked as popular
  teams?: {
    home?: {
      name: string; // Home team name
      badge: string; // URL path to home team badge
    };
    away?: {
      name: string; // Away team name
      badge: string; // URL path to away team badge
    };
  };
  sources: {
    source: string; // Stream source identifier (e.g. "alpha", "bravo")
    id: string; // Source-specific match ID
  }[];
}

const getCatalog = async (
  c: Context,
  endpoint: string,
  matchedCatalogId: string,
) => {
  const { origin, data } = await fetchFromStreamed<APIMatch[]>(endpoint);

  return c.json({
    metas: data.map((match) => ({
      id: `${matchedCatalogId}-${match.id}`,
      type: "tv",
      name: match.title,
      poster: `${origin}${match.poster}`,
      posterShape: "landscape",
    })),
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

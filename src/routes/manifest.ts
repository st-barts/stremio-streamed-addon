import { Hono } from "hono";
import {
  STREAMED_LIVE_SPORTS_CATALOG_ID,
  STREAMED_SPORTS_CATALOG_ID,
} from "../constants";
import { fetchFromStreamed } from "../util";

const manifest = new Hono();

interface Sport {
  id: string; // Sport identifier (used in Matches API endpoints)
  name: string; // Display name of the sport
}

const idPrefixes = [
  STREAMED_SPORTS_CATALOG_ID,
  STREAMED_LIVE_SPORTS_CATALOG_ID,
];

manifest.get("/manifest.json", async (c) => {
  const { data: sports } = await fetchFromStreamed<Sport[]>("/api/sports");

  return c.json({
    id: "app.stbarts.stremio-streamed-addon",
    version: "0.0.1",
    name: "Streamed Live Sports",
    description: "A Stremio addon that serves live streams from streamed",
    logo: "https://i.imgur.com/1D9ATvf.png",
    resources: [
      "catalog",
      { name: "stream", types: ["tv"], idPrefixes },
      { name: "meta", types: ["tv"], idPrefixes },
    ],
    types: ["tv"],
    catalogs: [
      {
        type: "tv",
        id: STREAMED_SPORTS_CATALOG_ID,
        name: "Streamed Sports",
        extra: [
          {
            name: "genre",
            isRequired: false,
            options: sports.map((sport) => sport.id),
          },
        ],
      },
      {
        type: "tv",
        id: STREAMED_LIVE_SPORTS_CATALOG_ID,
        name: "Streamed Sports [LIVE]",
      },
    ],
    idPrefixes,
  });
});

export default manifest;

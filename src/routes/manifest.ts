import { Hono } from "hono";

const manifest = new Hono();

manifest.get("/manifest.json", (c) => {
  return c.json({
    id: "app.stbarts.stremio-streamed-addon",
    version: "0.0.1",
    name: "Streamed Live Sports",
    description: "A Stremio addon that serves live streams from streamed",
    resources: ["catalog", "stream"],
    types: ["tv"],
    catalogs: [
      {
        type: "tv",
        id: "streamed-live-sports",
      },
    ],
    idPrefixes: ["streamed-live-sports"],
  });
});

export default manifest;

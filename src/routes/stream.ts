import { Hono } from "hono";
import { fetchFromStreamed } from "../util";

const stream = new Hono();

stream.get("/tv/:matchIdRaw{(.*).json}", async (c) => {
  const matchIdRaw = c.req.param("matchIdRaw"); // "streamed-sports-12345.json"
  const matchId = matchIdRaw.match(/^(.+)\.json$/)?.[1]; // "streamed-sports-12345"

  // const { origin, data } = await fetchFromStreamed(`/api/matches/${matchId}`);

  return c.json({
    streams: [
      {
        name: "Stream Title",
        description: "Stream Description",
        url: "https://wip.com",
        behaviorHints: { notWebReady: true },
      },
    ],
  });
});

export default stream;

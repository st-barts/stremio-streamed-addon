import { Hono } from "hono";
import { fetchFromStreamed } from "../util";

const meta = new Hono();

meta.get("/tv/:matchIdRaw{(.*).json}", async (c) => {
  const matchIdRaw = c.req.param("matchIdRaw"); // "streamed-sports-12345.json"
  const matchId = matchIdRaw.match(/^(.+)\.json$/)?.[1]; // "streamed-sports-12345"

  // const { origin, data } = await fetchFromStreamed(`/api/matches/${matchId}`);

  return c.json({
    meta: {
      id: matchId,
      name: "Match Title",
      type: "tv",
    },
  });
});

export default meta;

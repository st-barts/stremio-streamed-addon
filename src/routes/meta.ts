import { Hono } from "hono";
import { doubleBase64UrlDecode, fetchFromStreamed } from "../util";

const meta = new Hono();

meta.get("/tv/:matchIdRaw{(.*).json}", async (c) => {
  const matchIdRaw = c.req.param("matchIdRaw"); // "streamed-sports-12345.json"
  const matchId = matchIdRaw.match(/^(.+)\.json$/)?.[1]; // "streamed-sports-12345"

  const matchData = matchId?.split("-").at(-1);
  if (!matchData) {
    throw new Error("Cannot find the match data");
  }
  const [matchTitle, _, matchPoster] = doubleBase64UrlDecode(matchData);

  return c.json({
    meta: {
      id: matchId,
      name: matchTitle,
      ...(matchPoster && { background: matchPoster }),
      type: "tv",
    },
  });
});

export default meta;

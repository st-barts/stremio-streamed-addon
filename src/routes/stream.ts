import { Hono } from "hono";
import { fetchFromStreamed, doubleBase64UrlDecode } from "../util";
import { APIMatch } from "../interface";

const stream = new Hono();

interface APIStream {
  id: string;
  streamNo: number;
  language: string;
  hd: boolean;
  embedUrl: string;
  source: string;
}

stream.get("/tv/:matchIdRaw{(.*).json}", async (c) => {
  const matchIdRaw = c.req.param("matchIdRaw"); // "streamed-sports-12345.json"
  const matchId = matchIdRaw.match(/^(.+)\.json$/)?.[1]; // "streamed-sports-12345"

  const matchData = matchId?.split("-").at(-1);
  if (!matchData) {
    throw new Error("Cannot find the match data");
  }
  const [_, matchIdentifier] = doubleBase64UrlDecode(matchData);

  const allMatches = await fetchFromStreamed<APIMatch[]>("/api/matches/all");
  const currentMatch = allMatches.data.find((e) => e.id === matchIdentifier);

  if (!currentMatch) {
    throw new Error(`Cannot find match with identifier: ${matchIdentifier}`);
  }

  return c.json({
    streams: (
      await Promise.all(
        currentMatch.sources.map((source) =>
          fetchFromStreamed<APIStream[]>(
            `/api/stream/${source.source}/${source.id}`,
          ),
        ),
      )
    ).flatMap(({ data: streams }) =>
      streams.map((stream) => ({
        name: stream.source,
        ...(stream.hd && { description: "HD ✨" }),
        externalUrl: stream.embedUrl,
        behaviorHints: { notWebReady: true },
      })),
    ),
  });
});

export default stream;

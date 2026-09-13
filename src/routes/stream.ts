import { Hono } from "hono";
import { fetchFromStreamed, doubleBase64UrlDecode } from "../util";
import { APIMatch, Env } from "../interface";
import { EMBED_HOST } from "../constants";

const stream = new Hono<{ Bindings: Env }>();

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
    return c.json({ streams: [] });
  }

  const origin = new URL(c.req.url).origin;

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
      streams.map((stream) => {
        const embed = new URL(stream.embedUrl);
        const description = [stream.language, stream.hd ? "HD ✨" : null]
          .filter((part): part is string => Boolean(part))
          .join(" · ");

        if (embed.hostname !== EMBED_HOST) {
          // Unknown embed host: fall back to opening the page in a browser.
          return {
            name: stream.source,
            ...(description && { description }),
            externalUrl: stream.embedUrl,
            behaviorHints: { notWebReady: true },
          };
        }

        // https://embed.st/embed/<source>/<id>/<streamNo> → ["", "embed", src, id, no]
        const [, , src, id, no] = embed.pathname.split("/");
        return {
          name: stream.source,
          ...(description && { description }),
          url: `${origin}/m3u8/${src}/${id}/${no}.m3u8`,
          behaviorHints: {
            notWebReady: true,
            bingeGroup: `streamed-${stream.source}-${stream.streamNo}`,
          },
        };
      }),
    ),
  });
});

export default stream;

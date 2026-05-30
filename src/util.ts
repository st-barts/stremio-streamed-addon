import { STREAMED_ORIGINS } from "./constants";
import { Buffer } from "node:buffer";

export const fetchFromStreamed = async <T>(
  endpoint: string,
): Promise<{ origin: string; data: T }> => {
  for (const origin of STREAMED_ORIGINS) {
    try {
      const response = await fetch(`${origin}${endpoint}`);
      if (response.ok) {
        return { origin, data: (await response.json()) as T };
      }
    } catch (error) {
      console.log(`Error fetching from ${origin}: ${error}`);
      // Ignore and try the next origin
    }
  }

  throw new Error(`Failed to fetch from Streamed API: All origins failed`);
};

const base64UrlEncode = (value: string): string =>
  Buffer.from(value, "utf8").toString("base64url");

const base64UrlDecode = (value: string): string =>
  Buffer.from(value, "base64url").toString("utf8");

/**
 * Double base 64 url encodes the values.
 * 1. First with encoded-encoded-encoded....
 * 2. Then encodes the final string with hyphens "-" once more
 */
export const doubleBase64UrlEncode = (...values: string[]): string =>
  base64UrlEncode(values.map((val) => base64UrlEncode(val)).join("-"));

/**
 * Double base 64 url decode the value.
 * 1. First decodes the whole string.
 * 2. Seperates with hyphen "-" separators
 * 3. Base 63 url decodes each one
 */
export const doubleBase64UrlDecode = (value: string): string[] =>
  base64UrlDecode(value)
    .split("-")
    .map((val) => base64UrlDecode(val));

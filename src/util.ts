import { STREAMED_ORIGINS } from "./constants";

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

// https://streamed.pk/docs/matches
export interface APIMatch {
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

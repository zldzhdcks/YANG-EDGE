/** Owner-only 1X2 market comparison. Never feeds odds into V1/H2/R1. */
export const MARKET_SCHEMA = "FOOTBALL_V31_INTERNAL_MARKET_COMPARISON_V1";
export const MARKET_TYPE = "1X2_ONLY" as const;
export const ROUND_IDENTITY_CONFIRMED = "NO" as const;
export const MARKET_INPUT_TO_MODEL = "NO" as const;
export const TOTALS_RECOMMENDATION_ENABLED = "NO" as const;
export const HANDICAP_COMPARISON_ENABLED = "NO" as const;
export const MARKET_DISCLAIMER = "Market screenshot evidence; not current live odds.";
export const RELATIVE_DEFAULT_MARKET_FILE = [
  "..",
  "YANG-EDGE-INBOX",
  "football-v31-internal-market-comparison-v1",
  "owner-only-1x2-v1.json",
].join("/");

export type MarketKind = "1X2" | "TOTAL" | "HANDICAP";
export type Selection = "HOME" | "DRAW" | "AWAY";

export type OwnerOnlyMarketRow = {
  fixtureId: number;
  leagueId: number;
  season: number;
  kickoffUtc: string;
  homeTeamId: number;
  awayTeamId: number;
  observedAt: string;
  marketType: MarketKind;
  line: string | null;
  selection: Selection | "HOME_DRAW_AWAY" | "OVER" | "UNDER" | "HANDICAP_HOME" | "HANDICAP_AWAY";
  odds: {home: number | null; draw: number | null; away: number | null};
  sourceSha256: string;
  roundIdentityConfirmed: false;
  captureTimeVerified: false;
};

export type Normalized1x2 =
  | {
      status: "OK";
      raw: {home: number; draw: number; away: number};
      normalized: {home: number; draw: number; away: number};
    }
  | {status: "MISSING"}
  | {status: "MALFORMED"};

export type ModelDelta = {
  home: number | null;
  draw: number | null;
  away: number | null;
  fairOdds: {home: number | null; draw: number | null; away: number | null};
};

export type MarketComparisonView = {
  status:
    | "MATCHED"
    | "MARKET_ABSENT"
    | "MARKET_IDENTITY_UNCERTAIN"
    | "MARKET_INCOMPLETE"
    | "MARKET_MALFORMED";
  marketType: typeof MARKET_TYPE;
  roundIdentityConfirmed: typeof ROUND_IDENTITY_CONFIRMED;
  captureTimeUnverified: true;
  observedAt: string | null;
  homeOdds: number | null;
  drawOdds: number | null;
  awayOdds: number | null;
  impliedRaw: {home: number; draw: number; away: number} | null;
  impliedNormalized: {home: number; draw: number; away: number} | null;
  v1: ModelDelta | null;
  h2: ModelDelta | null;
  r1: ModelDelta | null;
  totalsComparisonEnabled: typeof TOTALS_RECOMMENDATION_ENABLED;
  handicapComparisonEnabled: typeof HANDICAP_COMPARISON_ENABLED;
};

export type MarketSummary = {
  matched: number;
  unmatched: number;
  identityBlocked: number;
};

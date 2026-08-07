/**
 * MLB Korean Market Odds Observation v0
 * Operator pregame moneyline observation — independent from Provider odds.
 * Never mutates Prediction / Recommendation / Engine / Provider odds.
 */

export const MLB_KOREAN_MARKET_ODDS_OBSERVATION_SCHEMA =
  "mlb-korean-market-odds-observation-v0" as const;

export type MlbKoreanMarketSourceType = "MANUAL_OBSERVATION";
export type MlbKoreanMarketType = "MONEYLINE";
export type MlbKoreanMarketContext = "KOREAN_MARKET";

export type MlbKoreanJoinStatus =
  | "MATCHED"
  | "JOIN_REVIEW_REQUIRED"
  | "NOT_MATCHED";

export type MlbKoreanObservationStatus =
  | "PRE_GAME_OBSERVATION"
  | "LATE_OBSERVATION"
  | "UNKNOWN";

export type MlbKoreanMarketOddsGameV0 = {
  gamePk: number;
  internalGameId: string;
  awayTeam: string;
  homeTeam: string;
  awayOdds: number | null;
  homeOdds: number | null;
  /** Presentation-only — NOT model probability. */
  awayImpliedProbability: number | null;
  homeImpliedProbability: number | null;
  firstPitchAt: string | null;
  observedAt: string | null;
  isBeforeFirstPitch: boolean | null;
  joinStatus: MlbKoreanJoinStatus;
  observationStatus: MlbKoreanObservationStatus | null;
};

export type MlbKoreanMarketOddsObservationV0 = {
  schemaVersion: typeof MLB_KOREAN_MARKET_ODDS_OBSERVATION_SCHEMA;
  dateKst: string;
  league: "MLB";
  sourceType: MlbKoreanMarketSourceType;
  marketContext: MlbKoreanMarketContext;
  marketType: MlbKoreanMarketType;
  sourceLabel: string;
  observedAt: string;
  enteredBy: "OPERATOR";
  note: string;
  koreanMarketOddsHash: string;
  games: MlbKoreanMarketOddsGameV0[];
  summary: {
    scheduleGames: number;
    matchedGames: number;
    observedGames: number;
    missingGames: number;
    lateGames: number;
    joinReviewRequired: number;
    preGameObservations: number;
  };
};

export type MlbKoreanMarketOddsDraftGame = {
  gamePk: number;
  awayOdds: number | string | null;
  homeOdds: number | string | null;
  /** When true, force JOIN_REVIEW_REQUIRED and reject save of odds. */
  joinReviewRequired?: boolean;
};

export type MlbKoreanMarketPanelV0 = {
  available: boolean;
  sourceLabel: string;
  marketContext: "KOREAN_MARKET";
  observationStatus: string | null;
  awayTeam: string;
  homeTeam: string;
  awayOdds: number | null;
  homeOdds: number | null;
  awayImpliedProbability: number | null;
  homeImpliedProbability: number | null;
};

export type MlbProviderMarketPanelV0 = {
  available: boolean;
  sourceLabel: string;
  awayTeam: string;
  homeTeam: string;
  awayOdds: number | null;
  homeOdds: number | null;
  awayImpliedProbability: number | null;
  homeImpliedProbability: number | null;
};

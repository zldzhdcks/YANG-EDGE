/**
 * NPB Manual Market Odds Intake v0 — Moneyline only.
 * Operator overlay. Does not mutate Provider odds / Engine / Prediction.
 */

export const NPB_MARKET_ODDS_CONFIRMATION_SCHEMA =
  "npb-market-odds-confirmation-v0" as const;

export type NpbMarketOddsSourceType = "MANUAL_VERIFIED";

export type NpbMarketType = "MONEYLINE";

export type NpbGameJoinStatus = "MATCHED" | "AMBIGUOUS" | "NOT_MATCHED";

export type NpbOddsUiStatus =
  | "VERIFIED"
  | "MISSING"
  | "LATE"
  | "JOIN_ERROR"
  | "INVALID";

export type NpbMarketOddsGameV0 = {
  internalGameId: string;
  awayTeam: string;
  homeTeam: string;
  awayTeamCanonicalId: string | null;
  homeTeamCanonicalId: string | null;
  awayOdds: number | null;
  homeOdds: number | null;
  /** Presentation-only implied probs — NOT model probability. */
  awayImpliedProbability: number | null;
  homeImpliedProbability: number | null;
  verifiedAt: string | null;
  firstPitchAt: string | null;
  isBeforeFirstPitch: boolean | null;
  cutoffLabel: "PRE_GAME_VERIFIED" | "LATE_OPERATOR_INPUT" | "UNKNOWN" | null;
  joinStatus: NpbGameJoinStatus;
  uiStatus: NpbOddsUiStatus;
};

export type NpbMarketOddsConfirmationV0 = {
  schemaVersion: typeof NPB_MARKET_ODDS_CONFIRMATION_SCHEMA;
  dateKst: string;
  league: "NPB";
  market: NpbMarketType;
  sourceType: NpbMarketOddsSourceType;
  sourceLabel: string;
  verifiedAt: string;
  enteredBy: "OPERATOR";
  games: NpbMarketOddsGameV0[];
  summary: {
    scheduleGames: number;
    matchedGames: number;
    moneylineVerified: number;
    missing: number;
    lateGames: number;
    joinErrors: number;
    preGameVerifiedGames: number;
  };
};

export type NpbMarketOddsDraftGame = {
  internalGameId: string;
  awayOdds: number | string | null;
  homeOdds: number | string | null;
};

export type NpbPregameResearchReadiness = {
  dateKst: string;
  schedule: { ready: number; total: number; line: string };
  starter: { ready: number; total: number; line: string };
  marketOdds: { ready: number; total: number; line: string };
  lineup: { ready: number; total: number; line: string };
  prediction: { status: string; line: string };
  evidenceSnapshot?: {
    frozen: boolean;
    status: string;
    line: string;
    hashShort: string | null;
  };
};

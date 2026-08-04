/**
 * Football 1X2 Odds Foundation v0 — types & contracts.
 * Prediction / Engine NOT connected.
 */

import type { FootballOsLevel } from "../foundation/types";

export const FOOTBALL_ODDS_FOUNDATION_VERSION = "football-odds-foundation-v0" as const;

/** Only market allowed for future Prediction target. */
export const FOOTBALL_PREDICTION_MARKET = "MONEYLINE_3WAY_1X2" as const;

export type FootballPredictionMarket = typeof FOOTBALL_PREDICTION_MARKET;

export type FootballCollectOnlyMarket =
  | "TOTALS_OVER_UNDER"
  | "ASIAN_HANDICAP"
  | "BTTS"
  | "DOUBLE_CHANCE"
  | "DRAW_NO_BET"
  | "CORRECT_SCORE"
  | "FIRST_HALF"
  | "DOMESTIC_SPECIAL";

export const FOOTBALL_COLLECT_ONLY_MARKETS: FootballCollectOnlyMarket[] = [
  "TOTALS_OVER_UNDER",
  "ASIAN_HANDICAP",
  "BTTS",
  "DOUBLE_CHANCE",
  "DRAW_NO_BET",
  "CORRECT_SCORE",
  "FIRST_HALF",
  "DOMESTIC_SPECIAL",
];

export type FootballOddsSourceType =
  | "OVERSEAS_PROVIDER"
  | "DOMESTIC_OPERATOR"
  | "ADMIN_MANUAL_SCREENSHOT";

export type FootballOddsCommercialUse =
  | "INTERNAL_ONLY"
  | "LICENSED"
  | "UNKNOWN";

export type FootballOddsSourceNamespace = "OVERSEAS" | "DOMESTIC";

export type FootballOneXTwoRowStatus =
  | "COLLECTED"
  | "PARTIAL"
  | "NOT_COLLECTED"
  | "AFTER_CUTOFF"
  | "IDENTITY_UNRESOLVED"
  | "INVALID_ODDS";

export type FootballOneXTwoOddsRow = {
  matchId: string;
  identityHash: string;
  provider: string;
  fixtureId: string;
  competitionId: string;
  homeTeamId: string;
  awayTeamId: string;
  bookmakerId: string | null;
  marketType: FootballPredictionMarket;
  homeDecimal: number | null;
  drawDecimal: number | null;
  awayDecimal: number | null;
  capturedAt: string;
  commenceTime: string;
  sourceType: FootballOddsSourceType;
  sourceNamespace: FootballOddsSourceNamespace;
  commercialUseStatus: FootballOddsCommercialUse;
  format: "DECIMAL";
  status: FootballOneXTwoRowStatus;
};

export type FootballCollectOnlyOddsRow = {
  matchId: string;
  identityHash: string;
  provider: string;
  fixtureId: string;
  marketType: FootballCollectOnlyMarket;
  /** Opaque payload — never Prediction-eligible */
  payload: Record<string, unknown>;
  capturedAt: string;
  commenceTime: string;
  sourceNamespace: FootballOddsSourceNamespace;
  status: "COLLECT_ONLY";
  predictionEligible: false;
};

/**
 * Explicit overround thresholds — not hidden.
 * overround := rawHome + rawDraw + rawAway (mission definition).
 */
export const FOOTBALL_1X2_OVERROUND_CONFIG = {
  /** Typical bookmaker sum of implied probs */
  warnBelow: 1.0,
  warnAbove: 1.12,
  blockBelow: 0.95,
  blockAbove: 1.25,
  /** |devigHome+devigDraw+devigAway - 1| must be ≤ this */
  devigSumTolerance: 1e-9,
} as const;

export type FootballOneXTwoDevig = {
  rawHome: number;
  rawDraw: number;
  rawAway: number;
  /** Sum of raw implied probs (mission: overround) */
  overround: number;
  /** overround - 1 (bookmaker margin) */
  margin: number;
  devigHome: number;
  devigDraw: number;
  devigAway: number;
  devigSum: number;
  overroundLevel: "OK" | "WARNING" | "BLOCKED";
  reasonCodes: string[];
};

export type FootballOddsUsabilityStatus =
  | "ARTIFACT_MISSING"
  | "ARTIFACT_PRESENT_NO_USABLE_ROWS"
  | "PARTIAL_USABLE"
  | "FULLY_USABLE"
  | "AFTER_CUTOFF"
  | "IDENTITY_FAILED"
  | "INVALID_FORMAT"
  | "UNSUPPORTED_MARKET";

export type FootballOddsIdentityJoin = {
  matchId: string;
  identityHash: string;
  provider: string;
  fixtureId: string;
  competitionId: string;
  homeTeamId: string;
  awayTeamId: string;
  commenceTime: string;
};

export type FootballOddsIdentityJoinResult = {
  ok: boolean;
  orientation: "MATCHED" | "REVERSED_SUSPECTED" | "MISMATCH";
  reasonCodes: string[];
  audit: string[];
};

export type FootballOddsArtifactMeta = {
  schemaVersion:
    | "football-odds-history-v1"
    | "football-domestic-markets-v1"
    | "football-odds-usability-v1";
  generatedAt: string;
  dateKst: string;
  sourceProvider: string;
  identityVersion: string;
  sourceNamespace: FootballOddsSourceNamespace;
  rows: number;
  usableCount: number;
  partialCount: number;
  notCollectedCount: number;
  afterCutoffCount: number;
  identityFailedCount: number;
  artifactHash: string;
};

export type FootballOddsHistoryArtifactV1 = FootballOddsArtifactMeta & {
  schemaVersion: "football-odds-history-v1";
  sourceNamespace: "OVERSEAS";
  oneXTwoRows: FootballOneXTwoOddsRow[];
  collectOnlyRows: FootballCollectOnlyOddsRow[];
};

export type FootballDomesticMarketsArtifactV1 = FootballOddsArtifactMeta & {
  schemaVersion: "football-domestic-markets-v1";
  sourceNamespace: "DOMESTIC";
  oneXTwoRows: FootballOneXTwoOddsRow[];
  collectOnlyRows: FootballCollectOnlyOddsRow[];
};

export type FootballOddsUsabilityArtifactV1 = FootballOddsArtifactMeta & {
  schemaVersion: "football-odds-usability-v1";
  usability: FootballOddsUsabilityStatus;
  predictionAllowed: boolean;
  reasons: string[];
};

export type FootballOddsGateResult = {
  status: FootballOsLevel;
  predictionAllowed: boolean;
  usableMatches: number;
  blockedMatches: number;
  reasons: string[];
  usability: FootballOddsUsabilityStatus;
  stage: "NOT_STARTED" | "PARTIAL" | "READY" | "BLOCKED";
  plainLanguage: string;
  /** Never a fake percent */
  progressPercent: null;
};

export type FootballOddsOperationSlice = {
  identityStage: string;
  oddsStage: "NOT_STARTED" | "PARTIAL" | "READY" | "BLOCKED";
  prediction: "NONE";
  usableMatchCount: number;
  blockedReasonPlain: string | null;
  gate: FootballOddsGateResult;
  sourceRefs: string[];
};

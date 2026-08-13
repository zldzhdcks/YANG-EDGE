/**
 * Football Market Baseline Prediction v0 — types.
 * Frozen-market ARGMAX benchmark. Not an Engine, model, or recommendation.
 */
import type { FootballLegalStatus } from "../core/types";
import type { FootballSnapshotMatchStatus } from "../prediction-snapshot-v0/types";

export const FOOTBALL_MARKET_BASELINE_PREDICTION_V0_SCHEMA =
  "football-market-baseline-prediction-v0" as const;
export const FOOTBALL_MARKET_BASELINE_PREDICTION_V0_BUILDER =
  "football-market-baseline-prediction-builder-v0" as const;
export const FOOTBALL_MARKET_BASELINE_CLASS = "MARKET_BASELINE" as const;
export const FOOTBALL_MARKET_BASELINE_MARKET = "MONEYLINE_3WAY_1X2" as const;
export const FOOTBALL_MARKET_BASELINE_RULE =
  "ARGMAX_NORMALIZED_MARKET_PROBABILITY" as const;
export const FOOTBALL_MARKET_BASELINE_NORMALIZATION_POLICY =
  "RENORMALIZE_FROZEN_MEDIAN_DEVIG_TO_SUM_1" as const;

export type FootballMarketBaselineOutcome = "HOME" | "DRAW" | "AWAY";

export type FootballMarketBaselineStatus =
  | "MARKET_BASELINE_PREDICTED"
  | "AMBIGUOUS_MARKET_MAX"
  | "MISSED_MARKET_BASELINE_WINDOW"
  | "SOURCE_NO_USABLE_ODDS"
  | "SOURCE_NOT_ELIGIBLE_FORMAT"
  | "SOURCE_COMPETITION_BLOCKED"
  | "SOURCE_IDENTITY_BLOCKED"
  | "SOURCE_UNKNOWN_ELIGIBILITY"
  | "SOURCE_MISSED_SNAPSHOT_FREEZE_WINDOW";

export type FootballMarketBaselineMatchV0 = {
  matchId: string;
  baselineStatus: FootballMarketBaselineStatus;
  sourceSnapshotStatus: FootballSnapshotMatchStatus;
  competitionId: string;
  homeTeamId: string | null;
  awayTeamId: string | null;
  homeTeamName: string;
  awayTeamName: string;
  kickoffTimeUtc: string | null;
  sourceFreezeAt: string;
  sourceSelectedOddsObservationId: string | null;
  sourceSelectedOddsObservationHash: string | null;
  rawMedianDevigHome: number | null;
  rawMedianDevigDraw: number | null;
  rawMedianDevigAway: number | null;
  rawMedianSum: number | null;
  normalizedHome: number | null;
  normalizedDraw: number | null;
  normalizedAway: number | null;
  baselineOutcome: FootballMarketBaselineOutcome | null;
  baselineProbability: number | null;
  baselineRule: typeof FOOTBALL_MARKET_BASELINE_RULE;
  researchOnly: true;
};

export type FootballMarketBaselinePredictionV0 = {
  meta: {
    schemaVersion: typeof FOOTBALL_MARKET_BASELINE_PREDICTION_V0_SCHEMA;
    builderVersion: typeof FOOTBALL_MARKET_BASELINE_PREDICTION_V0_BUILDER;
    dateKst: string;
    generatedAt: string;
    predictionAt: string;
    researchOnly: true;
    legalStatus: FootballLegalStatus;
    predictionClass: typeof FOOTBALL_MARKET_BASELINE_CLASS;
    market: typeof FOOTBALL_MARKET_BASELINE_MARKET;
    baselineRule: typeof FOOTBALL_MARKET_BASELINE_RULE;
    normalizationPolicy: typeof FOOTBALL_MARKET_BASELINE_NORMALIZATION_POLICY;
    model: "NONE";
    engine: "NONE";
    recommendation: "NONE";
    officialPickCount: 0;
    sourceSnapshotRel: string;
    sourceSnapshotHash: string;
    snapshotMatches: number;
    frozenInputGames: number;
    baselinePredictedGames: number;
    ambiguousMarketGames: number;
    missedPredictionWindowGames: number;
    nonFrozenInputGames: number;
    predictionHash: string;
  };
  matches: FootballMarketBaselineMatchV0[];
};

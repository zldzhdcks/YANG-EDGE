/**
 * Football Market Baseline Postgame Review v0 — wrapper contracts.
 * Reuses Review/Scorecard Foundation records. Adds provenance meta only.
 */
import type { FootballOfficialResultArtifactV0 } from "../official-result-v0/types";
import type { FootballMarketBaselinePredictionV0 } from "../market-baseline-prediction-v0/types";
import type {
  FootballReviewRecordV0,
  FootballScorecardV0,
} from "../review-scorecard-foundation-v0/types";

export const FOOTBALL_MARKET_BASELINE_REVIEW_V0_SCHEMA =
  "football-market-baseline-review-v0" as const;
export const FOOTBALL_MARKET_BASELINE_SCORECARD_V0_SCHEMA =
  "football-market-baseline-scorecard-v0" as const;
export const FOOTBALL_MARKET_BASELINE_POSTGAME_REVIEW_BUILDER =
  "football-market-baseline-postgame-review-builder-v0" as const;

export type FootballMarketBaselinePostgameProvenanceV0 = {
  dateKst: string;
  matchIds: string[];
  sourceMarketBaselinePath: string;
  sourceMarketBaselinePredictionHash: string;
  sourceOfficialResultPath: string;
  sourceOfficialResultArtifactHash: string;
  sourceMatchResultHash: string | null;
  sampleLane: "RESEARCH";
  predictionClass: "MARKET_BASELINE";
  model: "NONE";
  engine: "NONE";
  recommendation: "NONE";
  officialPickCount: 0;
  engineImpact: "NONE";
  predictionFormulaConnected: false;
  researchOnly: true;
};

export type FootballMarketBaselineReviewArtifactV0 = {
  meta: {
    schemaVersion: typeof FOOTBALL_MARKET_BASELINE_REVIEW_V0_SCHEMA;
    builderVersion: typeof FOOTBALL_MARKET_BASELINE_POSTGAME_REVIEW_BUILDER;
    generatedAt: string;
  } & FootballMarketBaselinePostgameProvenanceV0;
  review: FootballReviewRecordV0;
};

export type FootballMarketBaselineScorecardArtifactV0 = {
  meta: {
    schemaVersion: typeof FOOTBALL_MARKET_BASELINE_SCORECARD_V0_SCHEMA;
    builderVersion: typeof FOOTBALL_MARKET_BASELINE_POSTGAME_REVIEW_BUILDER;
    generatedAt: string;
    insufficientSample: true;
  } & FootballMarketBaselinePostgameProvenanceV0;
  scorecard: FootballScorecardV0;
};

export type FootballMarketBaselinePostgameSources = {
  baseline: FootballMarketBaselinePredictionV0;
  baselineRel: string;
  result: FootballOfficialResultArtifactV0;
  resultRel: string;
};

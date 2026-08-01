/**
 * MLB Baseline Prediction v0 — config (BASELINE_ASSUMPTION only).
 * RESEARCH_BASELINE_V0 — not an Engine Candidate.
 */
export const MLB_PREDICTION_V0_MODEL_VERSION = "mlb-baseline-prediction-v0.1.0";
export const MLB_PREDICTION_V0_STATUS = "RESEARCH_BASELINE_V0" as const;

export type WeightStatus =
  | "BASELINE_ASSUMPTION"
  | "RESEARCH_VALIDATED"
  | "DISABLED";

export type WeightSpec = {
  name: string;
  value: number;
  rationale: string;
  status: WeightStatus;
  changedAt: string;
  version: string;
};

function w(
  name: string,
  value: number,
  rationale: string,
  status: WeightStatus = "BASELINE_ASSUMPTION",
): WeightSpec {
  return {
    name,
    value,
    rationale,
    status,
    changedAt: "2026-08-01",
    version: MLB_PREDICTION_V0_MODEL_VERSION,
  };
}

/** Logit-scale contributions are multiplied by these weights. */
export const MLB_PREDICTION_V0_WEIGHTS = {
  starter: w(
    "starter",
    0.55,
    "Primary pregame signal from ERA/WHIP differential with sample shrink",
  ),
  bullpen: w(
    "bullpen",
    0,
    "DISABLED until bullpen role dataset is engine-admitted; warning only",
    "DISABLED",
  ),
  lineup: w(
    "lineup",
    0,
    "No trusted batter performance metrics in v0; completeness only",
    "DISABLED",
  ),
  homeAdvantage: w(
    "homeAdvantage",
    0.08,
    "Small fixed home prior (~52% home preference in logit space)",
  ),
  marketPrior: w(
    "marketPrior",
    0.25,
    "Mild pull toward de-vigged moneyline prior; not a copy of market",
  ),
} as const;

export const MLB_PREDICTION_V0_CALIBRATION = {
  /** Soft clamp after sigmoid (probability unit). */
  minProbability: 0.35,
  maxProbability: 0.65,
  /** Shrink strength toward 0.5 by input quality. */
  shrinkFull: 0.15,
  shrinkLimited: 0.35,
  shrinkStarterOnly: 0.45,
  shrinkMarketOnly: 0.55,
  leagueAvgEra: 4.1,
  leagueAvgWhip: 1.3,
  /** Sample IP below this → strong shrink to league average. */
  minInningsForFullTrust: 40,
  minInningsForPartial: 15,
} as const;

export const MLB_PREDICTION_V0_OFFICIAL = {
  /** Conservative: officialPick stays null until validated. */
  enableOfficialPick: false,
  minProbabilityForPick: 0.57,
  maxProbabilityForAwayPick: 0.43,
  minModelMarketEdge: 0.04,
  minConfidence: 55,
  requireFullInput: true,
} as const;

export const MLB_PREDICTION_V0_SUPPORTED_MARKETS = [
  "MONEYLINE_2WAY",
] as const;

export const MLB_PREDICTION_V0_NOT_IMPLEMENTED_MARKETS = [
  "TOTALS",
  "RUN_LINE",
  "FIRST_5_INNINGS",
  "PLAYER_PROPS",
  "PARLAY",
  "HANDICAP",
] as const;

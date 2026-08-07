/**
 * Daily Prediction Continuity Guard v1
 * Ensures RESEARCH_BASELINE_V0 snapshots exist for scheduled MLB slates
 * before first pitch. Does not change Engine / weights / Dataset math.
 */

export const PREDICTION_CONTINUITY_SCHEMA =
  "mlb-daily-prediction-continuity-guard-v1" as const;

/** Ops failure when a required pregame snapshot was never written. */
export const DAILY_PREDICTION_SNAPSHOT_MISSING =
  "DAILY_PREDICTION_SNAPSHOT_MISSING" as const;

/** Review/grade code when the date has no pregame snapshot to score. */
export const NO_PREGAME_SNAPSHOT = "NO_PREGAME_SNAPSHOT" as const;

export type PredictionContinuityStatus =
  | "SNAPSHOT_PRESENT"
  | typeof DAILY_PREDICTION_SNAPSHOT_MISSING
  | "BLOCKED_AFTER_START"
  | "SCHEDULE_MISSING"
  | "NOT_REQUIRED";

export type PredictionContinuityAssessment = {
  schemaVersion: typeof PREDICTION_CONTINUITY_SCHEMA;
  dateKst: string;
  status: PredictionContinuityStatus;
  continuityRequired: boolean;
  snapshotExists: boolean;
  generatedAt: string | null;
  predictedAt: string | null;
  createdBeforeFirstStart: boolean | null;
  predictionHashSha256: string | null;
  modelStatus: string | null;
  earliestStartUtc: string | null;
  asOf: string;
  pathRel: string;
  opsFailure: boolean;
  plainLanguage: string;
};

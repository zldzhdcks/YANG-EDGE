/**
 * NPB Daily Evidence Continuity v0
 * Ops lifecycle for PRE-GAME EVIDENCE ACCUMULATION — no Prediction Engine.
 */

export const NPB_DAILY_EVIDENCE_CONTINUITY_SCHEMA =
  "npb-daily-evidence-continuity-v0" as const;

export const NPB_PREGAME_EVIDENCE_MISSING =
  "NPB_PREGAME_EVIDENCE_MISSING" as const;

export type NpbDailyLifecycleStatus =
  | "NOT_STARTED"
  | "COLLECTING"
  | "PREGAME_EVIDENCE_READY"
  | "AWAITING_RESULT"
  | "COMPLETED"
  | "NO_PREGAME_EVIDENCE"
  | "OPS_FAILURE";

export type NpbEvidenceItemReadiness = "READY" | "PARTIAL" | "MISSING";

export type NpbEvidenceCoverageLine = {
  label: string;
  readiness: NpbEvidenceItemReadiness;
  ready: number;
  total: number;
  /** Operator display e.g. "✓ 6/6" or "⚠ NOT RELEASED" */
  display: string;
  detail: string | null;
};

export type NpbMarketBaselineV0 = {
  kind: "MARKET_BASELINE";
  won: number;
  lost: number;
  notApplicable: number;
  decided: number;
  winRatePercent: number | null;
  display: string;
};

export type NpbPredictionEngineStatusV0 = {
  engine: "NOT_AVAILABLE";
  accuracy: "N/A";
  goodPicks: "N/A";
  note: string;
};

export type NpbContinuityGuardV0 = {
  alert: typeof NPB_PREGAME_EVIDENCE_MISSING | null;
  scheduleExists: boolean;
  snapshotExists: boolean;
  earliestFirstPitchAt: string | null;
  pastOrApproachingFirstPitch: boolean;
  plainLanguage: string;
};

export type NpbDailyEvidenceDayAssessment = {
  schemaVersion: typeof NPB_DAILY_EVIDENCE_CONTINUITY_SCHEMA;
  dateKst: string;
  lifecycle: NpbDailyLifecycleStatus;
  schedule: NpbEvidenceCoverageLine;
  starter: NpbEvidenceCoverageLine;
  odds: NpbEvidenceCoverageLine;
  lineup: NpbEvidenceCoverageLine;
  evidence: {
    frozen: boolean;
    status: string;
    hashSha256: string | null;
    hashShort: string | null;
    display: string;
  };
  results: {
    present: boolean;
    finalCount: number;
    total: number;
    display: string;
  };
  marketBaseline: NpbMarketBaselineV0 | null;
  prediction: NpbPredictionEngineStatusV0;
  continuity: NpbContinuityGuardV0;
  nextAction: string;
  line: string;
};

export type NpbDailyOpsViewV0 = {
  dateKst: string;
  day: NpbDailyEvidenceDayAssessment;
  recentDays: Array<{
    dateKst: string;
    shortDate: string;
    lifecycle: NpbDailyLifecycleStatus;
  }>;
  operatorLines: string[];
};

/**
 * MLB Daily Ops One-Command v1 — presentation / orchestration types.
 * Does not change Engine / Prediction / weights / datasets.
 */

import type { DailyOverallStatus, DailyPregameReport } from "@/lib/mlb/daily-pregame-v0";
import type { SlateProvenanceBanner } from "@/lib/mlb/recommendation-provenance-v1";

export const MLB_DAILY_OPS_SCHEMA = "yang-edge-mlb-daily-ops-v1" as const;

/** Operator-facing lifecycle for a slate date (reuse across CLI + Dashboard). */
export type MlbDailyOpsLifecycleStatus =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "READY"
  | "AWAITING_RESULT"
  | "REVIEW_READY"
  | "COMPLETED"
  | "OPS_FAILURE"
  | "NO_PREGAME_SNAPSHOT";

export type MlbDailyOpsStageName =
  | "SCHEDULE"
  | "STARTER"
  | "ODDS"
  | "LINEUP"
  | "DAILY_RESEARCH_SUMMARY"
  | "INPUT_AUDIT"
  | "PREDICTION_V0"
  | "SNAPSHOT_VERIFY"
  | "PROVENANCE_VERIFY"
  | "RECOMMENDATION_RECORD";

export type MlbDailyOpsCoverageLine = {
  label: string;
  ready: number;
  total: number;
  detail: string | null;
};

export type MlbDailyOpsPickLine = {
  rank: number;
  team: string;
  probability: number | null;
  confidence: number | null;
  researchOnly: boolean;
  tier: "STRONG" | "GOOD";
  gameId: string;
};

export type MlbDailyOpsDayAssessment = {
  dateKst: string;
  lifecycle: MlbDailyOpsLifecycleStatus;
  provenanceStatus: SlateProvenanceBanner["status"] | "NO_ARTIFACTS";
  predictionHash: string | null;
  predictionHashShort: string | null;
  generatedBeforeGame: boolean | null;
  snapshotVerified: boolean;
  games: number;
  starter: MlbDailyOpsCoverageLine;
  odds: MlbDailyOpsCoverageLine;
  lineup: MlbDailyOpsCoverageLine;
  researchReadyPercent: number | null;
  strongPickCount: number;
  goodPickCount: number;
  enginePicks: MlbDailyOpsPickLine[];
  recommendationRecord: "SEALED" | "ABSENT" | "NOT_ELIGIBLE";
  recommendationRecordPath: string | null;
  nextAction: string;
  line: string;
};

export type MlbDailyOpsFailure = {
  stage: MlbDailyOpsStageName | "ORCHESTRATOR";
  reason: string;
  nextAction: string;
};

export type MlbDailyOpsReport = {
  schemaVersion: typeof MLB_DAILY_OPS_SCHEMA;
  dateKst: string;
  dryRun: boolean;
  noProvider: boolean;
  generatedAt: string;
  /** True only when pregame snapshot exists, before first pitch, verify PASS. */
  opsSuccess: boolean;
  lifecycle: MlbDailyOpsLifecycleStatus;
  pregameOverall: DailyOverallStatus | null;
  failure: MlbDailyOpsFailure | null;
  day: MlbDailyOpsDayAssessment;
  recentDays: MlbDailyOpsDayAssessment[];
  operatorSummaryText: string;
  pregame: DailyPregameReport | null;
  provenance: Omit<SlateProvenanceBanner, never> | null;
  writesPerformed: number;
  providerCalls: number;
};

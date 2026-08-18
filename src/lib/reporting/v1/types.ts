/**
 * Reporting Framework v1 — shared contracts.
 * Read-only consumer of research artifacts. Not a second Source of Truth.
 */

export const REPORTING_FRAMEWORK_VERSION = "reporting-framework-v1" as const;
export const REPORTING_BUILDER_VERSION = "reporting-framework-builder-v1" as const;
export const REPORTING_SCHEMA_VERSION = "reporting-v1" as const;

export const CANONICAL_REPORT_DIR = "data/research/reporting" as const;
export const FORBIDDEN_PRESENTATION_DIR = "리포트" as const;

export type ReportType =
  | "DAILY_MANDATORY"
  | "WEEKLY"
  | "MONTHLY"
  | "QUARTERLY"
  | "HALF_YEAR"
  | "ANNUAL";

export type SportId = "MLB" | "FOOTBALL" | "KBO" | "NPB";

export type MandatoryStageId =
  | "A_SLATE_SCHEDULE"
  | "B_PREGAME_INPUT"
  | "C_PREGAME_FREEZE"
  | "D_PREGAME_GIT_SEAL"
  | "E_RESULT_GRADE"
  | "F_REVIEW_SCORECARD"
  | "G_DAILY_CLOSE";

export const MANDATORY_STAGE_WEIGHTS: Record<MandatoryStageId, number> = {
  A_SLATE_SCHEDULE: 10,
  B_PREGAME_INPUT: 20,
  C_PREGAME_FREEZE: 20,
  D_PREGAME_GIT_SEAL: 10,
  E_RESULT_GRADE: 15,
  F_REVIEW_SCORECARD: 20,
  G_DAILY_CLOSE: 5,
};

export type MandatoryStageStatus =
  | "DONE"
  | "VALID_PASS"
  | "VALID_BLOCKED"
  | "WAITING_TIME_GATE"
  | "MISSING"
  | "FAILED"
  | "NOT_DERIVABLE"
  | "N/A_PREDECLARED";

export type DailyCompletionStatus =
  | "COMPLETE"
  | "IN_PROGRESS"
  | "WAITING_TIME_GATE"
  | "INCOMPLETE"
  | "NOT_DERIVABLE";

export type Derivable<T> =
  | { status: "DERIVED"; value: T }
  | { status: "NOT_DERIVABLE"; reason: string };

export type LeakageStatus =
  | "EVIDENCE_PASS"
  | "EVIDENCE_WARN"
  | "EVIDENCE_FAIL"
  | "NOT_DERIVABLE";

export type HypothesisWatchStatus =
  | "OBSERVING"
  | "INSUFFICIENT_SAMPLE"
  | "HYPOTHESIS_CANDIDATE"
  | "BACKTEST_CANDIDATE"
  | "REJECTED"
  | "ON_HOLD";

export type MonthlyTrendLabel =
  | "Improving"
  | "Stable"
  | "Degrading"
  | "Insufficient Data";

export type SampleLane =
  | "OPERATIONAL_OBSERVATION"
  | "RESEARCH_VALID_PREDICTION"
  | "MARKET_BASELINE_BENCHMARK"
  | "PASS_OUTCOME"
  | "BLOCKED_EXCLUDED"
  | "INVALID_EXCLUDED";

export type PipelineClass =
  | "GOOD"
  | "PASS"
  | "BLOCKED"
  | "MISSING"
  | "JOIN_FAILED"
  | "NOT_COLLECTED";

export type NaPredeclareEvidence = {
  scopeLockedAt: string;
  reason: string;
  evidenceRel: string | null;
  source: string;
};

export type SourceArtifactRef = {
  path: string;
  hash: string | null;
  kind: string;
  sport: SportId | "MULTI" | "UNKNOWN";
  schemaVersion: string | null;
};

export type CommonReportMetadata = {
  reportType: ReportType;
  reportVersion: string;
  periodStart: string;
  periodEnd: string;
  generatedAt: string;
  sourceArtifacts: SourceArtifactRef[];
  sourceArtifactCount: number;
  gitCommit: string | null;
  engineVersion: string | null;
  researchOnly: true;
  engineConnected: false;
  autoApply: false;
  leakageStatus: LeakageStatus;
  sampleStatus: "SEPARATED" | "NOT_DERIVABLE";
  deterministicMetricsHash: string;
};

export type FutureReportPlaceholder = {
  reportType: "QUARTERLY" | "HALF_YEAR" | "ANNUAL";
  reportVersion: "v1-placeholder";
  status: "NOT_IMPLEMENTED";
  researchOnly: true;
  autoApply: false;
  note: string;
};

export function futureReportPlaceholder(
  reportType: FutureReportPlaceholder["reportType"],
): FutureReportPlaceholder {
  return {
    reportType,
    reportVersion: "v1-placeholder",
    status: "NOT_IMPLEMENTED",
    researchOnly: true,
    autoApply: false,
    note: "Phase 1 defines reportType only. No automation.",
  };
}

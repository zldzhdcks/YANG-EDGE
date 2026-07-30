/**
 * Types for MLB Daily Research Summary artifact (Builder output).
 * Research Lab reads this as source of truth — no recalculation.
 */

export const MLB_DAILY_RESEARCH_SUMMARY_SCHEMA =
  "mlb-daily-research-summary-v1" as const;

export type MlbDailyStepRun = "SUCCESS" | "FAIL" | "SKIP";
export type MlbDailyDatasetStatus =
  | "READY"
  | "PARTIAL"
  | "FAILED"
  | "SKIP"
  | "NOT_RELEASED";

export type MlbDailyResearchSummaryStep = {
  step: string;
  run: MlbDailyStepRun;
  status: MlbDailyDatasetStatus;
  detail: string;
  artifact: string | null;
  exitCode: number | null;
};

export type MlbDailyResearchSummaryDataset = {
  dataset: string;
  status: MlbDailyDatasetStatus;
  detail: string;
  artifact: string | null;
};

export type MlbDailyResearchSummaryDocument = {
  schemaVersion: typeof MLB_DAILY_RESEARCH_SUMMARY_SCHEMA | string;
  dateKst: string;
  generatedAt: string;
  pipeline: string[];
  steps: MlbDailyResearchSummaryStep[];
  researchReady: {
    score: number;
    max: number;
    percent: number;
    missing: string[];
    datasets: MlbDailyResearchSummaryDataset[];
    breakdown?: Array<{
      dataset: string;
      status: MlbDailyDatasetStatus;
      weight: number;
      awardedPoints: number;
      maxPoints: number;
      ruleApplied: "FULL" | "HALF_FLOOR" | "ZERO";
      detail: string;
      artifact: string | null;
    }>;
  };
  counts: {
    scheduleGames: number | null;
    starterComplete: string | null;
    oddsCollected: string | null;
    lineupConfirmed: string | null;
  };
  sourceArtifacts?: Array<{
    dataset: string;
    status: MlbDailyDatasetStatus;
    produced: boolean;
    artifact: string | null;
  }>;
  assistantSummary: string;
  notes: string[];
  /** Optional for backward compatibility with older artifacts. */
  pipelineVersion?: string | null;
  roundingPolicy?: string | null;
};

export type MlbDailyPipelineStatus = "SUCCESS" | "PARTIAL" | "FAILED";

export type MlbDailyResearchSummaryLoad =
  | {
      kind: "ok";
      document: MlbDailyResearchSummaryDocument;
      pipelineStatus: MlbDailyPipelineStatus;
    }
  | { kind: "missing" }
  | { kind: "invalid" }
  | { kind: "unsupported"; schemaVersion: string | null }
  | { kind: "pipeline_failed"; document: MlbDailyResearchSummaryDocument };

/**
 * MLB Daily Pregame Line v0 — stage types.
 */

/** Ops window contract (CLI `--window`). Not an Engine threshold. */
export const MLB_DAILY_OPS_WINDOWS = [
  "T90",
  "T60",
  "T45",
  "T30",
  "LOCK",
] as const;

export type MlbDailyOpsWindow = (typeof MLB_DAILY_OPS_WINDOWS)[number];

export type CollectionDecisionCode =
  | "COLLECT_MISSING"
  | "SKIP_EXISTS"
  | "SKIP_FRESH"
  | "REFRESH_STALE"
  | "REFRESH_PARTIAL"
  | "REFRESH_NOT_RELEASED"
  | "BLOCKED_LOCK_WINDOW"
  | "BLOCKED_AFTER_START"
  | "PROVIDER_REQUIRED"
  | "QUOTA_DECISION_EXTERNAL"
  | "LEGAL_PROVIDER_AUTOMATION_BLOCKED"
  | "PLAN_UNKNOWN"
  | "LEGAL_CONDITIONAL_UNMET"
  | "ALREADY_LOCKED"
  | "PRESERVE_EXISTING"
  | "NON_LOCK_WINDOW_NO_PREDICTION";

export type CollectionProviderPolicy =
  | "NONE"
  | "PROVIDER_REQUIRED"
  | "QUOTA_DECISION_EXTERNAL"
  | "LEGAL_PROVIDER_AUTOMATION_BLOCKED"
  | "PLAN_UNKNOWN"
  | "LEGAL_CONDITIONAL_UNMET";

export type DailyStageName =
  | "SCHEDULE"
  | "STARTER"
  | "ODDS"
  | "LINEUP"
  | "INPUT_AUDIT"
  | "PREDICTION_V0"
  | "SNAPSHOT_VERIFY";

export type DailyStageStatus =
  | "READY"
  | "ALREADY_COMPLETE"
  | "WOULD_RUN"
  | "RUNNING"
  | "SUCCESS"
  | "PARTIAL"
  | "SKIPPED"
  | "PASS"
  | "BLOCKED"
  | "FAILED";

export type DailyStageResult = {
  stage: DailyStageName;
  status: DailyStageStatus;
  inputPaths: string[];
  outputPaths: string[];
  providerCalls: number;
  rows: number | null;
  activeGames: number | null;
  readyGames: number | null;
  passGames: number | null;
  blockedGames: number | null;
  warnings: string[];
  blockers: string[];
  durationMs: number;
  errorCode?: string | null;
  message?: string | null;
  detail?: Record<string, unknown>;
};

export type DailyOverallStatus =
  | "READY_FOR_PREGAME_RUN"
  | "READY_FOR_PREGAME_FREEZE"
  | "PARTIAL_READY"
  | "PARTIAL_OBSERVATION_ONLY"
  | "BLOCKED_MISSING_SCHEDULE"
  | "BLOCKED_MISSING_SUMMARY"
  | "BLOCKED_CUTOFF"
  | "BLOCKED_AFTER_START"
  | "BLOCKED_ODDS_MISSING"
  | "BLOCKED_STARTER_INTEGRITY"
  | "BLOCKED_INPUT_AUDIT"
  | "WOULD_COLLECT"
  | "FAILED"
  | "DAILY_PREDICTION_SNAPSHOT_MISSING";

export type DailyPregameReport = {
  schemaVersion: "mlb-daily-pregame-line-v0";
  dateKst: string;
  overall: DailyOverallStatus;
  dryRun: boolean;
  noProvider: boolean;
  /** Present when `--window` was supplied. Null preserves legacy no-window runs. */
  window: MlbDailyOpsWindow | null;
  generatedAt: string;
  stages: DailyStageResult[];
  schedule: Record<string, unknown> | null;
  starter: Record<string, unknown> | null;
  odds: Record<string, unknown> | null;
  lineup: Record<string, unknown> | null;
  domestic: Record<string, unknown> | null;
  prediction: Record<string, unknown> | null;
  continuity: Record<string, unknown> | null;
  earliestStart: string | null;
  latestStart: string | null;
  recommendedNextRunAt: string | null;
  providerQuota: {
    remaining: number | null;
    status: "UNKNOWN" | "OK" | "WARN" | "BLOCK";
    note: string;
  };
  blockingIssues: string[];
  warnings: string[];
  providerCalls: number;
  writesPerformed: number;
  nextAction: string | null;
};

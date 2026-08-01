/**
 * Pregame Scheduler v1 — shared types.
 * Orchestrator only: no Engine / Prediction / Odds computation.
 */

export type SchedulerLeague = "MLB" | "KBO" | "NPB";

export type PregameSchedulerStage =
  | "SCHEDULE_DISCOVERY"
  | "T90_COLLECTION"
  | "T60_REFRESH"
  | "T45_LINEUP_CHECK"
  | "T30_FINAL_CHECK"
  | "PREGAME_LOCK"
  | "WAITING_FOR_FINAL"
  | "POSTGAME_COLLECTION"
  | "POSTGAME_REVIEW"
  | "COMPLETE";

export type SchedulerExecutionStatus =
  | "PENDING"
  | "READY"
  | "RUNNING"
  | "SUCCESS"
  | "PASS"
  | "BLOCKED"
  | "FAILED"
  | "SKIPPED"
  | "NOT_IMPLEMENTED"
  | "MANUAL_REQUIRED"
  | "INPUT_VALIDATION_FAILED";

export type SchedulerTriggerReason =
  | "TIME_WINDOW_ENTERED"
  | "INPUT_MISSING"
  | "RETRY_ALLOWED"
  | "FINAL_DETECTED"
  | "MANUAL_RUN"
  | "RECOVERY_RUN"
  | "FORCE_STAGE"
  | "DRY_RUN"
  | "ALREADY_LOCKED"
  | "HARD_CUTOFF"
  | "DUPLICATE_RUN"
  | "ALREADY_COMPLETED"
  | "QUOTA_BLOCKED"
  | "GLOBAL_BLOCKER";

export type SchedulerErrorCode =
  | "PROVIDER_AUTH_ERROR"
  | "SCHEDULE_ARTIFACT_MISSING"
  | "MALFORMED_STATE"
  | "LOCK_CONFLICT"
  | "RUNNER_NOT_FOUND"
  | "RUNNER_EXIT_NONZERO"
  | "HARD_CUTOFF"
  | "QUOTA_BLOCKED"
  | "BLOCKED_AFTER_START"
  | "ALREADY_LOCKED"
  | "SKIPPED_DUPLICATE_RUN"
  | "SKIPPED_ALREADY_COMPLETED"
  | "GLOBAL_BLOCKER"
  | "NOT_IMPLEMENTED"
  | "MANUAL_REQUIRED"
  | "INPUT_VALIDATION_FAILED"
  | "EXECUTION_FAILED_NO_SNAPSHOT"
  | "PASS_RECORDED"
  | "READY_FOR_POSTGAME";

export type WindowId = "T90" | "T60" | "T45" | "T30" | "LOCK" | "POST_START";

export type StageResolveResult =
  | {
      kind: "STAGE";
      stage: PregameSchedulerStage;
      windowId: WindowId;
      triggerReason: SchedulerTriggerReason;
    }
  | {
      kind: "BLOCKED";
      errorCode: "BLOCKED_AFTER_START" | "ALREADY_LOCKED";
      stage: PregameSchedulerStage;
      triggerReason: SchedulerTriggerReason;
    };

export type RunnerActionKind =
  | "SPAWN_TSX"
  | "NPM_SCRIPT"
  | "NOOP_CHECK"
  | "NOT_IMPLEMENTED"
  | "MANUAL_REQUIRED"
  | "INPUT_VALIDATION_FAILED";

export type RunnerAction = {
  kind: RunnerActionKind;
  actionId: string;
  description: string;
  /** Relative script path under repo root (SPAWN_TSX). */
  scriptRel?: string;
  /** npm script name without `npm run` (NPM_SCRIPT). */
  npmScript?: string;
  args?: string[];
  /** Expected to call providers when executed for real. */
  mayCallProvider: boolean;
};

export type SchedulerGameInput = {
  gameId: string;
  scheduledStartTime: string;
  statusAbstract?: string | null;
  actualStartTime?: string | null;
  pregameLocked?: boolean;
  lockedPredictionExists?: boolean;
  lastSuccessInputHashByStage?: Partial<
    Record<PregameSchedulerStage, string>
  >;
};

export type SchedulerGamePlan = {
  league: SchedulerLeague;
  gameId: string;
  scheduledStartTime: string;
  secondsUntilStart: number;
  stage: PregameSchedulerStage;
  executionStatus: SchedulerExecutionStatus;
  triggerReason: SchedulerTriggerReason;
  action: RunnerAction | null;
  errorCode?: SchedulerErrorCode;
  warnings: string[];
  lockKey: string;
  inputHash: string;
};

export type StageStateRecord = {
  stage: PregameSchedulerStage;
  status: SchedulerExecutionStatus;
  attemptNumber: number;
  schedulerRunId: string;
  startedAt: string | null;
  finishedAt: string | null;
  inputHash: string | null;
  outputHash: string | null;
  outputArtifacts: string[];
  warnings: string[];
  errorCode: SchedulerErrorCode | null;
};

export type GameSchedulerState = {
  gameId: string;
  scheduledStartTime: string;
  latestStage: PregameSchedulerStage | null;
  overallStatus: SchedulerExecutionStatus | "PARTIAL_SUCCESS";
  stages: StageStateRecord[];
};

export type SchedulerStateArtifact = {
  schemaVersion: "pregame-scheduler-state-v1";
  dateKst: string;
  league: SchedulerLeague;
  generatedAt: string;
  games: GameSchedulerState[];
};

export type LockRecord = {
  lockKey: string;
  schedulerRunId: string;
  processId: number;
  acquiredAt: string;
  expiresAt: string;
  stage: PregameSchedulerStage;
  status: "RUNNING";
  league: SchedulerLeague;
  dateKst: string;
  gameId: string;
};

export type QuotaDecision =
  | { allowProvider: true; warn: boolean; remaining: number | null }
  | {
      allowProvider: false;
      warn: boolean;
      remaining: number | null;
      reason: "QUOTA_BLOCKED";
    };

export type SchedulerAuditArtifact = {
  schemaVersion: "pregame-scheduler-audit-v1";
  dateKst: string;
  league: SchedulerLeague | "ALL";
  generatedAt: string;
  schedulerRunId: string;
  dryRun: boolean;
  totalGames: number;
  stageCounts: Partial<Record<PregameSchedulerStage, number>>;
  success: number;
  pass: number;
  blocked: number;
  failed: number;
  skipped: number;
  duplicatePrevented: number;
  providerCalls: number;
  quotaWarnings: number;
  cutoffViolations: number;
  leakageRisk: "NONE" | "WARN";
  lockConflicts: number;
  durationMs: number;
  overallStatus: "SUCCESS" | "PARTIAL_SUCCESS" | "FAILED" | "DRY_RUN";
  games: SchedulerGamePlan[];
};

export type OrchestratorOptions = {
  dateKst: string;
  league: SchedulerLeague | "ALL";
  gameId?: string;
  dryRun: boolean;
  forceStage?: PregameSchedulerStage;
  noProvider: boolean;
  includePostgame: boolean;
  json: boolean;
  now?: Date;
  /** Test / fixture override — skip filesystem schedule load. */
  fixtureGames?: SchedulerGameInput[];
  /** Disable disk lock/state writes (dry-run or tests). */
  persist?: boolean;
  cwd?: string;
  /** Optional runner (CLI injects spawnLocalTsxScript). Dry-run never calls it. */
  executeRunner?: (action: RunnerAction) => Promise<number>;
  /** Provider quota remaining for gate tests / ops. */
  quotaRemaining?: number | null;
};

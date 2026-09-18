import type { MacOpsExitCode } from "./exit-codes";
import type { OddsQuotaReadStatus, OddsQuotaSource } from "../odds/quota-receipt-v1";

export const MAC_OPS_NODE_VERSION = "mac-operations-node-v1" as const;

export const MAC_OPS_LOCK_REL = "data/ops/locks/mac-operations-node-v1.lock";
export const MAC_OPS_HEALTH_REL = "data/ops/health/mac-operations-node-v1.json";

/**
 * Global mutex TTL: 30 minutes.
 * Longest Scheduler per-stage lock TTL is 20 minutes (POSTGAME_REVIEW).
 * Unattended tick may run sequential Daily Ops windows; 30m prevents overlap
 * under 5-minute launchd cadence without releasing a live collector.
 */
export const MAC_OPS_LOCK_TTL_MS = 30 * 60_000;

export const MAC_OPS_RECOMMENDED_TICK_MINUTES = 5;

export type MacOpsMode = "PREFLIGHT" | "RUN";

export type MacOpsStatus =
  | "READY_FOR_UNATTENDED_ODDS"
  | "BLOCKED"
  | "ODDS_UNAVAILABLE"
  | "DUPLICATE_TICK"
  | "HEALTHY"
  | "CONFIG_FAILURE"
  | "EXECUTION_FAILURE";

export type ArtifactPresence = "PRESENT" | "MISSING";

export type MacOpsLockOutcome =
  | "LOCK_ACQUIRED"
  | "LOCK_ALREADY_HELD"
  | "LOCK_STALE_RECOVERED"
  | "LOCK_RELEASED"
  | "LOCK_AVAILABLE"
  | "LOCK_HELD";

export type MacOpsLockRecord = {
  version: typeof MAC_OPS_NODE_VERSION;
  pid: number;
  startedAt: string;
  expiresAt: string;
  runId: string;
  hostname: string;
};

export type MacOpsHealthReceipt = {
  version: typeof MAC_OPS_NODE_VERSION;
  runId: string;
  startedAt: string;
  finishedAt: string;
  dateKst: string;
  mode: MacOpsMode;
  status: MacOpsStatus;
  exitCode: MacOpsExitCode;
  schedulerRunId: string | null;
  quotaSource: OddsQuotaSource | null;
  quotaStatus: OddsQuotaReadStatus | null;
  lastErrorCode: string | null;
  headCommit: string | null;
};

export type MacOpsPreflightReport = {
  version: typeof MAC_OPS_NODE_VERSION;
  runId: string;
  dateKst: string;
  repoRoot: string;
  mode: MacOpsMode;
  status: MacOpsStatus;
  exitCode: MacOpsExitCode;
  lastErrorCode: string | null;
  envFile: "PRESENT" | "MISSING";
  oddsPlanConfirmed: boolean;
  oddsApiKeyPresent: boolean;
  scheduleArtifact: ArtifactPresence;
  starterArtifact: ArtifactPresence;
  lineupArtifact: ArtifactPresence;
  oddsArtifact: ArtifactPresence;
  quotaSource: OddsQuotaSource;
  quotaStatus: OddsQuotaReadStatus | null;
  quotaRemaining: number | null;
  mutex: MacOpsLockOutcome;
  nodeExecPath: string;
  localTsx: string;
  localTsxPresent: boolean;
  usesNpx: false;
  rehearsal: false;
  unattended: true;
  launchdInstalled: false;
  gitPull: false;
  npmInstall: false;
  mlbStatsAutomationAllowed: false;
  readyForUnattendedOdds: boolean;
};

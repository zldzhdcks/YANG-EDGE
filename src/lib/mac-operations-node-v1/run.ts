import { existsSync } from "node:fs";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { getKstDateString } from "../datetime/kst";
import { artifactPaths } from "../mlb/daily-pregame-v0/audit-artifacts";
import {
  LEGAL_PROVIDER_AUTOMATION_BLOCKED,
  MLB_STATS_AUTOMATION_ALLOWED,
} from "../provider-automation-policy";
import { resolveOddsQuotaInput } from "../odds/quota-receipt-v1";
import { inspectMacOpsEnv } from "./env";
import { MAC_OPS_EXIT, type MacOpsExitCode } from "./exit-codes";
import {
  acquireMacOpsLock,
  inspectMacOpsLock,
  releaseMacOpsLock,
  writeMacOpsJsonAtomic,
} from "./mutex";
import {
  absoluteNodeExecPath,
  localTsxCliPath,
  resolveYangEdgeRepoRoot,
} from "./repo-root";
import {
  MAC_OPS_HEALTH_REL,
  MAC_OPS_NODE_VERSION,
  type ArtifactPresence,
  type MacOpsHealthReceipt,
  type MacOpsMode,
  type MacOpsPreflightReport,
  type MacOpsStatus,
} from "./types";

export type MacOpsExecuteScheduler = (input: {
  dateKst: string;
  repoRoot: string;
  args: string[];
}) => Promise<{ exitCode: number; schedulerRunId?: string | null }>;

export type RunMacOperationsNodeInput = {
  mode: MacOpsMode;
  cwd?: string;
  repoRoot?: string;
  now?: Date;
  envOverride?: Record<string, string | undefined>;
  executeScheduler?: MacOpsExecuteScheduler;
  gitDirtyTracked?: boolean;
  headCommit?: string | null;
};

function presence(cwd: string, rel: string): ArtifactPresence {
  return existsSync(path.join(cwd, rel)) ? "PRESENT" : "MISSING";
}

export function newMacOpsRunId(now = new Date()): string {
  const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  return `macops-${stamp}-${randomBytes(3).toString("hex")}`;
}

export function schedulerUnattendedArgs(dateKst: string): string[] {
  return ["--date", dateKst, "--league", "MLB", "--unattended"];
}

function logLine(pairs: Record<string, string | number | boolean | null>): void {
  const parts = Object.entries(pairs).map(([k, v]) => `${k}=${v ?? ""}`);
  console.log(parts.join(" "));
}

export async function runMacOperationsNode(
  input: RunMacOperationsNodeInput,
): Promise<MacOpsPreflightReport> {
  const startedAt = (input.now ?? new Date()).toISOString();
  const now = input.now ?? new Date();
  const runId = newMacOpsRunId(now);
  let repoRoot: string;
  try {
    repoRoot = resolveYangEdgeRepoRoot(
      input.repoRoot ?? process.cwd(),
    );
  } catch {
    try {
      repoRoot = resolveYangEdgeRepoRoot(input.cwd ?? process.cwd());
    } catch {
      const report = baseReport({
        runId,
        dateKst: getKstDateString(now),
        repoRoot: input.cwd ?? process.cwd(),
        mode: input.mode,
        status: "CONFIG_FAILURE",
        exitCode: MAC_OPS_EXIT.CONFIG_FAILURE,
        lastErrorCode: "REPO_ROOT_NOT_FOUND",
        now,
      });
      emit(report, null);
      return report;
    }
  }

  const dateKst = getKstDateString(now);
  const paths = artifactPaths(dateKst);
  const cwd = input.cwd ?? repoRoot;
  const scheduleArtifact = presence(cwd, paths.schedule);
  const starterArtifact = presence(cwd, paths.starter);
  const lineupArtifact = presence(cwd, paths.lineup);
  const oddsArtifact = presence(cwd, paths.odds);

  const envFacts = await inspectMacOpsEnv({
    cwd,
    envOverride: input.envOverride,
  });
  const quota = await resolveOddsQuotaInput({
    cliQuotaRemaining: null,
    unattended: true,
    cwd,
    now,
  });

  const nodeExecPath = absoluteNodeExecPath();
  const localTsx = localTsxCliPath(repoRoot);
  const localTsxPresent = existsSync(localTsx);

  const statsMissing =
    scheduleArtifact === "MISSING" ||
    starterArtifact === "MISSING" ||
    lineupArtifact === "MISSING";

  let status: MacOpsStatus;
  let exitCode: MacOpsExitCode;
  let lastErrorCode: string | null = null;

  if (!localTsxPresent) {
    status = "CONFIG_FAILURE";
    exitCode = MAC_OPS_EXIT.CONFIG_FAILURE;
    lastErrorCode = "LOCAL_TSX_MISSING";
  } else if (input.gitDirtyTracked) {
    status = "CONFIG_FAILURE";
    exitCode = MAC_OPS_EXIT.CONFIG_FAILURE;
    lastErrorCode = "TRACKED_WORKTREE_DIRTY";
  } else if (statsMissing) {
    status = "BLOCKED";
    exitCode = MAC_OPS_EXIT.PREREQUISITE_BLOCKED;
    lastErrorCode = LEGAL_PROVIDER_AUTOMATION_BLOCKED;
  } else if (
    !envFacts.oddsPlanConfirmed ||
    !envFacts.oddsApiKeyPresent ||
    !quota.allowsSpawn
  ) {
    status = "ODDS_UNAVAILABLE";
    exitCode = MAC_OPS_EXIT.PREREQUISITE_BLOCKED;
    lastErrorCode =
      envFacts.envError ??
      (quota.readStatus === "QUOTA_RECEIPT_MISSING"
        ? "QUOTA_RECEIPT_MISSING"
        : quota.readStatus === "QUOTA_STALE"
          ? "QUOTA_STALE"
          : quota.readStatus === "QUOTA_ZERO"
            ? "QUOTA_ZERO"
            : "QUOTA_DECISION_EXTERNAL");
  } else {
    status = "READY_FOR_UNATTENDED_ODDS";
    exitCode = MAC_OPS_EXIT.HEALTHY;
  }

  void MLB_STATS_AUTOMATION_ALLOWED;

  const mutexInspect = await inspectMacOpsLock({ cwd, now });
  const report: MacOpsPreflightReport = {
    version: MAC_OPS_NODE_VERSION,
    runId,
    dateKst,
    repoRoot,
    mode: input.mode,
    status,
    exitCode,
    lastErrorCode,
    envFile: envFacts.envFile,
    oddsPlanConfirmed: envFacts.oddsPlanConfirmed,
    oddsApiKeyPresent: envFacts.oddsApiKeyPresent,
    scheduleArtifact,
    starterArtifact,
    lineupArtifact,
    oddsArtifact,
    quotaSource: quota.source,
    quotaStatus: quota.readStatus,
    quotaRemaining: quota.remaining,
    mutex: mutexInspect,
    nodeExecPath,
    localTsx,
    localTsxPresent,
    usesNpx: false,
    rehearsal: false,
    unattended: true,
    launchdInstalled: false,
    gitPull: false,
    npmInstall: false,
    mlbStatsAutomationAllowed: false,
    readyForUnattendedOdds: status === "READY_FOR_UNATTENDED_ODDS",
  };

  if (input.mode === "PREFLIGHT") {
    await writeHealth(cwd, {
      runId,
      startedAt,
      finishedAt: new Date().toISOString(),
      dateKst,
      mode: "PREFLIGHT",
      status,
      exitCode,
      schedulerRunId: null,
      quotaSource: quota.source,
      quotaStatus: quota.readStatus,
      lastErrorCode,
      headCommit: input.headCommit ?? null,
    });
    emit(report, null);
    return report;
  }

  if (status !== "READY_FOR_UNATTENDED_ODDS") {
    await writeHealth(cwd, {
      runId,
      startedAt,
      finishedAt: new Date().toISOString(),
      dateKst,
      mode: "RUN",
      status,
      exitCode,
      schedulerRunId: null,
      quotaSource: quota.source,
      quotaStatus: quota.readStatus,
      lastErrorCode,
      headCommit: input.headCommit ?? null,
    });
    emit(report, null);
    return report;
  }

  const lock = await acquireMacOpsLock({ cwd, runId, now });
  if (lock.outcome === "LOCK_ALREADY_HELD") {
    report.status = "DUPLICATE_TICK";
    report.exitCode = MAC_OPS_EXIT.DUPLICATE_TICK;
    report.lastErrorCode = "LOCK_ALREADY_HELD";
    report.mutex = "LOCK_ALREADY_HELD";
    await writeHealth(cwd, {
      runId,
      startedAt,
      finishedAt: new Date().toISOString(),
      dateKst,
      mode: "RUN",
      status: "DUPLICATE_TICK",
      exitCode: MAC_OPS_EXIT.DUPLICATE_TICK,
      schedulerRunId: null,
      quotaSource: quota.source,
      quotaStatus: quota.readStatus,
      lastErrorCode: "LOCK_ALREADY_HELD",
      headCommit: input.headCommit ?? null,
    });
    emit(report, null);
    return report;
  }
  report.mutex = lock.outcome;

  let schedulerRunId: string | null = null;
  try {
    if (!input.executeScheduler) {
      report.status = "CONFIG_FAILURE";
      report.exitCode = MAC_OPS_EXIT.CONFIG_FAILURE;
      report.lastErrorCode = "LIVE_RUN_REQUIRES_EXPLICIT_EXECUTOR_IN_THIS_MISSION";
      await writeHealth(cwd, {
        runId,
        startedAt,
        finishedAt: new Date().toISOString(),
        dateKst,
        mode: "RUN",
        status: "CONFIG_FAILURE",
        exitCode: MAC_OPS_EXIT.CONFIG_FAILURE,
        schedulerRunId: null,
        quotaSource: quota.source,
        quotaStatus: quota.readStatus,
        lastErrorCode: report.lastErrorCode,
        headCommit: input.headCommit ?? null,
      });
      emit(report, null);
      return report;
    }
    const spawned = await input.executeScheduler({
      dateKst,
      repoRoot,
      args: schedulerUnattendedArgs(dateKst),
    });
    schedulerRunId = spawned.schedulerRunId ?? null;
    if (spawned.exitCode !== 0) {
      report.status = "EXECUTION_FAILURE";
      report.exitCode = MAC_OPS_EXIT.EXECUTION_FAILURE;
      report.lastErrorCode = "SCHEDULER_EXIT_NONZERO";
    } else {
      report.status = "HEALTHY";
      report.exitCode = MAC_OPS_EXIT.HEALTHY;
    }
  } finally {
    await releaseMacOpsLock({ cwd, runId });
  }

  await writeHealth(cwd, {
    runId,
    startedAt,
    finishedAt: new Date().toISOString(),
    dateKst,
    mode: "RUN",
    status: report.status,
    exitCode: report.exitCode,
    schedulerRunId,
    quotaSource: quota.source,
    quotaStatus: quota.readStatus,
    lastErrorCode: report.lastErrorCode,
    headCommit: input.headCommit ?? null,
  });
  emit(report, schedulerRunId);
  return report;
}

function baseReport(input: {
  runId: string;
  dateKst: string;
  repoRoot: string;
  mode: MacOpsMode;
  status: MacOpsStatus;
  exitCode: MacOpsExitCode;
  lastErrorCode: string | null;
  now: Date;
}): MacOpsPreflightReport {
  return {
    version: MAC_OPS_NODE_VERSION,
    runId: input.runId,
    dateKst: input.dateKst,
    repoRoot: input.repoRoot,
    mode: input.mode,
    status: input.status,
    exitCode: input.exitCode,
    lastErrorCode: input.lastErrorCode,
    envFile: "MISSING",
    oddsPlanConfirmed: false,
    oddsApiKeyPresent: false,
    scheduleArtifact: "MISSING",
    starterArtifact: "MISSING",
    lineupArtifact: "MISSING",
    oddsArtifact: "MISSING",
    quotaSource: "NONE",
    quotaStatus: "QUOTA_RECEIPT_MISSING",
    quotaRemaining: null,
    mutex: "LOCK_AVAILABLE",
    nodeExecPath: absoluteNodeExecPath(),
    localTsx: "",
    localTsxPresent: false,
    usesNpx: false,
    rehearsal: false,
    unattended: true,
    launchdInstalled: false,
    gitPull: false,
    npmInstall: false,
    mlbStatsAutomationAllowed: false,
    readyForUnattendedOdds: false,
  };
}

async function writeHealth(
  cwd: string,
  partial: Omit<MacOpsHealthReceipt, "version">,
): Promise<void> {
  const receipt: MacOpsHealthReceipt = {
    version: MAC_OPS_NODE_VERSION,
    ...partial,
  };
  await writeMacOpsJsonAtomic(path.join(cwd, MAC_OPS_HEALTH_REL), receipt);
}

function emit(
  report: MacOpsPreflightReport,
  schedulerRunId: string | null,
): void {
  logLine({
    RUN_ID: report.runId,
    DATE_KST: report.dateKst,
    MODE: report.mode,
    STATUS: report.status,
    EXIT_CODE: report.exitCode,
    SCHEDULER_RUN_ID: schedulerRunId,
    QUOTA_SOURCE: report.quotaSource,
    QUOTA_STATUS: report.quotaStatus,
    QUOTA_REMAINING: report.quotaRemaining,
    SCHEDULE_ARTIFACT: report.scheduleArtifact,
    STARTER_ARTIFACT: report.starterArtifact,
    LINEUP_ARTIFACT: report.lineupArtifact,
    ODDS_ARTIFACT: report.oddsArtifact,
    ODDS_PLAN_CONFIRMED: report.oddsPlanConfirmed,
    ODDS_API_KEY_PRESENT: report.oddsApiKeyPresent,
    LAST_ERROR: report.lastErrorCode,
  });
}

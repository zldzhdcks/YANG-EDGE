/**
 * Pregame Scheduler v1 orchestrator — plans and optionally runs existing runners.
 */

import { createHash, randomBytes } from "node:crypto";
import { computeInputHash, findSuccessfulStage } from "./idempotency";
import { resolveLeagueAction } from "./league-adapters";
import {
  acquireLock,
  MemoryLockStore,
  releaseLock,
} from "./lock-store";
import { detectLockedPrediction, loadScheduleGames } from "./load-schedule";
import { evaluateQuotaGate } from "./quota-gate";
import {
  buildLockKey,
  resolveStage,
  secondsUntilStart,
} from "./resolve-stage";
import {
  emptyState,
  loadSchedulerState,
  saveSchedulerAudit,
  saveSchedulerState,
  upsertGameStage,
} from "./state-store";
import type {
  OrchestratorOptions,
  PregameSchedulerStage,
  RunnerAction,
  SchedulerAuditArtifact,
  SchedulerExecutionStatus,
  SchedulerGamePlan,
  SchedulerLeague,
  StageStateRecord,
} from "./types";

/** Injected by CLI / tests — Scheduler core must not import scripts/. */
export type RunnerExecutor = (action: RunnerAction) => Promise<number>;

export function newSchedulerRunId(now = new Date()): string {
  const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  return `sch-${stamp}-${randomBytes(3).toString("hex")}`;
}

export type OrchestratorResult = {
  schedulerRunId: string;
  audit: SchedulerAuditArtifact;
  plans: SchedulerGamePlan[];
  providerCalls: number;
  globalBlocker?: string;
};

export async function planGame(input: {
  league: SchedulerLeague;
  dateKst: string;
  game: import("./types").SchedulerGameInput;
  now: Date;
  forceStage?: PregameSchedulerStage;
  includePostgame: boolean;
  noProvider: boolean;
  existingState?: import("./types").SchedulerStateArtifact | null;
  quotaRemaining?: number | null;
}): Promise<SchedulerGamePlan> {
  const warnings: string[] = [];
  const resolved = resolveStage({
    game: input.game,
    now: input.now,
    forceStage: input.forceStage,
  });

  const secs = (() => {
    try {
      return secondsUntilStart(input.game.scheduledStartTime, input.now);
    } catch {
      return 0;
    }
  })();

  if (resolved.kind === "BLOCKED") {
    return {
      league: input.league,
      gameId: input.game.gameId,
      scheduledStartTime: input.game.scheduledStartTime,
      secondsUntilStart: secs,
      stage: resolved.stage,
      executionStatus: "BLOCKED",
      triggerReason: resolved.triggerReason,
      action: null,
      errorCode: resolved.errorCode,
      warnings,
      lockKey: buildLockKey({
        league: input.league,
        dateKst: input.dateKst,
        gameId: input.game.gameId,
        stage: resolved.stage,
      }),
      inputHash: computeInputHash({
        league: input.league,
        dateKst: input.dateKst,
        gameId: input.game.gameId,
        stage: resolved.stage,
        scheduledStartTime: input.game.scheduledStartTime,
      }),
    };
  }

  const stage = resolved.stage;
  const inputHash = computeInputHash({
    league: input.league,
    dateKst: input.dateKst,
    gameId: input.game.gameId,
    stage,
    scheduledStartTime: input.game.scheduledStartTime,
    status: input.game.statusAbstract ?? null,
  });

  const gameState = input.existingState?.games.find(
    (g) => g.gameId === input.game.gameId,
  );
  if (findSuccessfulStage(gameState, stage, inputHash)) {
    return {
      league: input.league,
      gameId: input.game.gameId,
      scheduledStartTime: input.game.scheduledStartTime,
      secondsUntilStart: secs,
      stage,
      executionStatus: "SKIPPED",
      triggerReason: "ALREADY_COMPLETED",
      action: null,
      errorCode: "SKIPPED_ALREADY_COMPLETED",
      warnings,
      lockKey: buildLockKey({
        league: input.league,
        dateKst: input.dateKst,
        gameId: input.game.gameId,
        stage,
      }),
      inputHash,
    };
  }

  if (
    input.game.lockedPredictionExists &&
    (stage === "T90_COLLECTION" ||
      stage === "T60_REFRESH" ||
      stage === "T45_LINEUP_CHECK" ||
      stage === "T30_FINAL_CHECK" ||
      stage === "PREGAME_LOCK")
  ) {
    return {
      league: input.league,
      gameId: input.game.gameId,
      scheduledStartTime: input.game.scheduledStartTime,
      secondsUntilStart: secs,
      stage: "PREGAME_LOCK",
      executionStatus: "BLOCKED",
      triggerReason: "ALREADY_LOCKED",
      action: null,
      errorCode: "ALREADY_LOCKED",
      warnings: [...warnings, "revision blocked: locked prediction"],
      lockKey: buildLockKey({
        league: input.league,
        dateKst: input.dateKst,
        gameId: input.game.gameId,
        stage: "PREGAME_LOCK",
      }),
      inputHash,
    };
  }

  let action = resolveLeagueAction({
    league: input.league,
    stage,
    dateKst: input.dateKst,
    gameId: input.game.gameId,
    includePostgame: input.includePostgame,
    noProvider: input.noProvider,
  });

  const quota = evaluateQuotaGate(input.quotaRemaining);
  if (quota.warn) {
    warnings.push(
      quota.remaining == null
        ? "QUOTA_UNKNOWN: prefer cache/artifact"
        : `QUOTA_WARNING: remaining=${quota.remaining}`,
    );
  }
  if (!quota.allowProvider && action.mayCallProvider) {
    return {
      league: input.league,
      gameId: input.game.gameId,
      scheduledStartTime: input.game.scheduledStartTime,
      secondsUntilStart: secs,
      stage,
      executionStatus: "BLOCKED",
      triggerReason: "QUOTA_BLOCKED",
      action,
      errorCode: "QUOTA_BLOCKED",
      warnings,
      lockKey: buildLockKey({
        league: input.league,
        dateKst: input.dateKst,
        gameId: input.game.gameId,
        stage,
      }),
      inputHash,
    };
  }

  let executionStatus: SchedulerExecutionStatus = "READY";
  let errorCode: SchedulerGamePlan["errorCode"];
  if (action.kind === "NOT_IMPLEMENTED") {
    executionStatus = "NOT_IMPLEMENTED";
    errorCode = "NOT_IMPLEMENTED";
  } else if (action.kind === "MANUAL_REQUIRED") {
    executionStatus = "MANUAL_REQUIRED";
    errorCode = "MANUAL_REQUIRED";
  } else if (
    action.actionId === "READY_FOR_POSTGAME" &&
    !input.includePostgame
  ) {
    executionStatus = "PENDING";
    errorCode = "READY_FOR_POSTGAME";
  }

  return {
    league: input.league,
    gameId: input.game.gameId,
    scheduledStartTime: input.game.scheduledStartTime,
    secondsUntilStart: secs,
    stage,
    executionStatus,
    triggerReason: resolved.triggerReason,
    action,
    errorCode,
    warnings,
    lockKey: buildLockKey({
      league: input.league,
      dateKst: input.dateKst,
      gameId: input.game.gameId,
      stage,
    }),
    inputHash,
  };
}

export async function runPregameScheduler(
  options: OrchestratorOptions,
): Promise<OrchestratorResult> {
  const started = Date.now();
  const now = options.now ?? new Date();
  const cwd = options.cwd ?? process.cwd();
  const persist = options.persist ?? !options.dryRun;
  const schedulerRunId = newSchedulerRunId(now);
  const leagues: SchedulerLeague[] =
    options.league === "ALL" ? ["MLB", "KBO", "NPB"] : [options.league];

  const allPlans: SchedulerGamePlan[] = [];
  let providerCalls = 0;
  let duplicatePrevented = 0;
  let quotaWarnings = 0;
  let cutoffViolations = 0;
  let lockConflicts = 0;
  let globalBlocker: string | undefined;
  const memoryLocks = new MemoryLockStore();

  const stageCounts: SchedulerAuditArtifact["stageCounts"] = {};

  for (const league of leagues) {
    let games: import("./types").SchedulerGameInput[];
    if (options.fixtureGames) {
      games = options.fixtureGames;
      if (options.gameId) {
        games = games.filter((g) => g.gameId === options.gameId);
      }
    } else {
      try {
        const loaded = await loadScheduleGames({
          league,
          dateKst: options.dateKst,
          cwd,
          gameId: options.gameId,
        });
        games = loaded.games;
      } catch (e) {
        globalBlocker =
          e instanceof Error ? e.message : "SCHEDULE_ARTIFACT_MISSING";
        break;
      }
    }

    let state =
      (persist
        ? await loadSchedulerState(league, options.dateKst, cwd)
        : null) ?? emptyState(league, options.dateKst);

    for (const game of games) {
      if (!options.fixtureGames) {
        const locked = await detectLockedPrediction({
          league,
          dateKst: options.dateKst,
          gameId: game.gameId,
          cwd,
        });
        if (locked) game.lockedPredictionExists = true;
      }

      let plan = await planGame({
        league,
        dateKst: options.dateKst,
        game,
        now,
        forceStage: options.forceStage,
        includePostgame: options.includePostgame,
        noProvider: options.noProvider,
        existingState: state,
        quotaRemaining: options.quotaRemaining,
      });

      stageCounts[plan.stage] = (stageCounts[plan.stage] ?? 0) + 1;
      if (plan.warnings.some((w) => w.startsWith("QUOTA_"))) quotaWarnings += 1;
      if (plan.errorCode === "BLOCKED_AFTER_START") cutoffViolations += 1;

      if (
        options.dryRun ||
        plan.executionStatus === "BLOCKED" ||
        plan.executionStatus === "SKIPPED" ||
        plan.executionStatus === "NOT_IMPLEMENTED" ||
        plan.executionStatus === "MANUAL_REQUIRED" ||
        plan.executionStatus === "PENDING" ||
        !plan.action ||
        plan.action.kind === "NOOP_CHECK"
      ) {
        if (options.dryRun && plan.executionStatus === "READY") {
          plan = { ...plan, triggerReason: "DRY_RUN" };
        }
        allPlans.push(plan);
        if (persist && !options.dryRun) {
          const rec = toStageRecord(plan, schedulerRunId, now);
          state = upsertGameStage(
            state,
            plan.gameId,
            plan.scheduledStartTime,
            rec,
          );
        }
        continue;
      }

      // Acquire lock
      let lockOk = true;
      if (options.dryRun) {
        // dry-run: memory only, do not persist
        const acq = memoryLocks.acquire({
          lockKey: plan.lockKey,
          league,
          dateKst: options.dateKst,
          gameId: plan.gameId,
          stage: plan.stage,
          schedulerRunId,
          now,
        });
        if (!acq.ok) {
          lockOk = false;
          duplicatePrevented += 1;
          lockConflicts += 1;
          plan = {
            ...plan,
            executionStatus: "SKIPPED",
            errorCode: "SKIPPED_DUPLICATE_RUN",
            triggerReason: "DUPLICATE_RUN",
          };
        }
      } else if (persist) {
        const acq = await acquireLock({
          cwd,
          league,
          dateKst: options.dateKst,
          gameId: plan.gameId,
          stage: plan.stage,
          lockKey: plan.lockKey,
          schedulerRunId,
          now,
        });
        if (!acq.ok) {
          lockOk = false;
          duplicatePrevented += 1;
          lockConflicts += 1;
          plan = {
            ...plan,
            executionStatus: "SKIPPED",
            errorCode: "SKIPPED_DUPLICATE_RUN",
            triggerReason: "DUPLICATE_RUN",
          };
        }
      }

      if (!lockOk) {
        allPlans.push(plan);
        continue;
      }

      // Execute runner
      let status: SchedulerExecutionStatus = "SUCCESS";
      let errorCode: StageStateRecord["errorCode"] = null;
      const startedAt = new Date().toISOString();
      const action = plan.action;

      if (
        action &&
        action.kind === "SPAWN_TSX" &&
        action.scriptRel &&
        !options.noProvider
      ) {
        const exec = options.executeRunner;
        if (!exec) {
          status = "FAILED";
          errorCode = "RUNNER_NOT_FOUND";
        } else {
          try {
            const code = await exec(action);
            if (action.mayCallProvider) providerCalls += 1;
            if (code !== 0) {
              status = "FAILED";
              errorCode = "RUNNER_EXIT_NONZERO";
            }
          } catch {
            status = "FAILED";
            errorCode = "RUNNER_NOT_FOUND";
          }
        }
      } else if (action && options.noProvider && action.mayCallProvider) {
        status = "SKIPPED";
        errorCode = null;
        plan = {
          ...plan,
          warnings: [...plan.warnings, "no-provider: spawn skipped"],
        };
      }

      plan = {
        ...plan,
        executionStatus: status,
        errorCode: errorCode ?? plan.errorCode,
      };
      allPlans.push(plan);

      if (persist) {
        const rec: StageStateRecord = {
          stage: plan.stage,
          status,
          attemptNumber: 1,
          schedulerRunId,
          startedAt,
          finishedAt: new Date().toISOString(),
          inputHash: plan.inputHash,
          outputHash: null,
          outputArtifacts: [],
          warnings: plan.warnings,
          errorCode,
        };
        state = upsertGameStage(
          state,
          plan.gameId,
          plan.scheduledStartTime,
          rec,
        );
        await releaseLock({
          cwd,
          league,
          dateKst: options.dateKst,
          gameId: plan.gameId,
        });
      }
    }

    if (persist && !options.dryRun) {
      await saveSchedulerState(state, cwd);
    }
  }

  const success = allPlans.filter((p) => p.executionStatus === "SUCCESS").length;
  const pass = allPlans.filter((p) => p.executionStatus === "PASS").length;
  const blocked = allPlans.filter((p) => p.executionStatus === "BLOCKED").length;
  const failed = allPlans.filter((p) => p.executionStatus === "FAILED").length;
  const skipped = allPlans.filter((p) => p.executionStatus === "SKIPPED").length;

  let overallStatus: SchedulerAuditArtifact["overallStatus"] = "SUCCESS";
  if (options.dryRun) overallStatus = "DRY_RUN";
  else if (globalBlocker) overallStatus = "FAILED";
  else if (failed > 0 && success + pass > 0) overallStatus = "PARTIAL_SUCCESS";
  else if (failed > 0) overallStatus = "FAILED";
  else if (success + pass === 0 && allPlans.length > 0) {
    overallStatus =
      blocked + skipped === allPlans.length ? "SUCCESS" : "PARTIAL_SUCCESS";
  }

  const audit: SchedulerAuditArtifact = {
    schemaVersion: "pregame-scheduler-audit-v1",
    dateKst: options.dateKst,
    league: options.league,
    generatedAt: new Date().toISOString(),
    schedulerRunId,
    dryRun: options.dryRun,
    totalGames: allPlans.length,
    stageCounts,
    success,
    pass,
    blocked,
    failed,
    skipped,
    duplicatePrevented,
    providerCalls: options.dryRun ? 0 : providerCalls,
    quotaWarnings,
    cutoffViolations,
    leakageRisk: options.dryRun ? "NONE" : cutoffViolations > 0 ? "WARN" : "NONE",
    lockConflicts,
    durationMs: Date.now() - started,
    overallStatus,
    games: allPlans,
  };

  if (persist && !options.dryRun) {
    await saveSchedulerAudit(audit, options.league, options.dateKst, cwd);
  }

  return {
    schedulerRunId,
    audit,
    plans: allPlans,
    providerCalls: audit.providerCalls,
    globalBlocker,
  };
}

function toStageRecord(
  plan: SchedulerGamePlan,
  schedulerRunId: string,
  now: Date,
): StageStateRecord {
  return {
    stage: plan.stage,
    status: plan.executionStatus,
    attemptNumber: 1,
    schedulerRunId,
    startedAt: now.toISOString(),
    finishedAt: now.toISOString(),
    inputHash: plan.inputHash,
    outputHash: null,
    outputArtifacts: [],
    warnings: plan.warnings,
    errorCode: plan.errorCode ?? null,
  };
}

export function formatDryRunText(plans: SchedulerGamePlan[]): string {
  const lines: string[] = [];
  for (const p of plans) {
    const startKst = (() => {
      try {
        return new Intl.DateTimeFormat("en-GB", {
          timeZone: "Asia/Seoul",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }).format(new Date(p.scheduledStartTime));
      } catch {
        return "?";
      }
    })();
    lines.push(`${p.league} ${p.gameId}`);
    lines.push(`- start: ${startKst} KST`);
    lines.push(`- secondsUntilStart: ${p.secondsUntilStart}`);
    lines.push(`- stage: ${p.stage}`);
    lines.push(
      `- action: ${p.action?.actionId ?? p.errorCode ?? p.executionStatus}`,
    );
    lines.push(`- reason: ${p.triggerReason}`);
    lines.push("");
  }
  return lines.join("\n").trimEnd();
}

/** Stable hash helper for tests */
export function hashParts(parts: Record<string, unknown>): string {
  return createHash("sha256")
    .update(JSON.stringify(parts))
    .digest("hex")
    .slice(0, 16);
}

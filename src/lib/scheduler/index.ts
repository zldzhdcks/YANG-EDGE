/**
 * Pregame Scheduler v1 orchestrator — plans and optionally runs existing runners.
 */

import { createHash, randomBytes } from "node:crypto";
import { computeInputHash, findSuccessfulStage } from "./idempotency";
import { resolveLeagueAction } from "./league-adapters";
import {
  buildMlbDailyOpsRunnerAction,
  mlbDailyOpsWindowForStage,
} from "./league-adapters/mlb";
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

const MLB_BATCH_STAGE_ORDER: PregameSchedulerStage[] = [
  "T90_COLLECTION",
  "T60_REFRESH",
  "T45_LINEUP_CHECK",
  "T30_FINAL_CHECK",
  "PREGAME_LOCK",
];

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

function planIsExecutableNow(plan: SchedulerGamePlan): boolean {
  if (
    plan.executionStatus === "BLOCKED" ||
    plan.executionStatus === "SKIPPED" ||
    plan.executionStatus === "NOT_IMPLEMENTED" ||
    plan.executionStatus === "MANUAL_REQUIRED" ||
    plan.executionStatus === "INPUT_VALIDATION_FAILED" ||
    plan.executionStatus === "PENDING" ||
    !plan.action ||
    plan.action.kind === "NOOP_CHECK"
  ) {
    return false;
  }
  return plan.executionStatus === "READY";
}

function isMlbDelegatedDailyOpsPlan(plan: SchedulerGamePlan): boolean {
  return (
    plan.league === "MLB" &&
    plan.action?.providerGuard === "DELEGATED" &&
    plan.action.kind === "SPAWN_TSX" &&
    mlbDailyOpsWindowForStage(plan.stage) != null
  );
}

/** Spawn Daily Ops under --no-provider; skip generic provider-capable runners. */
export function shouldSpawnSchedulerAction(
  action: RunnerAction,
  noProvider: boolean,
): boolean {
  if (action.kind !== "SPAWN_TSX" || !action.scriptRel) return false;
  if (!noProvider) return true;
  if (action.safeWhenNoProvider) return true;
  if (!action.mayCallProvider) return true;
  return false;
}

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
  cwd?: string;
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

  const action = resolveLeagueAction({
    league: input.league,
    stage,
    dateKst: input.dateKst,
    gameId: input.game.gameId,
    includePostgame: input.includePostgame,
    noProvider: input.noProvider,
    cwd: input.cwd,
    quotaRemaining: input.quotaRemaining,
  });

  const quota = evaluateQuotaGate(input.quotaRemaining);
  if (quota.warn) {
    warnings.push(
      quota.remaining == null
        ? "QUOTA_UNKNOWN: prefer cache/artifact"
        : `QUOTA_WARNING: remaining=${quota.remaining}`,
    );
  }
  const delegated = action.providerGuard === "DELEGATED";
  if (delegated) {
    warnings.push("QUOTA_DELEGATED_TO_DAILY_OPS");
  }
  if (!quota.allowProvider && action.mayCallProvider && !delegated) {
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
  } else if (action.kind === "INPUT_VALIDATION_FAILED") {
    executionStatus = "INPUT_VALIDATION_FAILED";
    errorCode = "INPUT_VALIDATION_FAILED";
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

type ExecuteCtx = {
  league: SchedulerLeague;
  dateKst: string;
  cwd: string;
  persist: boolean;
  dryRun: boolean;
  noProvider: boolean;
  schedulerRunId: string;
  now: Date;
  executeRunner?: (action: RunnerAction) => Promise<number>;
  memoryLocks: MemoryLockStore;
};

async function tryAcquirePlanLock(
  ctx: ExecuteCtx,
  plan: SchedulerGamePlan,
): Promise<{ ok: boolean; plan: SchedulerGamePlan }> {
  if (ctx.dryRun) {
    const acq = ctx.memoryLocks.acquire({
      lockKey: plan.lockKey,
      league: ctx.league,
      dateKst: ctx.dateKst,
      gameId: plan.gameId,
      stage: plan.stage,
      schedulerRunId: ctx.schedulerRunId,
      now: ctx.now,
    });
    if (!acq.ok) {
      return {
        ok: false,
        plan: {
          ...plan,
          executionStatus: "SKIPPED",
          errorCode: "SKIPPED_DUPLICATE_RUN",
          triggerReason: "DUPLICATE_RUN",
        },
      };
    }
    return { ok: true, plan };
  }
  if (!ctx.persist) return { ok: true, plan };
  const acq = await acquireLock({
    cwd: ctx.cwd,
    league: ctx.league,
    dateKst: ctx.dateKst,
    gameId: plan.gameId,
    stage: plan.stage,
    lockKey: plan.lockKey,
    schedulerRunId: ctx.schedulerRunId,
    now: ctx.now,
  });
  if (!acq.ok) {
    return {
      ok: false,
      plan: {
        ...plan,
        executionStatus: "SKIPPED",
        errorCode: "SKIPPED_DUPLICATE_RUN",
        triggerReason: "DUPLICATE_RUN",
      },
    };
  }
  return { ok: true, plan };
}

async function releasePlanLock(
  ctx: ExecuteCtx,
  plan: SchedulerGamePlan,
): Promise<void> {
  if (ctx.dryRun) {
    ctx.memoryLocks.release(ctx.league, ctx.dateKst, plan.gameId);
    return;
  }
  if (!ctx.persist) return;
  await releaseLock({
    cwd: ctx.cwd,
    league: ctx.league,
    dateKst: ctx.dateKst,
    gameId: plan.gameId,
  });
}

async function runSpawnAction(
  ctx: ExecuteCtx,
  action: RunnerAction,
): Promise<{
  status: SchedulerExecutionStatus;
  errorCode: StageStateRecord["errorCode"];
  countedProviderCall: boolean;
  warnings: string[];
}> {
  const warnings: string[] = [];
  if (!shouldSpawnSchedulerAction(action, ctx.noProvider)) {
    if (ctx.noProvider && action.mayCallProvider) {
      return {
        status: "SKIPPED",
        errorCode: null,
        countedProviderCall: false,
        warnings: ["no-provider: spawn skipped"],
      };
    }
    return {
      status: "SUCCESS",
      errorCode: null,
      countedProviderCall: false,
      warnings,
    };
  }

  const exec = ctx.executeRunner;
  if (!exec) {
    return {
      status: "FAILED",
      errorCode: "RUNNER_NOT_FOUND",
      countedProviderCall: false,
      warnings,
    };
  }
  try {
    const code = await exec(action);
    const countedProviderCall =
      Boolean(action.mayCallProvider) && !ctx.noProvider;
    if (countedProviderCall && action.providerGuard === "DELEGATED") {
      warnings.push(
        "DELEGATED_PROVIDER_ACCOUNTING: counted 1 daily-ops process",
      );
    }
    if (code !== 0) {
      return {
        status: "FAILED",
        errorCode: "RUNNER_EXIT_NONZERO",
        countedProviderCall,
        warnings,
      };
    }
    return {
      status: "SUCCESS",
      errorCode: null,
      countedProviderCall,
      warnings,
    };
  } catch {
    return {
      status: "FAILED",
      errorCode: "RUNNER_NOT_FOUND",
      countedProviderCall: false,
      warnings,
    };
  }
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

    const ctx: ExecuteCtx = {
      league,
      dateKst: options.dateKst,
      cwd,
      persist,
      dryRun: options.dryRun,
      noProvider: options.noProvider,
      schedulerRunId,
      now,
      executeRunner: options.executeRunner,
      memoryLocks,
    };

    const planned: SchedulerGamePlan[] = [];
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

      const plan = await planGame({
        league,
        dateKst: options.dateKst,
        game,
        now,
        forceStage: options.forceStage,
        includePostgame: options.includePostgame,
        noProvider: options.noProvider,
        existingState: state,
        quotaRemaining: options.quotaRemaining,
        cwd,
      });
      planned.push(plan);
      stageCounts[plan.stage] = (stageCounts[plan.stage] ?? 0) + 1;
      if (plan.warnings.some((w) => w.startsWith("QUOTA_"))) quotaWarnings += 1;
      if (plan.errorCode === "BLOCKED_AFTER_START") cutoffViolations += 1;
    }

    const persistPlan = async (plan: SchedulerGamePlan) => {
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
    };

    if (options.dryRun) {
      for (const plan of planned) {
        await persistPlan(
          plan.executionStatus === "READY"
            ? { ...plan, triggerReason: "DRY_RUN" }
            : plan,
        );
      }
      continue;
    }

    const mlbBatches = new Map<PregameSchedulerStage, SchedulerGamePlan[]>();
    const perGame: SchedulerGamePlan[] = [];
    for (const plan of planned) {
      if (!planIsExecutableNow(plan)) {
        await persistPlan(plan);
        continue;
      }
      if (isMlbDelegatedDailyOpsPlan(plan)) {
        const list = mlbBatches.get(plan.stage) ?? [];
        list.push(plan);
        mlbBatches.set(plan.stage, list);
      } else {
        perGame.push(plan);
      }
    }

    const runMlbBatch = async (batch: SchedulerGamePlan[]) => {
      const members: SchedulerGamePlan[] = [];
      for (const plan of batch) {
        const acq = await tryAcquirePlanLock(ctx, plan);
        if (!acq.ok) {
          duplicatePrevented += 1;
          lockConflicts += 1;
          await persistPlan(acq.plan);
          continue;
        }
        members.push(acq.plan);
      }
      if (members.length === 0) return;

      const window = mlbDailyOpsWindowForStage(members[0]!.stage);
      if (!window) return;
      const action = buildMlbDailyOpsRunnerAction({
        dateKst: options.dateKst,
        window,
        gameIds: members.map((m) => m.gameId),
        noProvider: options.noProvider,
        quotaRemaining: options.quotaRemaining,
      });
      const startedAt = new Date().toISOString();
      const spawn = await runSpawnAction(ctx, action);
      if (spawn.countedProviderCall) providerCalls += 1;

      for (const plan of members) {
        const updated: SchedulerGamePlan = {
          ...plan,
          action,
          executionStatus: spawn.status,
          errorCode: spawn.errorCode ?? plan.errorCode,
          warnings: [...plan.warnings, ...spawn.warnings],
        };
        allPlans.push(updated);
        if (persist) {
          const rec: StageStateRecord = {
            stage: updated.stage,
            status: spawn.status,
            attemptNumber: 1,
            schedulerRunId,
            startedAt,
            finishedAt: new Date().toISOString(),
            inputHash: updated.inputHash,
            outputHash: null,
            outputArtifacts: [],
            warnings: updated.warnings,
            errorCode: spawn.errorCode,
          };
          state = upsertGameStage(
            state,
            updated.gameId,
            updated.scheduledStartTime,
            rec,
          );
          await releasePlanLock(ctx, updated);
        }
      }
    };

    for (const stage of MLB_BATCH_STAGE_ORDER) {
      const batch = mlbBatches.get(stage);
      if (batch?.length) await runMlbBatch(batch);
    }
    for (const [stage, batch] of mlbBatches) {
      if (!MLB_BATCH_STAGE_ORDER.includes(stage) && batch.length) {
        await runMlbBatch(batch);
      }
    }

    for (const plan0 of perGame) {
      const acq = await tryAcquirePlanLock(ctx, plan0);
      if (!acq.ok) {
        duplicatePrevented += 1;
        lockConflicts += 1;
        await persistPlan(acq.plan);
        continue;
      }
      let plan = acq.plan;
      const startedAt = new Date().toISOString();
      const action = plan.action;
      let status: SchedulerExecutionStatus = "SUCCESS";
      let errorCode: StageStateRecord["errorCode"] = null;
      const extraWarnings: string[] = [];
      if (action) {
        const spawn = await runSpawnAction(ctx, action);
        status = spawn.status;
        errorCode = spawn.errorCode;
        extraWarnings.push(...spawn.warnings);
        if (spawn.countedProviderCall) providerCalls += 1;
      }
      plan = {
        ...plan,
        executionStatus: status,
        errorCode: errorCode ?? plan.errorCode,
        warnings: [...plan.warnings, ...extraWarnings],
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
        await releasePlanLock(ctx, plan);
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

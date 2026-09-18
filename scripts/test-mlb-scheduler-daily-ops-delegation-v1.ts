/**
 * MLB Scheduler batched Daily Ops delegation v1.
 * Fixture / mock only — zero live Provider calls.
 *
 *   npm run test:mlb-scheduler-daily-ops-delegation-v1
 */
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  decideMlbDailyCollection,
  deriveEffectiveEarliestStart,
  evaluateCutoffGate,
  runMlbDailyPregameV0,
} from "../src/lib/mlb/daily-pregame-v0";
import { computeInputHash } from "../src/lib/scheduler/idempotency";
import {
  mlbAction,
  MLB_DAILY_OPS_SCRIPT_REL,
} from "../src/lib/scheduler/league-adapters/mlb";
import {
  acquireLock,
} from "../src/lib/scheduler/lock-store";
import {
  canonicalSchedulerGameId,
  detectLockedPrediction,
  loadScheduleGames,
  mlbOfficialPredictionRel,
  predictionRowMatchesSchedulerGameId,
} from "../src/lib/scheduler/load-schedule";
import { runPregameScheduler } from "../src/lib/scheduler";
import { buildLockKey } from "../src/lib/scheduler/resolve-stage";
import { emptyState, saveSchedulerState } from "../src/lib/scheduler/state-store";
import type {
  RunnerAction,
  SchedulerGameInput,
} from "../src/lib/scheduler/types";
import { parsePregameSchedulerCliArgs } from "./run-pregame-scheduler-v1";

const DATE = "2026-08-01";
const NOW = new Date("2026-08-01T12:00:00.000Z");

function start(minutesUntil: number, now = NOW): string {
  return new Date(now.getTime() + minutesUntil * 60_000).toISOString();
}

function gameIdsFromArgs(args: string[] | undefined): string[] {
  const ids: string[] = [];
  if (!args) return ids;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--game-id" && args[i + 1]) ids.push(args[++i]!);
  }
  return ids;
}

function windowFromArgs(args: string[] | undefined): string | null {
  if (!args) return null;
  const i = args.indexOf("--window");
  return i >= 0 ? (args[i + 1] ?? null) : null;
}

function quotaFromArgs(args: string[] | undefined): string | null {
  if (!args) return null;
  const i = args.indexOf("--quota-remaining");
  return i >= 0 ? (args[i + 1] ?? null) : null;
}

function writeJson(cwd: string, rel: string, body: unknown) {
  const abs = path.join(cwd, rel);
  mkdirSync(path.dirname(abs), { recursive: true });
  writeFileSync(abs, `${JSON.stringify(body, null, 2)}\n`, "utf8");
}

function tmpCwd(prefix: string): string {
  const cwd = mkdtempSync(path.join(tmpdir(), prefix));
  mkdirSync(path.join(cwd, "data", "scheduler"), { recursive: true });
  return cwd;
}

function assertNoLegacyMlbScripts(action: RunnerAction | null | undefined) {
  const blob = `${action?.scriptRel ?? ""} ${(action?.args ?? []).join(" ")}`;
  assert.equal(blob.includes("run-mlb-starter-accumulation"), false);
  assert.equal(blob.includes("build-mlb-odds-history-dataset-v1"), false);
  assert.equal(blob.includes("build-mlb-lineup-dataset-v1"), false);
  assert.equal(blob.includes("run-mlb-remaining-pregame-accumulation"), false);
  assert.equal(blob.includes("build-mlb-prediction-snapshot-v1"), false);
}

async function main() {
  // 1. MLB canonical ID prefers internalGameId over gamePk
  assert.equal(
    canonicalSchedulerGameId("MLB", {
      gamePk: 777,
      gameId: "numeric-fallback",
      internalGameId: "mlb-baltimore-orioles-new-york-yankees",
    }),
    "mlb-baltimore-orioles-new-york-yankees",
  );
  assert.equal(
    canonicalSchedulerGameId("KBO", {
      gamePk: 12,
      internalGameId: "kbo-slug",
    }),
    "12",
  );

  const idCwd = tmpCwd("sch-mlb-id-");
  writeJson(idCwd, `data/research/mlb/${DATE}-schedule-v1.json`, {
    dateKst: DATE,
    games: [
      {
        internalGameId: "mlb-baltimore-orioles-new-york-yankees",
        gamePk: 777,
        commenceTimeUtc: start(60),
        statusAbstract: "Preview",
      },
    ],
  });
  const loaded = await loadScheduleGames({
    league: "MLB",
    dateKst: DATE,
    cwd: idCwd,
  });
  assert.equal(loaded.games[0]?.gameId, "mlb-baltimore-orioles-new-york-yankees");

  // 2–7. Stage → Daily Ops window mapping; no legacy scripts
  const map: Array<[SchedulerGameInput["gameId"], number, string]> = [
    ["t90", 100, "T90"],
    ["t60", 60, "T60"],
    ["t45", 45, "T45"],
    ["t30", 25, "T30"],
    ["lock", 10, "LOCK"],
  ];
  const stages = [
    "T90_COLLECTION",
    "T60_REFRESH",
    "T45_LINEUP_CHECK",
    "T30_FINAL_CHECK",
    "PREGAME_LOCK",
  ] as const;
  for (let i = 0; i < map.length; i++) {
    const [, , window] = map[i]!;
    const stage = stages[i]!;
    const action = mlbAction({
      stage,
      dateKst: DATE,
      gameId: "mlb-game-a",
      includePostgame: false,
      noProvider: false,
      quotaRemaining: 465,
    });
    assert.equal(action.actionId, "RUN_MLB_DAILY_OPS");
    assert.equal(action.scriptRel, MLB_DAILY_OPS_SCRIPT_REL);
    assert.equal(windowFromArgs(action.args), window);
    assert.deepEqual(gameIdsFromArgs(action.args), ["mlb-game-a"]);
    assert.equal(quotaFromArgs(action.args), "465");
    assert.equal(action.providerGuard, "DELEGATED");
    assert.equal(action.safeWhenNoProvider, true);
    assertNoLegacyMlbScripts(action);
  }

  const discovery = mlbAction({
    stage: "SCHEDULE_DISCOVERY",
    dateKst: DATE,
    gameId: "mlb-game-a",
    includePostgame: false,
    noProvider: false,
  });
  assert.equal(discovery.scriptRel, "scripts/build-mlb-schedule-artifact-v1.ts");

  // 8. Three T60 games → one Daily Ops spawn
  const calls8: RunnerAction[] = [];
  const threeT60: SchedulerGameInput[] = [
    { gameId: "mlb-game-a", scheduledStartTime: start(60) },
    { gameId: "mlb-game-b", scheduledStartTime: start(60) },
    { gameId: "mlb-game-c", scheduledStartTime: start(60) },
  ];
  const r8 = await runPregameScheduler({
    dateKst: DATE,
    league: "MLB",
    dryRun: false,
    noProvider: false,
    includePostgame: false,
    json: false,
    now: NOW,
    fixtureGames: threeT60,
    cwd: tmpCwd("sch-mlb-batch8-"),
    persist: true,
    quotaRemaining: 465,
    executeRunner: async (action) => {
      calls8.push(action);
      return 0;
    },
  });
  assert.equal(calls8.length, 1);
  assert.equal(windowFromArgs(calls8[0]?.args), "T60");
  assert.deepEqual(gameIdsFromArgs(calls8[0]?.args), [
    "mlb-game-a",
    "mlb-game-b",
    "mlb-game-c",
  ]);
  assert.equal(quotaFromArgs(calls8[0]?.args), "465");
  assert.equal(r8.plans.every((p) => p.executionStatus === "SUCCESS"), true);
  assert.equal(r8.providerCalls, 1);
  assert.ok(
    r8.plans[0]?.warnings.some((w) =>
      w.includes("DELEGATED_PROVIDER_ACCOUNTING"),
    ),
  );

  // 9. Two T60 + one T30 → two spawns; do not collapse windows
  const calls9: string[] = [];
  const r9 = await runPregameScheduler({
    dateKst: DATE,
    league: "MLB",
    dryRun: false,
    noProvider: false,
    includePostgame: false,
    json: false,
    now: NOW,
    fixtureGames: [
      { gameId: "t60-1", scheduledStartTime: start(60) },
      { gameId: "t60-2", scheduledStartTime: start(60) },
      { gameId: "t30-1", scheduledStartTime: start(25) },
    ],
    cwd: tmpCwd("sch-mlb-batch9-"),
    persist: true,
    executeRunner: async (action) => {
      calls9.push(windowFromArgs(action.args) ?? "");
      return 0;
    },
  });
  assert.equal(calls9.length, 2);
  assert.deepEqual(calls9.sort(), ["T30", "T60"]);
  const t60Plan = r9.plans.find((p) => p.gameId === "t60-1");
  assert.deepEqual(gameIdsFromArgs(t60Plan?.action?.args), ["t60-1", "t60-2"]);
  assert.deepEqual(
    gameIdsFromArgs(r9.plans.find((p) => p.gameId === "t30-1")?.action?.args),
    ["t30-1"],
  );

  // 11. Already-completed game excluded from batch
  const doneCwd = tmpCwd("sch-mlb-done-");
  const start60 = start(60);
  const hashA = computeInputHash({
    league: "MLB",
    dateKst: DATE,
    gameId: "mlb-a",
    stage: "T60_REFRESH",
    scheduledStartTime: start60,
    status: null,
  });
  let state = emptyState("MLB", DATE);
  state = {
    ...state,
    games: [
      {
        gameId: "mlb-a",
        scheduledStartTime: start60,
        latestStage: "T60_REFRESH",
        overallStatus: "SUCCESS",
        stages: [
          {
            stage: "T60_REFRESH",
            status: "SUCCESS",
            attemptNumber: 1,
            schedulerRunId: "sch-prior",
            startedAt: NOW.toISOString(),
            finishedAt: NOW.toISOString(),
            inputHash: hashA,
            outputHash: null,
            outputArtifacts: [],
            warnings: [],
            errorCode: null,
          },
        ],
      },
    ],
  };
  await saveSchedulerState(state, doneCwd);
  const calls11: RunnerAction[] = [];
  const r11 = await runPregameScheduler({
    dateKst: DATE,
    league: "MLB",
    dryRun: false,
    noProvider: false,
    includePostgame: false,
    json: false,
    now: NOW,
    fixtureGames: [
      { gameId: "mlb-a", scheduledStartTime: start60 },
      { gameId: "mlb-b", scheduledStartTime: start60 },
      { gameId: "mlb-c", scheduledStartTime: start60 },
    ],
    cwd: doneCwd,
    persist: true,
    executeRunner: async (action) => {
      calls11.push(action);
      return 0;
    },
  });
  assert.equal(r11.plans.find((p) => p.gameId === "mlb-a")?.executionStatus, "SKIPPED");
  assert.equal(calls11.length, 1);
  assert.deepEqual(gameIdsFromArgs(calls11[0]?.args), ["mlb-b", "mlb-c"]);

  // 12–13. Per-game locks; one conflict does not block remaining members
  const lockCwd = tmpCwd("sch-mlb-lock-");
  const lockAcq = await acquireLock({
    cwd: lockCwd,
    league: "MLB",
    dateKst: DATE,
    gameId: "mlb-b",
    stage: "T60_REFRESH",
    lockKey: buildLockKey({
      league: "MLB",
      dateKst: DATE,
      gameId: "mlb-b",
      stage: "T60_REFRESH",
    }),
    schedulerRunId: "sch-other",
    now: NOW,
  });
  assert.equal(lockAcq.ok, true);
  const calls13: RunnerAction[] = [];
  const r13 = await runPregameScheduler({
    dateKst: DATE,
    league: "MLB",
    dryRun: false,
    noProvider: false,
    includePostgame: false,
    json: false,
    now: NOW,
    fixtureGames: [
      { gameId: "mlb-a", scheduledStartTime: start60 },
      { gameId: "mlb-b", scheduledStartTime: start60 },
      { gameId: "mlb-c", scheduledStartTime: start60 },
    ],
    cwd: lockCwd,
    persist: true,
    executeRunner: async (action) => {
      calls13.push(action);
      return 0;
    },
  });
  assert.equal(calls13.length, 1);
  assert.deepEqual(gameIdsFromArgs(calls13[0]?.args), ["mlb-a", "mlb-c"]);
  assert.equal(r13.plans.find((p) => p.gameId === "mlb-b")?.errorCode, "SKIPPED_DUPLICATE_RUN");
  assert.equal(r13.plans.find((p) => p.gameId === "mlb-a")?.executionStatus, "SUCCESS");
  assert.equal(r13.audit.lockConflicts, 1);

  // 14–15. Official V0 path + structured match; locked game excluded from LOCK
  const predCwd = tmpCwd("sch-mlb-pred-");
  writeJson(predCwd, `data/research/mlb/${DATE}-schedule-v1.json`, {
    dateKst: DATE,
    games: [
      {
        internalGameId: "mlb-locked",
        gamePk: 1,
        commenceTimeUtc: start(10),
        statusAbstract: "Preview",
      },
      {
        internalGameId: "mlb-open",
        gamePk: 2,
        commenceTimeUtc: start(10),
        statusAbstract: "Preview",
      },
    ],
  });
  writeJson(predCwd, mlbOfficialPredictionRel(DATE), {
    meta: { dateKst: DATE },
    predictions: [
      {
        gameId: "mlb-locked",
        externalId: "1",
        officialStatus: "ELIGIBLE",
      },
    ],
  });
  assert.equal(
    predictionRowMatchesSchedulerGameId(
      { gameId: "mlb-locked", externalId: "1" },
      "mlb-locked",
    ),
    true,
  );
  assert.equal(
    await detectLockedPrediction({
      league: "MLB",
      dateKst: DATE,
      gameId: "mlb-locked",
      cwd: predCwd,
    }),
    true,
  );
  assert.equal(
    await detectLockedPrediction({
      league: "MLB",
      dateKst: DATE,
      gameId: "mlb-open",
      cwd: predCwd,
    }),
    false,
  );
  const calls15: RunnerAction[] = [];
  const r15 = await runPregameScheduler({
    dateKst: DATE,
    league: "MLB",
    dryRun: false,
    noProvider: false,
    includePostgame: false,
    json: false,
    now: NOW,
    cwd: predCwd,
    persist: true,
    executeRunner: async (action) => {
      calls15.push(action);
      return 0;
    },
  });
  assert.equal(r15.plans.find((p) => p.gameId === "mlb-locked")?.errorCode, "ALREADY_LOCKED");
  const openPlan = r15.plans.find((p) => p.gameId === "mlb-open");
  assert.equal(openPlan?.stage, "PREGAME_LOCK");
  assert.equal(openPlan?.action?.actionId, "RUN_MLB_DAILY_OPS");
  assert.equal(windowFromArgs(openPlan?.action?.args), "LOCK");
  assert.deepEqual(gameIdsFromArgs(calls15[0]?.args), ["mlb-open"]);
  assert.equal(calls15.length, 1);

  // 16–17. Scheduler CLI quota flows; null omitted
  const parsed = parsePregameSchedulerCliArgs([
    "--date",
    DATE,
    "--league",
    "MLB",
    "--quota-remaining",
    "465",
    "--dry-run",
  ]);
  assert.equal(parsed.quotaRemaining, 465);
  const parsedNoQ = parsePregameSchedulerCliArgs([
    "--date",
    DATE,
    "--league",
    "MLB",
    "--dry-run",
  ]);
  assert.equal(parsedNoQ.quotaRemaining, null);

  const actionNoQ = mlbAction({
    stage: "T60_REFRESH",
    dateKst: DATE,
    gameId: "mlb-a",
    includePostgame: false,
    noProvider: false,
    quotaRemaining: null,
  });
  assert.equal(quotaFromArgs(actionNoQ.args), null);

  const r16 = await runPregameScheduler({
    dateKst: DATE,
    league: "MLB",
    dryRun: false,
    noProvider: false,
    includePostgame: false,
    json: false,
    now: NOW,
    fixtureGames: [{ gameId: "mlb-q", scheduledStartTime: start(60) }],
    cwd: tmpCwd("sch-mlb-q-"),
    persist: true,
    quotaRemaining: 465,
    executeRunner: async (action) => {
      assert.equal(quotaFromArgs(action.args), "465");
      return 0;
    },
  });
  assert.equal(r16.plans[0]?.executionStatus, "SUCCESS");

  // 18. --no-provider still executes delegated Daily Ops
  const calls18: RunnerAction[] = [];
  const r18 = await runPregameScheduler({
    dateKst: DATE,
    league: "MLB",
    dryRun: false,
    noProvider: true,
    includePostgame: false,
    json: false,
    now: NOW,
    fixtureGames: [{ gameId: "mlb-np", scheduledStartTime: start(60) }],
    cwd: tmpCwd("sch-mlb-np-"),
    persist: true,
    executeRunner: async (action) => {
      calls18.push(action);
      return 0;
    },
  });
  assert.equal(calls18.length, 1);
  assert.ok(calls18[0]?.args?.includes("--no-provider"));
  assert.equal(r18.plans[0]?.executionStatus, "SUCCESS");
  assert.equal(r18.providerCalls, 0);

  // 19. Windowed ODDS missing + unknown quota does not permit Odds spawn
  const missing = decideMlbDailyCollection({
    window: "T60",
    dataset: "ODDS",
    exists: false,
    quotaRemaining: null,
  });
  assert.equal(missing.spawnAllowed, false);
  assert.equal(missing.providerPolicy, "QUOTA_DECISION_EXTERNAL");

  // 20–21. effectiveEarliestStart scoped; earlier game does not poison later T60
  const early = "2099-06-15T12:00:00.000Z";
  const late = "2099-06-15T14:00:00.000Z";
  assert.equal(
    deriveEffectiveEarliestStart({
      games: [
        { gameId: "early", commenceTimeUtc: early },
        { gameId: "late", commenceTimeUtc: late },
      ],
      filterIds: ["late"],
      fallbackEarliestStart: early,
    }),
    late,
  );
  const asOf = "2099-06-15T13:00:00.000Z";
  const observedPoison = "2099-06-15T12:00:00.000Z";
  const poisoned = decideMlbDailyCollection({
    window: "T60",
    dataset: "ODDS",
    exists: true,
    observedAtIso: observedPoison,
    earliestStartIso: early,
    quotaRemaining: 465,
  });
  const scoped = decideMlbDailyCollection({
    window: "T60",
    dataset: "ODDS",
    exists: true,
    observedAtIso: observedPoison,
    earliestStartIso: late,
    quotaRemaining: 465,
  });
  assert.equal(poisoned.code, "SKIP_FRESH");
  assert.equal(scoped.code, "REFRESH_STALE");

  const scopeCwd = tmpCwd("sch-mlb-scope-");
  writeJson(scopeCwd, `data/research/mlb/2099-06-15-schedule-v1.json`, {
    dateKst: "2099-06-15",
    games: [
      {
        internalGameId: "early",
        gamePk: 1,
        commenceTimeUtc: early,
        statusAbstract: "In Progress",
      },
      {
        internalGameId: "late",
        gamePk: 2,
        commenceTimeUtc: late,
        statusAbstract: "Preview",
      },
    ],
  });
  writeJson(scopeCwd, `data/research/mlb/2099-06-15-starter-dataset-v1.json`, {
    meta: { generatedAt: observedPoison, dateKst: "2099-06-15" },
    rows: [
      { gameId: "late", side: "home" },
      { gameId: "late", side: "away" },
    ],
    summary: {},
  });
  writeJson(scopeCwd, `data/research/mlb/2099-06-15-odds-history-dataset-v1.json`, {
    meta: { generatedAt: observedPoison, dateKst: "2099-06-15" },
    rows: [
      {
        gameId: "late",
        collectionStatus: "COLLECTED",
        moneylineHome: 1.8,
        moneylineAway: 2.0,
      },
    ],
  });
  writeJson(scopeCwd, `data/research/mlb/2099-06-15-lineup-dataset-v1.json`, {
    meta: { generatedAt: observedPoison, dateKst: "2099-06-15" },
    rows: [{ gameId: "late", collectionStatus: "NOT_RELEASED" }],
  });
  const oddsSpawns: string[] = [];
  const scopedRun = await runMlbDailyPregameV0({
    dateKst: "2099-06-15",
    cwd: scopeCwd,
    window: "T60",
    asOf,
    gameIds: ["late"],
    noProvider: false,
    dryRun: false,
    writePrediction: false,
    quotaRemaining: 465,
    spawnCollector: async (scriptRel) => {
      if (scriptRel.includes("build-mlb-odds-history-dataset-v1")) {
        oddsSpawns.push(scriptRel);
      }
      return 0;
    },
  });
  assert.equal(scopedRun.earliestStart, late);
  const oddsStage = scopedRun.stages.find((s) => s.stage === "ODDS");
  assert.equal(oddsStage?.detail?.collectionDecision, "REFRESH_STALE");
  assert.equal(oddsSpawns.length, 1);
  const cutoffLate = evaluateCutoffGate({
    schedule: {
      exists: true,
      path: "",
      hash: null,
      dateKstMatch: true,
      totalGames: 2,
      pregameGames: 1,
      cancelled: 0,
      postponed: 0,
      started: 1,
      final: 0,
      earliestStart: early,
      latestStart: late,
      duplicateGameIds: [],
      warnings: [],
      games: [
        {
          gameId: "early",
          gamePk: 1,
          homeTeam: "",
          awayTeam: "",
          commenceTimeUtc: early,
          status: "In Progress",
        },
        {
          gameId: "late",
          gamePk: 2,
          homeTeam: "",
          awayTeam: "",
          commenceTimeUtc: late,
          status: "Preview",
        },
      ],
    },
    asOfIso: asOf,
    gameIds: ["late"],
  });
  assert.equal(cutoffLate.blocked, false);
  assert.equal(cutoffLate.earliestStart, late);

  // 22–23. Non-LOCK Daily Ops action is not LOCK; LOCK maps to Daily Ops
  const t90 = mlbAction({
    stage: "T90_COLLECTION",
    dateKst: DATE,
    gameId: "x",
    includePostgame: false,
    noProvider: false,
  });
  assert.equal(windowFromArgs(t90.args), "T90");
  assert.notEqual(windowFromArgs(t90.args), "LOCK");
  const lock = mlbAction({
    stage: "PREGAME_LOCK",
    dateKst: DATE,
    gameId: "x",
    includePostgame: false,
    noProvider: false,
  });
  assert.equal(lock.scriptRel, MLB_DAILY_OPS_SCRIPT_REL);
  assert.equal(windowFromArgs(lock.args), "LOCK");
  assert.equal(lock.mayCallProvider, false);

  console.log("test:mlb-scheduler-daily-ops-delegation-v1 OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

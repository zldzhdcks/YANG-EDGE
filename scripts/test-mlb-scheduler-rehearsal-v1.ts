/**
 * MLB Scheduler operational no-provider rehearsal gate v1.
 * Fixture + checked-in artifacts. Zero live Provider calls. No historical rewrite.
 *
 *   npm run test:mlb-scheduler-rehearsal-v1
 *
 * REHEARSAL_NOT_RESEARCH_EVIDENCE
 * HISTORICAL_AS_OF_IS_CONTROL_PLANE_ONLY=true
 */
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { parseMlbDailyOpsCliArgs } from "./run-mlb-daily-ops-v1";
import {
  parsePregameSchedulerCliArgs,
  parseRehearsalAsOfIso,
} from "./run-pregame-scheduler-v1";
import { runMlbDailyOpsV1 } from "../src/lib/mlb/daily-ops-v1";
import { runPregameScheduler } from "../src/lib/scheduler";
import { buildMlbDailyOpsRunnerAction } from "../src/lib/scheduler/league-adapters/mlb";
import { lockFilePath } from "../src/lib/scheduler/lock-store";
import { loadScheduleGames } from "../src/lib/scheduler/load-schedule";
import {
  schedulerAuditPath,
  schedulerStatePath,
} from "../src/lib/scheduler/state-store";
import type { RunnerAction } from "../src/lib/scheduler/types";

const DATE_0820 = "2026-08-20";
const DATE_0830 = "2026-08-30";
const EVENT_824801 = "mlb-game-824801";
const EVENT_823176 = "mlb-game-823176";
const SIBLING_823177 = "mlb-game-823177";
const AS_OF_0820 = "2026-08-19T21:00:00Z";
const AS_OF_0830 = "2026-08-30T00:30:00Z";
const REPO = process.cwd();
const NOW_T90 = new Date("2026-08-01T12:00:00.000Z");

function tmpCwd(prefix: string): string {
  return mkdtempSync(path.join(tmpdir(), prefix));
}

function start(minutesUntil: number, now = NOW_T90): string {
  return new Date(now.getTime() + minutesUntil * 60_000).toISOString();
}

function hasFlag(args: string[] | undefined, flag: string): boolean {
  return Boolean(args?.includes(flag));
}

function argValue(args: string[] | undefined, flag: string): string | null {
  if (!args) return null;
  const i = args.indexOf(flag);
  if (i < 0) return null;
  return args[i + 1] ?? "";
}

function gameIdsFromArgs(args: string[] | undefined): string[] {
  const ids: string[] = [];
  if (!args) return ids;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--game-id" && args[i + 1]) ids.push(args[i + 1]!);
  }
  return ids;
}

function listIfExists(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { recursive: true }).map(String);
}

async function main() {
  // 1. --rehearsal parses
  const parsed = parsePregameSchedulerCliArgs([
    "--date",
    DATE_0820,
    "--league",
    "MLB",
    "--gameId",
    EVENT_824801,
    "--rehearsal",
    "--rehearsal-as-of",
    AS_OF_0820,
    "--json",
  ]);
  assert.equal(parsed.rehearsal, true);
  assert.equal(parsed.rehearsalAsOf, AS_OF_0820);

  // 2–5. rehearsal forces dryRun=false persist=false noProvider=true includePostgame=false
  assert.equal(parsed.dryRun, false);
  assert.equal(parsed.persist, false);
  assert.equal(parsed.noProvider, true);
  assert.equal(parsed.includePostgame, false);
  assert.equal(parsed.now?.toISOString(), new Date(AS_OF_0820).toISOString());

  // 6. --rehearsal + --dry-run rejected
  assert.throws(
    () =>
      parsePregameSchedulerCliArgs([
        "--date",
        DATE_0820,
        "--league",
        "MLB",
        "--rehearsal",
        "--dry-run",
      ]),
    /REHEARSAL_CONFLICT/,
  );

  // 7. --rehearsal + --include-postgame rejected
  assert.throws(
    () =>
      parsePregameSchedulerCliArgs([
        "--date",
        DATE_0820,
        "--league",
        "MLB",
        "--rehearsal",
        "--include-postgame",
      ]),
    /REHEARSAL_CONFLICT/,
  );

  // 8. --rehearsal-as-of without --rehearsal rejected
  assert.throws(
    () =>
      parsePregameSchedulerCliArgs([
        "--date",
        DATE_0820,
        "--league",
        "MLB",
        "--rehearsal-as-of",
        AS_OF_0820,
      ]),
    /REHEARSAL_AS_OF_REQUIRES_REHEARSAL/,
  );

  // 9. invalid ISO rejected
  assert.throws(
    () => parseRehearsalAsOfIso("2026-08-19T21:00:00"),
    /REHEARSAL_AS_OF_INVALID_ISO/,
  );
  assert.throws(
    () =>
      parsePregameSchedulerCliArgs([
        "--date",
        DATE_0820,
        "--league",
        "MLB",
        "--rehearsal",
        "--rehearsal-as-of",
        "not-an-iso",
      ]),
    /REHEARSAL_AS_OF_INVALID_ISO/,
  );

  // 10–12. KBO / NPB / ALL rehearsal rejected
  for (const league of ["KBO", "NPB", "ALL"] as const) {
    assert.throws(
      () =>
        parsePregameSchedulerCliArgs([
          "--date",
          DATE_0820,
          "--league",
          league,
          "--rehearsal",
        ]),
      /REHEARSAL_MLB_ONLY/,
    );
  }

  const fixtureT90 = [
    { gameId: "mlb-game-fixture-t90", scheduledStartTime: start(95) },
  ];
  const fixtureLock = [
    { gameId: "mlb-game-fixture-lock", scheduledStartTime: start(10) },
  ];

  // 13. Runner executor IS called during rehearsal
  const rehearsalCalls: RunnerAction[] = [];
  const rehearsalCwd = tmpCwd("sch-reh-");
  const rRehearsal = await runPregameScheduler({
    dateKst: "2026-08-01",
    league: "MLB",
    dryRun: false,
    persist: true,
    noProvider: false,
    includePostgame: true,
    json: false,
    now: NOW_T90,
    cwd: rehearsalCwd,
    fixtureGames: fixtureT90,
    rehearsal: true,
    rehearsalAsOf: "2026-08-01T12:00:00Z",
    executeRunner: async (action) => {
      rehearsalCalls.push(action);
      return 0;
    },
  });
  assert.equal(rehearsalCalls.length, 1);
  assert.equal(rRehearsal.audit.dryRun, false);
  assert.equal(rRehearsal.audit.persist, false);
  assert.equal(rRehearsal.audit.rehearsal, true);
  assert.equal(rRehearsal.plans[0]?.stage, "T90_COLLECTION");
  assert.equal(rRehearsal.plans[0]?.executionStatus, "SUCCESS");

  // 14. Runner executor is NOT called during normal dry-run
  let dryRunCalls = 0;
  const rDry = await runPregameScheduler({
    dateKst: "2026-08-01",
    league: "MLB",
    dryRun: true,
    persist: false,
    noProvider: false,
    includePostgame: false,
    json: false,
    now: NOW_T90,
    cwd: tmpCwd("sch-dry-"),
    fixtureGames: fixtureT90,
    executeRunner: async () => {
      dryRunCalls += 1;
      return 0;
    },
  });
  assert.equal(dryRunCalls, 0);
  assert.equal(rDry.audit.dryRun, true);
  assert.equal(rDry.plans[0]?.executionStatus, "READY");

  const childArgs = rehearsalCalls[0]?.args;
  // 15–18. Rehearsal Daily Ops args
  assert.ok(hasFlag(childArgs, "--no-provider"));
  assert.ok(hasFlag(childArgs, "--no-write"));
  assert.ok(hasFlag(childArgs, "--no-seal"));
  assert.equal(argValue(childArgs, "--rehearsal-as-of"), "2026-08-01T12:00:00Z");
  assert.equal(argValue(childArgs, "--window"), "T90");

  // 19. LOCK rehearsal cannot write Prediction
  const lockAction = buildMlbDailyOpsRunnerAction({
    dateKst: "2026-08-01",
    window: "LOCK",
    gameIds: ["mlb-game-fixture-lock"],
    noProvider: true,
    rehearsal: true,
    rehearsalAsOf: "2026-08-01T12:00:00Z",
  });
  assert.ok(hasFlag(lockAction.args, "--no-write"));
  assert.ok(hasFlag(lockAction.args, "--no-seal"));
  assert.ok(hasFlag(lockAction.args, "--no-provider"));

  const lockCalls: RunnerAction[] = [];
  await runPregameScheduler({
    dateKst: "2026-08-01",
    league: "MLB",
    dryRun: false,
    noProvider: false,
    includePostgame: false,
    json: false,
    now: NOW_T90,
    cwd: tmpCwd("sch-lock-reh-"),
    fixtureGames: fixtureLock,
    rehearsal: true,
    rehearsalAsOf: "2026-08-01T12:00:00Z",
    executeRunner: async (action) => {
      lockCalls.push(action);
      return 0;
    },
  });
  assert.equal(lockCalls.length, 1);
  assert.ok(hasFlag(lockCalls[0]?.args, "--no-write"));
  assert.equal(argValue(lockCalls[0]?.args, "--window"), "LOCK");

  const dailyLock = parseMlbDailyOpsCliArgs([
    "--date",
    "2026-08-01",
    "--window",
    "LOCK",
    "--game-id",
    "mlb-game-fixture-lock",
    "--no-provider",
    "--no-write",
    "--no-seal",
    "--rehearsal-as-of",
    "2026-08-01T12:00:00Z",
  ]);
  assert.equal(dailyLock.writePrediction, false);
  assert.equal(dailyLock.sealDeliveryRecord, false);
  assert.equal(dailyLock.asOf, "2026-08-01T12:00:00Z");
  assert.equal(dailyLock.noProvider, true);

  assert.throws(
    () =>
      parseMlbDailyOpsCliArgs([
        "--date",
        "2026-08-01",
        "--rehearsal-as-of",
        AS_OF_0820,
      ]),
    /REHEARSAL_AS_OF_REQUIRES_NO_PROVIDER_NO_WRITE_NO_SEAL/,
  );
  assert.throws(
    () =>
      parseMlbDailyOpsCliArgs([
        "--date",
        "2026-08-01",
        "--no-provider",
        "--rehearsal-as-of",
        AS_OF_0820,
      ]),
    /REHEARSAL_AS_OF_REQUIRES_NO_PROVIDER_NO_WRITE_NO_SEAL/,
  );
  assert.throws(
    () =>
      parseMlbDailyOpsCliArgs([
        "--date",
        "2026-08-01",
        "--no-provider",
        "--no-write",
        "--rehearsal-as-of",
        AS_OF_0820,
      ]),
    /REHEARSAL_AS_OF_REQUIRES_NO_PROVIDER_NO_WRITE_NO_SEAL/,
  );

  const lockOpsCwd = tmpCwd("ops-lock-reh-");
  const lockOps = await runMlbDailyOpsV1({
    dateKst: "2026-08-01",
    cwd: lockOpsCwd,
    noProvider: true,
    writePrediction: false,
    sealDeliveryRecord: false,
    window: "LOCK",
    asOf: "2026-08-01T12:00:00Z",
    gameIds: ["mlb-game-fixture-lock"],
    spawnCollector: async () => {
      throw new Error("PROVIDER_CALL_FORBIDDEN");
    },
  });
  assert.equal(lockOps.providerCalls, 0);
  assert.equal(lockOps.writesPerformed, 0);
  assert.equal(
    existsSync(path.join(lockOpsCwd, "data", "predictions")),
    false,
  );

  // 20–22. persist=false means state / audit / disk lock not written
  assert.equal(
    existsSync(schedulerStatePath("MLB", "2026-08-01", rehearsalCwd)),
    false,
  );
  assert.equal(
    existsSync(schedulerAuditPath("MLB", "2026-08-01", rehearsalCwd)),
    false,
  );
  assert.equal(
    existsSync(
      lockFilePath({
        cwd: rehearsalCwd,
        league: "MLB",
        dateKst: "2026-08-01",
        gameId: "mlb-game-fixture-t90",
      }),
    ),
    false,
  );
  assert.deepEqual(listIfExists(path.join(rehearsalCwd, "data")), []);

  // 23. Provider call count = 0
  assert.equal(rRehearsal.providerCalls, 0);

  // 24. 2026-08-20 eventId 824801 resolves independently
  const loaded0820 = await loadScheduleGames({
    league: "MLB",
    dateKst: DATE_0820,
    cwd: REPO,
    gameId: EVENT_824801,
  });
  assert.deepEqual(
    loaded0820.games.map((g) => g.gameId),
    [EVENT_824801],
  );

  const real0820Calls: RunnerAction[] = [];
  const r0820 = await runPregameScheduler({
    dateKst: DATE_0820,
    league: "MLB",
    gameId: EVENT_824801,
    dryRun: false,
    noProvider: true,
    includePostgame: false,
    json: true,
    persist: false,
    rehearsal: true,
    rehearsalAsOf: AS_OF_0820,
    now: new Date(AS_OF_0820),
    cwd: REPO,
    executeRunner: async (action) => {
      real0820Calls.push(action);
      return 0;
    },
  });
  assert.equal(r0820.plans.length, 1);
  assert.equal(r0820.plans[0]?.gameId, EVENT_824801);
  assert.equal(r0820.plans[0]?.stage, "T90_COLLECTION");
  assert.equal(real0820Calls.length, 1);
  assert.equal(argValue(real0820Calls[0]?.args, "--window"), "T90");
  assert.deepEqual(gameIdsFromArgs(real0820Calls[0]?.args), [EVENT_824801]);
  assert.ok(hasFlag(real0820Calls[0]?.args, "--no-provider"));
  assert.ok(hasFlag(real0820Calls[0]?.args, "--no-write"));
  assert.ok(hasFlag(real0820Calls[0]?.args, "--no-seal"));
  assert.equal(argValue(real0820Calls[0]?.args, "--rehearsal-as-of"), AS_OF_0820);
  assert.equal(r0820.providerCalls, 0);
  assert.equal(r0820.audit.persist, false);

  const withoutRehearsal = await runPregameScheduler({
    dateKst: DATE_0820,
    league: "MLB",
    gameId: EVENT_824801,
    dryRun: true,
    noProvider: true,
    includePostgame: false,
    json: false,
    persist: false,
    now: new Date(AS_OF_0820),
    cwd: REPO,
    executeRunner: async () => {
      throw new Error("dry-run must not spawn");
    },
  });
  assert.equal(withoutRehearsal.plans[0]?.errorCode, "ALREADY_LOCKED");

  // 25. 2026-08-30 doubleheader event 823176 does not include 823177
  const loaded0830 = await loadScheduleGames({
    league: "MLB",
    dateKst: DATE_0830,
    cwd: REPO,
    gameId: EVENT_823176,
  });
  assert.deepEqual(
    loaded0830.games.map((g) => g.gameId),
    [EVENT_823176],
  );
  assert.equal(
    loaded0830.games.some((g) => g.gameId === SIBLING_823177),
    false,
  );

  const dhCalls: RunnerAction[] = [];
  const rDh = await runPregameScheduler({
    dateKst: DATE_0830,
    league: "MLB",
    gameId: EVENT_823176,
    dryRun: false,
    noProvider: true,
    includePostgame: false,
    json: true,
    persist: false,
    rehearsal: true,
    rehearsalAsOf: AS_OF_0830,
    now: new Date(AS_OF_0830),
    cwd: REPO,
    executeRunner: async (action) => {
      dhCalls.push(action);
      return 1;
    },
  });
  assert.equal(rDh.plans.length, 1);
  assert.equal(rDh.plans[0]?.gameId, EVENT_823176);
  assert.equal(
    rDh.plans.some((p) => p.gameId === SIBLING_823177),
    false,
  );
  assert.deepEqual(gameIdsFromArgs(dhCalls[0]?.args), [EVENT_823176]);
  assert.equal(gameIdsFromArgs(dhCalls[0]?.args).includes(SIBLING_823177), false);
  assert.equal(rDh.providerCalls, 0);
  assert.equal(dhCalls.length, 1);

  console.log("mlb-scheduler-rehearsal-v1: PASS");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

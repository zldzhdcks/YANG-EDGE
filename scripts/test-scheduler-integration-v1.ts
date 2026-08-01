/**
 * Integration fixture slate: A T90, B T45, C LOCK, D started, E locked.
 * Failure isolation + dry-run no provider/lock/artifact mutation.
 */
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { runPregameScheduler } from "../src/lib/scheduler";
import type { SchedulerGameInput } from "../src/lib/scheduler/types";

function main() {
  const now = new Date("2026-08-01T12:00:00.000Z");
  const start = (minutesUntil: number) =>
    new Date(now.getTime() + minutesUntil * 60_000).toISOString();

  const fixtureGames: SchedulerGameInput[] = [
    { gameId: "A", scheduledStartTime: start(100) }, // T90
    { gameId: "B", scheduledStartTime: start(45) }, // T45
    { gameId: "C", scheduledStartTime: start(10) }, // LOCK
    { gameId: "D", scheduledStartTime: start(-5), statusAbstract: "In Progress" },
    {
      gameId: "E",
      scheduledStartTime: start(10),
      lockedPredictionExists: true,
    },
  ];

  let runnerCalls = 0;
  const dry = awaitable();

  async function awaitable() {
    const cwd = mkdtempSync(path.join(tmpdir(), "sch-int-"));
    mkdirSync(path.join(cwd, "data", "scheduler"), { recursive: true });

    const result = await runPregameScheduler({
      dateKst: "2026-08-01",
      league: "MLB",
      dryRun: true,
      noProvider: false,
      includePostgame: false,
      json: false,
      now,
      fixtureGames,
      cwd,
      persist: false,
      executeRunner: async () => {
        runnerCalls += 1;
        return 0;
      },
    });

    assert.equal(result.providerCalls, 0);
    assert.equal(runnerCalls, 0);

    const byId = Object.fromEntries(result.plans.map((p) => [p.gameId, p]));
    assert.equal(byId.A?.stage, "T90_COLLECTION");
    assert.equal(byId.A?.action?.actionId, "RUN_MLB_STARTER_ACCUMULATION");
    assert.equal(byId.B?.stage, "T45_LINEUP_CHECK");
    assert.equal(byId.B?.action?.actionId, "RUN_MLB_LINEUP");
    assert.equal(byId.C?.stage, "PREGAME_LOCK");
    assert.equal(byId.C?.action?.actionId, "RUN_MLB_PREDICTION_SNAPSHOT");
    assert.equal(byId.D?.errorCode, "BLOCKED_AFTER_START");
    assert.equal(byId.E?.errorCode, "ALREADY_LOCKED");

    // no lock files written
    const locksRoot = path.join(cwd, "data", "scheduler", "locks");
    try {
      const entries = readdirSync(locksRoot, { recursive: true });
      assert.equal(entries.length, 0);
    } catch {
      // missing dir is fine
    }

    // Failure isolation (non-dry)
    let calls = 0;
    const failResult = await runPregameScheduler({
      dateKst: "2026-08-01",
      league: "MLB",
      dryRun: false,
      noProvider: false,
      includePostgame: false,
      json: false,
      now,
      fixtureGames: [
        { gameId: "1", scheduledStartTime: start(100) },
        { gameId: "2", scheduledStartTime: start(100) },
        { gameId: "3", scheduledStartTime: start(100) },
        { gameId: "4", scheduledStartTime: start(100) },
        { gameId: "5", scheduledStartTime: start(100) },
      ],
      cwd,
      persist: true,
      executeRunner: async () => {
        calls += 1;
        return calls === 1 ? 1 : 0;
      },
    });
    assert.equal(failResult.plans.filter((p) => p.executionStatus === "FAILED").length, 1);
    assert.equal(failResult.plans.filter((p) => p.executionStatus === "SUCCESS").length, 4);
    assert.equal(failResult.audit.overallStatus, "PARTIAL_SUCCESS");

    // KBO T45: missing input → MANUAL_INPUT_REQUIRED; present → spawn workflow
    const kboCwd = mkdtempSync(path.join(tmpdir(), "sch-kbo-t45-"));
    mkdirSync(path.join(kboCwd, "data", "scheduler"), { recursive: true });
    mkdirSync(path.join(kboCwd, "data", "operator-input", "kbo"), {
      recursive: true,
    });
    const kboMissing = await runPregameScheduler({
      dateKst: "2026-08-01",
      league: "KBO",
      dryRun: true,
      noProvider: true,
      includePostgame: false,
      json: false,
      now,
      fixtureGames: [{ gameId: "K1", scheduledStartTime: start(45) }],
      cwd: kboCwd,
      persist: false,
    });
    assert.equal(kboMissing.plans[0]?.stage, "T45_LINEUP_CHECK");
    assert.equal(kboMissing.plans[0]?.action?.actionId, "MANUAL_INPUT_REQUIRED");
    assert.equal(kboMissing.plans[0]?.executionStatus, "MANUAL_REQUIRED");

    writeFileSync(
      path.join(
        kboCwd,
        "data",
        "operator-input",
        "kbo",
        "2026-08-01-personnel-input-v1.json",
      ),
      JSON.stringify({
        schemaVersion: "kbo-t45-personnel-input-v1",
        league: "KBO",
        dateKst: "2026-08-01",
        createdAt: "2026-08-01T09:00:00.000Z",
        createdBy: "test",
        games: [],
      }),
    );
    const kboReady = await runPregameScheduler({
      dateKst: "2026-08-01",
      league: "KBO",
      dryRun: true,
      noProvider: true,
      includePostgame: false,
      json: false,
      now,
      fixtureGames: [{ gameId: "K1", scheduledStartTime: start(45) }],
      cwd: kboCwd,
      persist: false,
    });
    assert.equal(
      kboReady.plans[0]?.action?.actionId,
      "RUN_KBO_T45_PERSONNEL_WORKFLOW",
    );

    // Quota block
    const q = await runPregameScheduler({
      dateKst: "2026-08-01",
      league: "MLB",
      dryRun: true,
      noProvider: false,
      includePostgame: false,
      json: false,
      now,
      fixtureGames: [{ gameId: "Q", scheduledStartTime: start(100) }],
      quotaRemaining: 5,
      persist: false,
    });
    assert.equal(q.plans[0]?.errorCode, "QUOTA_BLOCKED");

    console.log("test:scheduler-integration OK");
  }

  return dry;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

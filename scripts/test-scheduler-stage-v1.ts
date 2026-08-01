/**
 * Fixture tests: stage resolver, warmup, boundaries.
 */
import assert from "node:assert/strict";
import {
  isHardCutoff,
  minutesUntilStart,
  resolveStage,
} from "../src/lib/scheduler/resolve-stage";
import type { SchedulerGameInput } from "../src/lib/scheduler/types";

function gameAt(
  minutesUntil: number,
  now: Date,
  extra: Partial<SchedulerGameInput> = {},
): SchedulerGameInput {
  const start = new Date(now.getTime() + minutesUntil * 60_000);
  return {
    gameId: "g1",
    scheduledStartTime: start.toISOString(),
    ...extra,
  };
}

function expectStage(
  minutesUntil: number,
  now: Date,
  stage: string,
  extra?: Partial<SchedulerGameInput>,
) {
  const g = gameAt(minutesUntil, now, extra);
  const r = resolveStage({ game: g, now });
  assert.equal(r.kind, "STAGE", `expected STAGE at T-${minutesUntil}`);
  if (r.kind === "STAGE") assert.equal(r.stage, stage);
}

function expectBlocked(
  minutesUntil: number,
  now: Date,
  code: string,
  extra?: Partial<SchedulerGameInput>,
) {
  const g = gameAt(minutesUntil, now, extra);
  const r = resolveStage({ game: g, now });
  assert.equal(r.kind, "BLOCKED");
  if (r.kind === "BLOCKED") assert.equal(r.errorCode, code);
}

function main() {
  const now = new Date("2026-08-01T00:00:00.000Z");

  // Spec windows
  expectStage(100, now, "T90_COLLECTION");
  expectStage(70, now, "T60_REFRESH");
  expectStage(45, now, "T45_LINEUP_CHECK");
  expectStage(25, now, "T30_FINAL_CHECK");
  expectStage(10, now, "PREGAME_LOCK");
  expectBlocked(-1, now, "BLOCKED_AFTER_START");

  // Boundaries (toMinutes exclusive except LOCK)
  expectStage(75, now, "T60_REFRESH"); // exactly -75 → T60
  expectStage(50, now, "T45_LINEUP_CHECK");
  expectStage(35, now, "T30_FINAL_CHECK");
  expectStage(15, now, "PREGAME_LOCK");
  // exactly 0 → hard cutoff (LOCK is until start, not including start)
  expectBlocked(0, now, "BLOCKED_AFTER_START");

  // Warmup
  expectStage(10, now, "PREGAME_LOCK", { statusAbstract: "Warmup" });
  expectBlocked(-1, now, "BLOCKED_AFTER_START", {
    statusAbstract: "Warmup",
  });

  // Locked
  const locked = resolveStage({
    game: {
      gameId: "L",
      scheduledStartTime: gameAt(10, now).scheduledStartTime,
      lockedPredictionExists: true,
    },
    now,
  });
  assert.equal(locked.kind, "BLOCKED");
  if (locked.kind === "BLOCKED") assert.equal(locked.errorCode, "ALREADY_LOCKED");

  // Final status → hard cutoff
  assert.equal(
    isHardCutoff(
      {
        gameId: "f",
        scheduledStartTime: gameAt(10, now).scheduledStartTime,
        statusAbstract: "Final",
      },
      now,
    ),
    true,
  );

  // minutes helper sanity
  assert.ok(Math.abs(minutesUntilStart(gameAt(30, now).scheduledStartTime, now) - 30) < 0.01);

  // forceStage cannot bypass lock
  const forced = resolveStage({
    game: {
      gameId: "L2",
      scheduledStartTime: gameAt(10, now).scheduledStartTime,
      pregameLocked: true,
    },
    now,
    forceStage: "T45_LINEUP_CHECK",
  });
  assert.equal(forced.kind, "BLOCKED");

  console.log("test:scheduler-stage OK");
}

main();

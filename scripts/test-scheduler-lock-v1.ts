/**
 * Lock TTL + duplicate + idempotency + quota fixture tests.
 */
import assert from "node:assert/strict";
import { computeInputHash, findSuccessfulStage, revisionAllowed } from "../src/lib/scheduler/idempotency";
import { MemoryLockStore, isLockExpired } from "../src/lib/scheduler/lock-store";
import { evaluateQuotaGate } from "../src/lib/scheduler/quota-gate";
import type { GameSchedulerState, LockRecord } from "../src/lib/scheduler/types";

function main() {
  const now = new Date("2026-08-01T12:00:00.000Z");
  const store = new MemoryLockStore();

  const first = store.acquire({
    lockKey: "MLB:2026-08-01:824974:T30_FINAL_CHECK",
    league: "MLB",
    dateKst: "2026-08-01",
    gameId: "824974",
    stage: "T30_FINAL_CHECK",
    schedulerRunId: "sch-1",
    now,
    ttlMs: 10 * 60_000,
  });
  assert.equal(first.ok, true);

  const second = store.acquire({
    lockKey: "MLB:2026-08-01:824974:T30_FINAL_CHECK",
    league: "MLB",
    dateKst: "2026-08-01",
    gameId: "824974",
    stage: "T30_FINAL_CHECK",
    schedulerRunId: "sch-2",
    now,
  });
  assert.equal(second.ok, false);
  if (!second.ok) assert.equal(second.reason, "SKIPPED_DUPLICATE_RUN");

  // TTL expiry → reacquire
  const past = new Date(now.getTime() + 11 * 60_000);
  if (first.ok) {
    assert.equal(isLockExpired(first.record, past), true);
  }
  const third = store.acquire({
    lockKey: "MLB:2026-08-01:824974:T30_FINAL_CHECK",
    league: "MLB",
    dateKst: "2026-08-01",
    gameId: "824974",
    stage: "T30_FINAL_CHECK",
    schedulerRunId: "sch-3",
    now: past,
  });
  assert.equal(third.ok, true);

  // Idempotency
  const hash = computeInputHash({ a: 1, b: 2 });
  const gameState: GameSchedulerState = {
    gameId: "824974",
    scheduledStartTime: now.toISOString(),
    latestStage: "T30_FINAL_CHECK",
    overallStatus: "SUCCESS",
    stages: [
      {
        stage: "T30_FINAL_CHECK",
        status: "SUCCESS",
        attemptNumber: 1,
        schedulerRunId: "sch-1",
        startedAt: now.toISOString(),
        finishedAt: now.toISOString(),
        inputHash: hash,
        outputHash: null,
        outputArtifacts: [],
        warnings: [],
        errorCode: null,
      },
    ],
  };
  assert.equal(findSuccessfulStage(gameState, "T30_FINAL_CHECK", hash), true);
  assert.equal(
    findSuccessfulStage(gameState, "T30_FINAL_CHECK", "other"),
    false,
  );

  assert.equal(
    revisionAllowed({
      lockedPrediction: true,
      previousInputHash: "x",
      nextInputHash: "y",
    }).allowed,
    false,
  );
  assert.equal(
    revisionAllowed({
      lockedPrediction: false,
      previousInputHash: "x",
      nextInputHash: "y",
    }).allowed,
    true,
  );

  // Quota
  assert.equal(evaluateQuotaGate(25).allowProvider, true);
  assert.equal(evaluateQuotaGate(25).warn, false);
  const w15 = evaluateQuotaGate(15);
  assert.equal(w15.allowProvider, true);
  assert.equal(w15.warn, true);
  const b5 = evaluateQuotaGate(5);
  assert.equal(b5.allowProvider, false);
  const unk = evaluateQuotaGate(null);
  assert.equal(unk.allowProvider, true);
  assert.equal(unk.warn, true);

  // stale lock warning path via expired record type check
  const stale: LockRecord = {
    lockKey: "MLB:2026-08-01:1:T90_COLLECTION",
    schedulerRunId: "old",
    processId: 1,
    acquiredAt: "2026-08-01T00:00:00.000Z",
    expiresAt: "2026-08-01T00:05:00.000Z",
    stage: "T90_COLLECTION",
    status: "RUNNING",
    league: "MLB",
    dateKst: "2026-08-01",
    gameId: "1",
  };
  assert.equal(isLockExpired(stale, now), true);

  console.log("test:scheduler-lock OK");
}

main();

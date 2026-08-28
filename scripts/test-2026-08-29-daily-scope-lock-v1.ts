/**
 * 2026-08-29 Daily Scope Lock CANDIDATE tests.
 * Run: npm run test:2026-08-29-daily-scope-lock-v1
 */
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  FORMAL_OBSERVED_AT,
  SEALED_2026_08_28,
} from "./intake-2026-08-29-batch-2130-operator-pregame-observations";
import {
  LOCK_REL,
  LOCK_STATUS,
  SCOPE_LOCK_STATUS,
  lockDailyScopeCandidate,
  sha256File,
} from "./lock-2026-08-29-daily-scope-v1";

async function main() {
  const cwd = process.cwd();
  const result = await lockDailyScopeCandidate(cwd);
  const lock = JSON.parse(readFileSync(path.join(cwd, LOCK_REL), "utf8"));

  assert.equal(lock.lockStatus, LOCK_STATUS);
  assert.equal(lock.scopeLockStatus, SCOPE_LOCK_STATUS);
  assert.equal(lock.scopeStatus, "COMPLETE");
  assert.equal(lock.creditSeal, false);
  assert.ok(lock.ownerSealedAt);
  assert.equal(lock.prediction, "NONE");
  assert.equal(lock.engine, "NONE");
  assert.equal(lock.recommendation, "NONE");
  assert.equal(lock.predictionInput, false);
  assert.equal(lock.engineInput, false);
  assert.equal(lock.predictionCreated, 0);
  assert.equal(lock.predictionCalls, 0);
  assert.equal(lock.resultCalls, 0);
  assert.equal(lock.engineModified, false);
  assert.equal(lock.weightsModified, false);
  assert.equal(lock.fuzzyMatchingUsed, false);
  assert.equal(lock.formalObservedAt, FORMAL_OBSERVED_AT);
  assert.equal(lock.observedBatchCount, 30);
  assert.equal(lock.scopeTotal, 29);
  assert.equal(lock.accountedFor, 29);
  assert.equal(lock.officialDenominator, 29);
  assert.equal(lock.officialTargetDateScopeCount, 29);
  assert.equal(lock.excludedCrossDateCount, 1);
  assert.equal(lock.previousCalendarDateVisibleInDenominator, 0);
  assert.equal(lock.previousCalendarDateVisibleExcludedFromDenominator, 1);
  assert.equal(
    lock.supportedScheduleMatchedCount +
      lock.providerUnsupportedCount +
      lock.identityReviewCount +
      lock.competitionReviewCount,
    29,
  );
  assert.equal(lock.observedScope.BASKETBALL, 6);
  assert.equal(lock.observedScope.FOOTBALL, 8);
  assert.equal(lock.observedScope.MLB, 15);
  assert.equal(lock.observedScope.basketballObservedBatch, 7);
  assert.equal(lock.bySportReconciliation.BASKETBALL.droppedFromDenominator, 0);
  assert.equal(lock.excludedCrossDateRows[0].rawMatchup, "요르단M : 필리핀M");
  assert.equal(
    lock.excludedCrossDateRows[0].scopeMembership,
    "EXCLUDED_NON_TARGET_DATE",
  );
  assert.equal(existsSync(path.join(cwd, "data/predictions/2026-08-29.json")), false);
  assert.equal(result.lockSha256, sha256File(path.join(cwd, LOCK_REL)));

  for (const sealed of SEALED_2026_08_28) {
    assert.equal(
      sha256File(path.join(cwd, sealed.rel)),
      sealed.sha256,
      sealed.rel,
    );
  }

  const pngTracked = execSync(
    "git ls-files -- data/operator-observations/raw/2026-08-29",
    { cwd, encoding: "utf8" },
  );
  assert.equal(pngTracked.includes(".png"), false);

  console.log("PASS 2026-08-29 daily scope lock v1");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});

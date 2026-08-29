/**
 * 2026-08-30 Daily Scope Lock FINAL SEAL tests.
 * Run: npm run test:2026-08-30-daily-scope-lock-v1
 */
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  FORMAL_OBSERVED_AT,
  SEALED_2026_08_29,
} from "./intake-2026-08-30-batch-2118-operator-pregame-observations";
import {
  LOCK_REL,
  LOCK_STATUS,
  SCOPE_LOCK_STATUS,
  lockDailyScopeCandidate,
  sha256File,
} from "./lock-2026-08-30-daily-scope-v1";

async function main() {
  const cwd = process.cwd();
  const result = await lockDailyScopeCandidate(cwd);
  const lock = JSON.parse(readFileSync(path.join(cwd, LOCK_REL), "utf8"));

  assert.equal(lock.lockStatus, "LOCKED");
  assert.equal(lock.lockStatus, LOCK_STATUS);
  assert.equal(lock.scopeLockStatus, "COMPLETE");
  assert.equal(lock.scopeLockStatus, SCOPE_LOCK_STATUS);
  assert.equal(lock.scopeStatus, "COMPLETE");
  assert.equal(lock.creditSeal, false);
  assert.ok(lock.ownerSealedAt);
  assert.ok(lock.scopeLockedAt);
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
  assert.equal(lock.marketBenchmarkOnly, true);
  assert.equal(lock.formalObservedAt, FORMAL_OBSERVED_AT);
  assert.equal(lock.formalObservedAt, "2026-08-29T21:19:31.776+09:00");
  assert.equal(lock.formalObservedAtChanged, false);
  assert.equal(lock.observedBatchCount, 64);
  assert.equal(lock.scopeTotal, 44);
  assert.equal(lock.accountedFor, 44);
  assert.equal(lock.officialDenominator, 44);
  assert.equal(lock.officialTargetDateScopeCount, 44);
  assert.equal(lock.excludedCrossDateCount, 20);
  assert.equal(lock.observedBatchCount, lock.scopeTotal + lock.excludedCrossDateCount);
  assert.equal(lock.observedScope.FOOTBALL + lock.observedScope.MLB, 44);
  assert.equal(lock.previousCalendarDateVisibleInDenominator, 0);
  assert.equal(lock.previousCalendarDateVisibleExcludedFromDenominator, 20);
  assert.equal(
    lock.supportedScheduleMatchedCount +
      lock.providerUnsupportedCount +
      lock.identityReviewCount +
      lock.competitionReviewCount,
    44,
  );
  assert.equal(lock.supportedScheduleMatchedCount, 17);
  assert.equal(lock.identityReviewCount, 27);
  assert.equal(lock.competitionReviewCount, 0);
  assert.equal(lock.providerUnsupportedCount, 0);
  assert.equal(lock.observedScope.BASKETBALL, 0);
  assert.equal(lock.observedScope.FOOTBALL, 29);
  assert.equal(lock.observedScope.MLB, 15);
  assert.equal(lock.observedScope.footballByLeague.MLS, 13);
  assert.equal(lock.observedScope.footballByLeague["프리그1"], 5);
  assert.equal(lock.observedScope.footballByLeague["세리에A"], 4);
  assert.equal(lock.observedScope.footballByLeague["라리가"], 3);
  assert.equal(lock.observedScope.footballByLeague["에레디비"], 2);
  assert.equal(lock.observedScope.footballByLeague.EPL, 1);
  assert.equal(lock.observedScope.footballByLeague["분데스리"], 1);
  assert.equal(lock.bySportReconciliation.FOOTBALL.scheduleMatched, 2);
  assert.equal(lock.bySportReconciliation.FOOTBALL.identityReviewRequired, 27);
  assert.equal(lock.bySportReconciliation.FOOTBALL.competitionReviewRequired, 0);
  assert.equal(lock.bySportReconciliation.MLB.scheduleMatched, 15);
  assert.equal(lock.bySportReconciliation.BASKETBALL.droppedFromDenominator, 0);
  assert.equal(lock.excludedCrossDateRows.length, 20);
  assert.ok(
    lock.excludedCrossDateRows.every(
      (r: { displayedDateKst: string; scopeMembership: string; sport: string }) =>
        r.displayedDateKst === "2026-08-29" &&
        r.scopeMembership === "EXCLUDED_NON_TARGET_DATE" &&
        r.sport === "FOOTBALL",
    ),
  );
  assert.equal(
    lock.nextRecommendedStep,
    "B1 schedule/identity on sealed 2026-08-30 Scope.",
  );
  assert.equal(existsSync(path.join(cwd, "data/predictions/2026-08-30.json")), false);
  assert.equal(result.lockSha256, sha256File(path.join(cwd, LOCK_REL)));

  for (const sealed of SEALED_2026_08_29) {
    assert.equal(
      sha256File(path.join(cwd, sealed.rel)),
      sealed.sha256,
      sealed.rel,
    );
  }

  const pngTracked = execSync(
    "git ls-files -- data/operator-observations/raw/2026-08-30",
    { cwd, encoding: "utf8" },
  );
  assert.equal(pngTracked.includes(".png"), false);

  console.log("PASS 2026-08-30 daily scope lock v1");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});

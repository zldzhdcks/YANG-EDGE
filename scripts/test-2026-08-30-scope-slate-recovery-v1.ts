/**
 * 2026-08-30 scope / slate recovery tests.
 * Run: npm run test:2026-08-30-scope-slate-recovery-v1
 */
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { FORMAL_OBSERVED_AT } from "./intake-2026-08-30-batch-2118-operator-pregame-observations";
import {
  FROZEN_FORMAL_OBSERVED_AT,
  OPERATOR_REVIEW_ITEMS,
  PNG_LOCAL_EXCLUDE,
  SLATE_RECOVERY_REL,
  runSlateRecovery,
} from "./audit-2026-08-30-scope-slate-recovery-v1";

async function main() {
  const cwd = process.cwd();
  const result = await runSlateRecovery(cwd);
  const slate = JSON.parse(
    readFileSync(path.join(cwd, SLATE_RECOVERY_REL), "utf8"),
  );

  assert.equal(FROZEN_FORMAL_OBSERVED_AT, FORMAL_OBSERVED_AT);
  assert.equal(slate.formalObservedAt, FORMAL_OBSERVED_AT);
  assert.equal(slate.formalObservedAtChanged, false);
  assert.equal(slate.operatorObservedMatchups, 64);
  assert.equal(slate.officialScopeTotal, 44);
  assert.equal(slate.officialTargetDateScopeCount, 44);
  assert.equal(slate.excludedCrossDateCount, 20);
  assert.equal(slate.scopeAccounting.scopeTotal, 44);
  assert.equal(slate.scopeAccounting.accountedFor, 44);
  assert.equal(slate.scopeAccounting.excludedCrossDate, 20);
  assert.equal(
    slate.scopeAccounting.scheduleMatched +
      slate.scopeAccounting.providerUnsupported +
      slate.scopeAccounting.identityReviewRequired +
      slate.scopeAccounting.competitionReviewRequired,
    44,
  );
  assert.equal(slate.scopeAccounting.scheduleMatched, 17);
  assert.equal(slate.scopeAccounting.identityReviewRequired, 27);
  assert.equal(slate.scopeAccounting.competitionReviewRequired, 0);
  assert.equal(slate.scopeAccounting.providerUnsupported, 0);
  assert.equal(slate.excludedCrossDateRows.length, 20);
  assert.ok(
    slate.excludedCrossDateRows.every(
      (r: { displayedDateKst: string; scopeMembership: string }) =>
        r.displayedDateKst === "2026-08-29" &&
        r.scopeMembership === "EXCLUDED_NON_TARGET_DATE",
    ),
  );
  assert.equal(slate.fuzzyMatchingUsed, false);
  assert.equal(slate.predictionCalls, 0);
  assert.equal(slate.resultCalls, 0);
  assert.equal(slate.predictionCreated, 0);
  assert.equal(slate.marketBenchmarkOnly, true);
  assert.equal(slate.predictionInput, false);
  assert.equal(slate.engineInput, false);
  assert.equal(slate.scopeLockReady, true);
  assert.equal(slate.bySport.MLB.operatorObserved, 15);
  assert.equal(slate.bySport.MLB.matched, 15);
  assert.equal(slate.bySport.FOOTBALL.officialTargetDateScope, 29);
  assert.equal(slate.bySport.FOOTBALL.matched, 2);
  assert.equal(slate.bySport.BASKETBALL.operatorObserved, 0);
  assert.equal(slate.operatorConfirmationRequired, 0);
  assert.equal(OPERATOR_REVIEW_ITEMS.length, 3);
  assert.equal(
    existsSync(path.join(cwd, "data/predictions/2026-08-30.json")),
    false,
  );
  assert.equal(
    PNG_LOCAL_EXCLUDE,
    "data/operator-observations/raw/2026-08-30/batch-2118/*.png",
  );
  const pngTracked = execSync(
    "git ls-files -- data/operator-observations/raw/2026-08-30",
    { cwd, encoding: "utf8" },
  );
  assert.equal(pngTracked.includes(".png"), false);
  assert.equal(result.slate.status, "SCOPE_LOCK_CANDIDATE_READY");

  const officialFootball = result.structured.footballOddsFixtures.filter(
    (r: { scopeMembership: string }) =>
      r.scopeMembership === "IN_TARGET_DATE_SCOPE",
  );
  assert.equal(officialFootball.length, 29);
  const matchedFootball = officialFootball.filter(
    (r: { scopeAccountingState: string }) =>
      r.scopeAccountingState === "SCHEDULE_MATCHED",
  );
  assert.equal(matchedFootball.length, 2);
  assert.ok(
    matchedFootball.some(
      (r: { rawHomeLabel: string; rawAwayLabel: string }) =>
        r.rawHomeLabel === "시애사운" && r.rawAwayLabel === "시카파이",
    ),
  );
  assert.ok(
    matchedFootball.some(
      (r: { rawHomeLabel: string; rawAwayLabel: string }) =>
        r.rawHomeLabel === "포틀팀버" && r.rawAwayLabel === "오스틴FC",
    ),
  );
  const identityFootball = officialFootball.filter(
    (r: { scopeAccountingState: string }) =>
      r.scopeAccountingState === "IDENTITY_REVIEW_REQUIRED",
  );
  assert.equal(identityFootball.length, 27);
  for (const row of result.structured.mlbOddsGames) {
    if (row.pregameEligibilityStatus === "PRE_GAME_MARKET_OBSERVATION_ELIGIBLE") {
      assert.equal(row.identityStatus, "MATCHED");
      assert.ok(row.scheduledStartAt);
      assert.ok(
        Date.parse(FORMAL_OBSERVED_AT) < Date.parse(String(row.scheduledStartAt)),
      );
    }
  }
  console.log("PASS 2026-08-30 scope/slate recovery v1");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});

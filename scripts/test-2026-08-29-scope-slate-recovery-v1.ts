/**
 * 2026-08-29 scope / slate recovery tests.
 * Run: npm run test:2026-08-29-scope-slate-recovery-v1
 */
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { FORMAL_OBSERVED_AT } from "./intake-2026-08-29-batch-2130-operator-pregame-observations";
import {
  FROZEN_FORMAL_OBSERVED_AT,
  OPERATOR_REVIEW_ITEMS,
  PNG_LOCAL_EXCLUDE,
  SLATE_RECOVERY_REL,
  runSlateRecovery,
} from "./audit-2026-08-29-scope-slate-recovery-v1";

async function main() {
  const cwd = process.cwd();
  const result = await runSlateRecovery(cwd);
  const slate = JSON.parse(
    readFileSync(path.join(cwd, SLATE_RECOVERY_REL), "utf8"),
  );

  assert.equal(FROZEN_FORMAL_OBSERVED_AT, FORMAL_OBSERVED_AT);
  assert.equal(slate.formalObservedAt, FORMAL_OBSERVED_AT);
  assert.equal(slate.formalObservedAtChanged, false);
  assert.equal(slate.operatorObservedMatchups, 30);
  assert.equal(slate.officialScopeTotal, 29);
  assert.equal(slate.officialTargetDateScopeCount, 29);
  assert.equal(slate.excludedCrossDateCount, 1);
  assert.equal(slate.scopeAccounting.scopeTotal, 29);
  assert.equal(slate.scopeAccounting.accountedFor, 29);
  assert.equal(slate.scopeAccounting.excludedCrossDate, 1);
  assert.equal(
    slate.scopeAccounting.scheduleMatched +
      slate.scopeAccounting.providerUnsupported +
      slate.scopeAccounting.identityReviewRequired +
      slate.scopeAccounting.competitionReviewRequired,
    29,
  );
  assert.equal(slate.excludedCrossDateRows.length, 1);
  assert.equal(slate.excludedCrossDateRows[0].rawMatchup, "요르단M : 필리핀M");
  assert.equal(slate.excludedCrossDateRows[0].displayedDateKst, "2026-08-28");
  assert.deepEqual(slate.excludedCrossDateRows[0].marketIds, [7121, 7122, 7123, 7124]);
  assert.equal(
    slate.excludedCrossDateRows[0].scopeMembership,
    "EXCLUDED_NON_TARGET_DATE",
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
  assert.equal(slate.bySport.FOOTBALL.operatorObserved, 8);
  assert.equal(slate.bySport.BASKETBALL.matched, 0);
  assert.equal(slate.bySport.BASKETBALL.operatorObserved, 7);
  assert.equal(slate.bySport.BASKETBALL.officialTargetDateScope, 6);
  assert.equal(slate.bySport.BASKETBALL.droppedFromDenominator, 0);
  assert.equal(slate.bySport.BASKETBALL.excludedCrossDateCount, 1);
  assert.equal(slate.operatorConfirmationRequired, 0);
  assert.equal(OPERATOR_REVIEW_ITEMS.length, 3);
  assert.equal(
    existsSync(path.join(cwd, "data/predictions/2026-08-29.json")),
    false,
  );
  const ignore = execSync(
    `git check-ignore -- data/operator-observations/raw/2026-08-29/batch-2130/screenshot_2026-08-28_212653.png`,
    { cwd, encoding: "utf8" },
  );
  assert.ok(
    ignore.includes(PNG_LOCAL_EXCLUDE.split("/").pop() as string) ||
      ignore.length > 0,
  );
  assert.equal(result.slate.status, "SCOPE_LOCK_CANDIDATE_READY");
  for (const row of result.structured.mlbOddsGames) {
    if (row.pregameEligibilityStatus === "PRE_GAME_MARKET_OBSERVATION_ELIGIBLE") {
      assert.equal(row.identityStatus, "MATCHED");
      assert.ok(row.scheduledStartAt);
      assert.ok(
        Date.parse(FORMAL_OBSERVED_AT) < Date.parse(String(row.scheduledStartAt)),
      );
    }
  }
  const jordanPhi = result.structured.basketballOddsFixtures.find(
    (r: { rawHomeLabel: string; rawAwayLabel: string }) =>
      r.rawHomeLabel === "요르단M" && r.rawAwayLabel === "필리핀M",
  );
  assert.ok(jordanPhi, "요르단M : 필리핀M must remain in operator observations");
  assert.equal(jordanPhi.displayedDateKst, "2026-08-28");
  assert.equal(jordanPhi.scopeMembership, "EXCLUDED_NON_TARGET_DATE");
  assert.equal(jordanPhi.scopeAccountingState, "EXCLUDED_NON_TARGET_DATE");
  for (const row of result.structured.basketballOddsFixtures) {
    if (row.scopeMembership === "EXCLUDED_NON_TARGET_DATE") {
      assert.equal(row.scopeAccountingState, "EXCLUDED_NON_TARGET_DATE");
      assert.notEqual(row.displayedDateKst, "2026-08-29");
      continue;
    }
    assert.equal(row.displayedDateKst, "2026-08-29");
    assert.equal(row.scopeMembership, "IN_TARGET_DATE_SCOPE");
    assert.equal(row.scopeAccountingState, "SCOPE_OBSERVED_PROVIDER_UNSUPPORTED");
    assert.notEqual(
      row.pregameEligibilityStatus,
      "PRE_GAME_MARKET_OBSERVATION_ELIGIBLE",
    );
  }
  console.log("PASS 2026-08-29 scope/slate recovery v1");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});

/**
 * 2026-08-28 scope / slate recovery tests.
 * Run: npm run test:2026-08-28-scope-slate-recovery-v1
 */
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { FORMAL_OBSERVED_AT } from "./intake-2026-08-28-batch-2228-operator-pregame-observations";
import {
  FROZEN_FORMAL_OBSERVED_AT,
  OPERATOR_REVIEW_ITEMS,
  OWNER_APPROVED_FOOTBALL_OPERATOR_ALIASES,
  PNG_LOCAL_EXCLUDE,
  SLATE_RECOVERY_REL,
  runSlateRecovery,
} from "./audit-2026-08-28-scope-slate-recovery-v1";

async function main() {
  const cwd = process.cwd();
  const result = await runSlateRecovery(cwd);
  const slate = JSON.parse(
    readFileSync(path.join(cwd, SLATE_RECOVERY_REL), "utf8"),
  );

  assert.equal(FROZEN_FORMAL_OBSERVED_AT, FORMAL_OBSERVED_AT);
  assert.equal(slate.formalObservedAt, FORMAL_OBSERVED_AT);
  assert.equal(slate.formalObservedAtChanged, false);
  assert.equal(slate.operatorObservedMatchups, 36);
  assert.equal(slate.scopeAccounting.scopeTotal, 36);
  assert.equal(slate.scopeAccounting.accountedFor, 36);
  assert.equal(slate.fuzzyMatchingUsed, false);
  assert.equal(slate.predictionCalls, 0);
  assert.equal(slate.resultCalls, 0);
  assert.equal(slate.predictionCreated, 0);
  assert.equal(slate.marketBenchmarkOnly, true);
  assert.equal(slate.predictionInput, false);
  assert.equal(slate.engineInput, false);
  assert.equal(slate.scopeLockReady, true);
  assert.equal(slate.bySport.MLB.matched, 7);
  assert.equal(slate.bySport.MLB.unresolved, 0);
  assert.equal(slate.bySport.FOOTBALL.matched, 2);
  assert.equal(slate.bySport.FOOTBALL.unresolved, 12);
  assert.equal(slate.bySport.FOOTBALL.uelOperatorAliasApplied, true);
  assert.equal(slate.bySport.FOOTBALL.laLigaOperatorAliasesApplied, 4);
  assert.equal(slate.bySport.BASKETBALL.matched, 0);
  assert.equal(slate.bySport.BASKETBALL.operatorObserved, 15);
  assert.equal(slate.bySport.BASKETBALL.droppedFromDenominator, 0);
  assert.equal(slate.operatorConfirmationRequired, 0);
  assert.equal(slate.operatorOwnerExplicitConfirmation, 2);
  assert.equal(slate.pregameEligibleObservedMatchups, 9);
  assert.equal(slate.postStartObservedMatchups, 0);
  assert.equal(slate.pregameEligibilityUnresolved, 27);
  assert.equal(OWNER_APPROVED_FOOTBALL_OPERATOR_ALIASES.competition.length, 1);
  assert.equal(OWNER_APPROVED_FOOTBALL_OPERATOR_ALIASES.teams.length, 4);
  assert.equal(OPERATOR_REVIEW_ITEMS.length, 2);
  for (const item of OPERATOR_REVIEW_ITEMS) {
    assert.equal(item.reviewState, "OWNER_EXPLICIT_CONFIRMATION");
    assert.notEqual(item.rawHomeLabel, "FIELD_REVIEW_REQUIRED");
    assert.notEqual(item.rawAwayLabel, "FIELD_REVIEW_REQUIRED");
    assert.equal(item.candidateProviderFixtures.length, 0);
  }
  assert.equal(OPERATOR_REVIEW_ITEMS[0]?.rawHomeLabel, "파나마");
  assert.equal(OPERATOR_REVIEW_ITEMS[0]?.rawAwayLabel, "캐나다");
  assert.equal(OPERATOR_REVIEW_ITEMS[1]?.rawHomeLabel, "멕시코");
  assert.equal(OPERATOR_REVIEW_ITEMS[1]?.rawAwayLabel, "콜롬비아");
  assert.equal(
    existsSync(path.join(cwd, "data/audits/2026-08-27-daily-scope-lock-v1.json")),
    false,
  );
  const ignore = execSync(
    `git check-ignore -- data/operator-observations/raw/2026-08-28/batch-2228/screenshot_2026-08-27_211819.png`,
    { cwd, encoding: "utf8" },
  );
  assert.ok(
    ignore.includes(PNG_LOCAL_EXCLUDE.split("/").pop() as string) ||
      ignore.length > 0,
  );
  assert.equal(result.slate.status, "SCOPE_LOCK_CANDIDATE_READY");
  console.log("PASS 2026-08-28 scope/slate recovery v1");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});

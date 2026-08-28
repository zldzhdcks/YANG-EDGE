/**
 * 2026-08-29 B1 schedule / identity reconciliation seal tests.
 * READ-ONLY. Must not regenerate the OWNER-reviewed artifact.
 *
 * Run: npm run test:2026-08-29-schedule-identity-reconciliation-v1
 */
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  DATE_KST,
  FROZEN_FORMAL_OBSERVED_AT,
  LOCK_REL,
  SOURCE_OBS_REL,
  sha256File,
} from "./lock-2026-08-29-daily-scope-v1";
import { SEALED_2026_08_28 } from "./intake-2026-08-29-batch-2130-operator-pregame-observations";
import {
  B1_REL,
  SEALED_B1_HASH,
  SEALED_LOCK_HASH,
} from "./audit-2026-08-29-schedule-identity-reconciliation-v1";

async function main() {
  const cwd = process.cwd();
  const b1Abs = path.join(cwd, B1_REL);
  const lockAbs = path.join(cwd, LOCK_REL);
  const obsAbs = path.join(cwd, SOURCE_OBS_REL);

  assert.equal(existsSync(b1Abs), true);
  assert.equal(sha256File(b1Abs), SEALED_B1_HASH);
  assert.equal(sha256File(lockAbs), SEALED_LOCK_HASH);

  const b1 = JSON.parse(readFileSync(b1Abs, "utf8"));
  const lock = JSON.parse(readFileSync(lockAbs, "utf8"));
  const obs = JSON.parse(readFileSync(obsAbs, "utf8"));

  assert.equal(b1.dateKst, DATE_KST);
  assert.equal(lock.scopeTotal, 29);
  assert.equal(lock.officialDenominator, 29);
  assert.equal(lock.accountedFor, 29);
  assert.equal(b1.totals.officialScopeTotal, 29);
  assert.equal(b1.games.length, 29);
  assert.equal(b1.totals.MATCHED, 15);
  assert.equal(b1.totals.IDENTITY_REVIEW_REQUIRED, 2);
  assert.equal(b1.totals.COMPETITION_REVIEW_REQUIRED, 6);
  assert.equal(b1.totals.PROVIDER_NOT_SUPPORTED, 6);
  assert.equal(
    b1.totals.MATCHED +
      b1.totals.IDENTITY_REVIEW_REQUIRED +
      b1.totals.COMPETITION_REVIEW_REQUIRED +
      b1.totals.PROVIDER_NOT_SUPPORTED,
    29,
  );
  assert.equal(b1.bySport.MLB.MATCHED, 15);
  assert.equal(b1.bySport.FOOTBALL.IDENTITY_REVIEW_REQUIRED, 2);
  assert.equal(b1.bySport.FOOTBALL.COMPETITION_REVIEW_REQUIRED, 6);
  assert.equal(b1.bySport.BASKETBALL.PROVIDER_NOT_SUPPORTED, 6);
  assert.equal(b1.fuzzyMatchingUsed, false);
  assert.equal(b1.newAliasesInvented, 0);
  assert.equal(b1.resultCalls, 0);
  assert.equal(b1.predictionCalls, 0);
  assert.equal(b1.engineModified, false);
  assert.equal(b1.weightsModified, false);
  assert.equal(b1.marketBenchmarkOnly, true);
  assert.equal(b1.predictionInput, false);
  assert.equal(b1.engineInput, false);
  assert.equal(b1.formalObservedAt, FROZEN_FORMAL_OBSERVED_AT);

  const racing = b1.games.find(
    (g: { rawMatchup: string }) => g.rawMatchup === "라싱산탄 : 엘체",
  );
  const alaves = b1.games.find(
    (g: { rawMatchup: string }) => g.rawMatchup === "알라베스 : 비야레알",
  );
  assert.equal(racing?.status, "IDENTITY_REVIEW_REQUIRED");
  assert.equal(alaves?.status, "IDENTITY_REVIEW_REQUIRED");

  assert.equal(b1.excludedCrossDateCount, 1);
  assert.equal(b1.excludedCrossDateRows[0].rawMatchup, "요르단M : 필리핀M");
  assert.equal(b1.excludedCrossDateRows[0].scopeMembership, "EXCLUDED_NON_TARGET_DATE");
  assert.equal(b1.excludedCrossDateRows[0].b1Official, false);
  assert.equal(
    b1.games.some(
      (g: { rawMatchup: string }) => g.rawMatchup === "요르단M : 필리핀M",
    ),
    false,
  );

  const jordan = [
    ...obs.basketballOddsFixtures,
  ].find(
    (r: { rawHomeLabel: string; rawAwayLabel: string }) =>
      r.rawHomeLabel === "요르단M" && r.rawAwayLabel === "필리핀M",
  );
  assert.ok(jordan);
  assert.equal(jordan.scopeMembership, "EXCLUDED_NON_TARGET_DATE");

  for (const sealed of SEALED_2026_08_28) {
    assert.equal(sha256File(path.join(cwd, sealed.rel)), sealed.sha256, sealed.rel);
  }

  const pngTracked = execSync(
    "git ls-files -- data/operator-observations/raw/2026-08-29",
    { cwd, encoding: "utf8" },
  );
  assert.equal(pngTracked.includes(".png"), false);

  const engineDiff = execSync(
    "git diff --name-only -- src/lib/engine src/lib/mlb/prediction-v0",
    { cwd, encoding: "utf8" },
  ).trim();
  assert.equal(engineDiff, "");

  console.log("PASS 2026-08-29 schedule identity reconciliation v1");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});

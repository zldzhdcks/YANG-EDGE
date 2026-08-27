/**
 * 2026-08-28 Daily Scope Lock CANDIDATE tests.
 * Run: npm run test:2026-08-28-daily-scope-lock-v1
 *
 * Candidate only. No FINAL SEAL. No Prediction / Engine / Result.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { TEAM_ALIASES } from "../src/lib/teams/team-aliases";
import { findCompetitionByOperatorLabel } from "../src/lib/football/foundation/competition-registry";
import {
  FORMAL_OBSERVED_AT,
  FORBIDDEN_WRITE_PREFIXES,
  RAW_REL,
  SEALED_2026_08_26,
  STRUCTURED_REL,
  runIntake,
} from "./intake-2026-08-28-batch-2228-operator-pregame-observations";
import {
  LOCK_REL,
  LOCK_STATUS,
  SCOPE_LOCK_STATUS,
  lockDailyScopeCandidate,
  sha256File,
} from "./lock-2026-08-28-daily-scope-v1";

function shaFile(p: string): string {
  return createHash("sha256").update(readFileSync(p)).digest("hex");
}

async function main() {
  const cwd = process.cwd();
  await runIntake(cwd);
  const result = await lockDailyScopeCandidate(cwd);
  const lockAbs = path.join(cwd, LOCK_REL);
  const lock = JSON.parse(readFileSync(lockAbs, "utf8"));
  const obs = JSON.parse(readFileSync(path.join(cwd, STRUCTURED_REL), "utf8"));

  assert.equal(existsSync(lockAbs), true);
  assert.equal(lock.schemaVersion, "yang-edge-daily-scope-lock-v1");
  assert.equal(lock.dateKst, "2026-08-28");
  assert.equal(lock.lockStatus, LOCK_STATUS);
  assert.equal(lock.scopeLockStatus, SCOPE_LOCK_STATUS);
  assert.equal(lock.scopeStatus, "CANDIDATE_COMPLETE");
  assert.equal(lock.ownerSealedAt, null);
  assert.equal(lock.creditSeal, false);
  assert.equal(lock.formalObservedAt, FORMAL_OBSERVED_AT);
  assert.equal(lock.formalObservedAtChanged, false);
  assert.equal(lock.scopeTotal, 36);
  assert.equal(lock.accountedFor, 36);
  assert.equal(lock.officialDenominator, 36);
  assert.equal(lock.observedScope.FOOTBALL, 14);
  assert.equal(lock.observedScope.BASKETBALL, 15);
  assert.equal(lock.observedScope.MLB, 7);
  assert.equal(lock.observedScope.total, 36);
  assert.equal(lock.ownerConfirmedCount, 2);
  assert.equal(lock.providerUnsupportedCount, 15);
  assert.equal(lock.identityReviewCount, 12);
  assert.equal(lock.supportedScheduleMatchedCount, 9);
  assert.equal(lock.fuzzyMatchingUsed, false);
  assert.equal(lock.marketBenchmarkOnly, true);
  assert.equal(lock.predictionInput, false);
  assert.equal(lock.engineInput, false);
  assert.equal(lock.predictionCreated, 0);
  assert.equal(lock.predictionCalls, 0);
  assert.equal(lock.resultCalls, 0);
  assert.equal(lock.engineModified, false);
  assert.equal(lock.weightsModified, false);
  assert.equal(lock.researchOnly, true);
  assert.equal(result.lockSha256, sha256File(lockAbs));
  assert.equal(
    lock.sourceOperatorObservationHash,
    shaFile(path.join(cwd, STRUCTURED_REL)),
  );

  const uel = findCompetitionByOperatorLabel("UEL");
  assert.equal(uel?.displayName, "UEFA 유로파리그");
  assert.equal(uel?.competitionId, "fb-comp-api-football-3");
  const approvedLabels = new Set(["셀타비고", "오사수나", "바르셀로", "A빌바오"]);
  const footballAliases = TEAM_ALIASES.filter((a) => a.sport === "football");
  const newlyUsed = footballAliases.filter((a) =>
    a.originalNames.some((n) => approvedLabels.has(n)) ||
    approvedLabels.has(a.displayName),
  );
  assert.equal(newlyUsed.length >= 4, true);
  assert.equal(
    footballAliases.some((a) => a.originalNames.includes("아라라트")),
    false,
  );

  const panama = obs.basketballOddsFixtures.find((r: { markets: Array<{ rowIds: number[] }> }) =>
    r.markets.some((m) => m.rowIds.includes(7023)),
  );
  const mexico = obs.basketballOddsFixtures.find((r: { markets: Array<{ rowIds: number[] }> }) =>
    r.markets.some((m) => m.rowIds.includes(7019)),
  );
  assert.equal(panama.rawHomeLabel, "파나마");
  assert.equal(panama.rawAwayLabel, "캐나다");
  assert.equal(panama.displayedStartKst, "10:40");
  assert.equal(mexico.rawHomeLabel, "멕시코");
  assert.equal(mexico.rawAwayLabel, "콜롬비아");
  assert.equal(mexico.displayedStartKst, "11:10");
  assert.equal(panama.teamLabelStatus, "OWNER_EXPLICIT_CONFIRMATION");
  assert.equal(mexico.teamLabelStatus, "OWNER_EXPLICIT_CONFIRMATION");
  for (const row of obs.basketballOddsFixtures) {
    assert.equal(row.scopeAccountingState, "SCOPE_OBSERVED_PROVIDER_UNSUPPORTED");
    assert.notEqual(row.identityStatus, "MATCHED");
  }
  assert.equal(obs.mlbOddsGames.length, 7);
  for (const row of obs.mlbOddsGames) {
    assert.equal(row.identityStatus, "MATCHED");
    assert.ok(row.gamePk);
    assert.equal(
      row.pregameEligibilityStatus,
      "PRE_GAME_MARKET_OBSERVATION_ELIGIBLE",
    );
  }

  for (const sealed of SEALED_2026_08_26) {
    assert.equal(shaFile(path.join(cwd, sealed.rel)), sealed.sha256, sealed.rel);
  }
  assert.equal(
    existsSync(path.join(cwd, "data/audits/2026-08-27-daily-scope-lock-v1.json")),
    false,
  );
  assert.equal(existsSync(path.join(cwd, "data/predictions/2026-08-28.json")), false);

  const pngTracked = execSync("git ls-files -- " + JSON.stringify(RAW_REL), {
    cwd,
    encoding: "utf8",
  });
  assert.equal(pngTracked.includes(".png"), false);
  const stagedPng = execSync("git diff --cached --name-only -- " + JSON.stringify(RAW_REL), {
    cwd,
    encoding: "utf8",
  });
  assert.equal(stagedPng.includes(".png"), false);

  const status = execSync("git status --short", { cwd, encoding: "utf8" });
  for (const line of status.split(/\r?\n/).filter(Boolean)) {
    const xy = line.slice(0, 2);
    const file = line.slice(3).replace(/"/g, "");
    for (const prefix of FORBIDDEN_WRITE_PREFIXES) {
      const normalized = file.replace(/\\/g, "/");
      if (normalized.includes("data/research/mlb/2026-08-28-")) continue;
      if (normalized.includes("data/research/football/2026-08-28-")) continue;
      if (file.includes(prefix.replace(/\\/g, "/")) || file.includes(prefix)) {
        throw new Error(`forbidden dirty path: ${xy} ${file}`);
      }
    }
    if (file.includes("src/lib/") && /engine|weight/i.test(file)) {
      throw new Error(`engine/weights path dirty: ${xy} ${file}`);
    }
  }

  console.log("PASS 2026-08-28 daily scope lock candidate v1");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});

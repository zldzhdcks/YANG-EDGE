/**
 * 2026-08-29 B2 pregame input coverage seal tests.
 * READ-ONLY. Must not regenerate the OWNER-reviewed artifact.
 *
 * Run: npm run test:2026-08-29-pregame-input-coverage-v1
 */
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  DATE_KST,
  FROZEN_FORMAL_OBSERVED_AT,
  LOCK_REL,
  sha256File,
} from "./lock-2026-08-29-daily-scope-v1";
import { SEALED_2026_08_28 } from "./intake-2026-08-29-batch-2130-operator-pregame-observations";
import {
  SEALED_B1_HASH,
  SEALED_LOCK_HASH,
} from "./audit-2026-08-29-schedule-identity-reconciliation-v1";
import {
  B2_REL,
  SEALED_B2_HASH,
} from "./audit-2026-08-29-pregame-input-coverage-v1";

async function main() {
  const cwd = process.cwd();
  const b2Abs = path.join(cwd, B2_REL);
  assert.equal(existsSync(b2Abs), true);
  assert.equal(sha256File(b2Abs), SEALED_B2_HASH);
  assert.equal(sha256File(path.join(cwd, LOCK_REL)), SEALED_LOCK_HASH);

  const b2 = JSON.parse(readFileSync(b2Abs, "utf8"));
  assert.equal(b2.dateKst, DATE_KST);
  assert.equal(b2.formalObservedAt, FROZEN_FORMAL_OBSERVED_AT);
  assert.equal(b2.b1Sha256, SEALED_B1_HASH);
  assert.equal(b2.games.length, 29);
  assert.equal(b2.coverageByDataset.schedule.state, "COLLECTED");
  assert.equal(b2.coverageByDataset.schedule.gamesCovered, 15);
  for (const key of [
    "starter",
    "bullpen",
    "lineup",
    "injury",
    "weather",
    "travelRest",
    "lineupRefresh",
  ]) {
    assert.equal(b2.coverageByDataset[key].state, "NOT_COLLECTED", key);
    assert.equal(b2.coverageByDataset[key].gamesCovered, 0, key);
  }

  const football = b2.games.filter((g: { sport: string }) => g.sport === "FOOTBALL");
  const basketball = b2.games.filter((g: { sport: string }) => g.sport === "BASKETBALL");
  const mlb = b2.games.filter((g: { sport: string }) => g.sport === "MLB");
  assert.equal(football.length, 8);
  assert.equal(basketball.length, 6);
  assert.equal(mlb.length, 15);
  assert.equal(football.every((g: { coverageState: string }) => g.coverageState === "BLOCKED"), true);
  assert.equal(
    basketball.every((g: { coverageState: string }) => g.coverageState === "BLOCKED"),
    true,
  );
  assert.equal(
    b2.games.some(
      (g: { rawMatchup: string }) => g.rawMatchup === "요르단M : 필리핀M",
    ),
    false,
  );

  assert.equal(b2.marketFirewall.marketBenchmarkOnly, true);
  assert.equal(b2.marketFirewall.predictionInput, false);
  assert.equal(b2.marketFirewall.engineInput, false);
  assert.equal(b2.marketFirewall.marketPriorUsed, false);
  assert.equal(b2.marketFirewall.marketImpliedProbabilityUsed, false);
  assert.equal(b2.marketFirewall.favoriteStatusUsed, false);
  assert.equal(b2.marketFirewall.oddsApiLiveCalls, 0);
  assert.equal(b2.resultCalls, 0);
  assert.equal(b2.predictionProviderCalls, 0);
  assert.equal(b2.engineModified, false);
  assert.equal(b2.weightsModified, false);

  for (const sealed of SEALED_2026_08_28) {
    assert.equal(sha256File(path.join(cwd, sealed.rel)), sealed.sha256, sealed.rel);
  }

  const pngTracked = execSync(
    "git ls-files -- data/operator-observations/raw/2026-08-29",
    { cwd, encoding: "utf8" },
  );
  assert.equal(pngTracked.includes(".png"), false);

  console.log("PASS 2026-08-29 pregame input coverage v1");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});

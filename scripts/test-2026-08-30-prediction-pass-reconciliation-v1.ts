/**
 * 2026-08-30 C Prediction / PASS + snapshot tests.
 * READ-ONLY versus sealed A/B1/B2. Does not call runB1/runB2.
 *
 * Run: npm run test:2026-08-30-prediction-pass-reconciliation-v1
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
} from "./lock-2026-08-30-daily-scope-v1";
import { SEALED_2026_08_29 } from "./intake-2026-08-30-batch-2118-operator-pregame-observations";
import {
  B1_REL,
  REQUIRED_UNRESOLVED,
  SEALED_B1_SHA256,
  SEALED_REGISTRY,
  SEALED_STAGE_A,
} from "./audit-2026-08-30-schedule-identity-reconciliation-v1";
import { SEALED_B2_SHA256 } from "./audit-2026-08-30-pregame-input-coverage-v1";
import {
  C_RECON_REL,
  C_SNAPSHOT_REL,
} from "./audit-2026-08-30-prediction-pass-reconciliation-v1";

async function main() {
  const cwd = process.cwd();
  const reconAbs = path.join(cwd, C_RECON_REL);
  const snapAbs = path.join(cwd, C_SNAPSHOT_REL);
  assert.equal(existsSync(reconAbs), true);
  assert.equal(existsSync(snapAbs), true);

  const recon = JSON.parse(readFileSync(reconAbs, "utf8"));
  const snap = JSON.parse(readFileSync(snapAbs, "utf8"));

  assert.equal(recon.dateKst, DATE_KST);
  assert.equal(recon.stage, "C");
  assert.equal(recon.officialScopeTotal, 44);
  assert.equal(recon.predictionCount, 0);
  assert.equal(recon.passCount, 44);
  assert.equal(recon.officialRecommendationCount, 0);
  assert.deepEqual(recon.officialRecommendations, []);
  assert.equal(recon.rows.length, 44);
  assert.equal(recon.predictionCount + recon.passCount, 44);
  assert.equal(
    recon.officialRecommendationCount,
    recon.officialRecommendations.length,
  );

  assert.equal(recon.passBreakdown.PASS_ENGINE_NOT_APPROVED, 31);
  assert.equal(recon.passBreakdown.PASS_IDENTITY_REVIEW_REQUIRED, 13);
  assert.equal(
    (recon.passBreakdown.PASS_ENGINE_NOT_APPROVED ?? 0) +
      (recon.passBreakdown.PASS_IDENTITY_REVIEW_REQUIRED ?? 0),
    44,
  );
  assert.equal(
    recon.rows.every((g: { cState: string }) => g.cState !== "PREDICTION"),
    true,
  );

  for (const [league, kickoff, home, away] of REQUIRED_UNRESOLVED) {
    const row = recon.rows.find(
      (g: {
        sport: string;
        league: string;
        startTimeKst: string;
        rawMatchup: string;
      }) =>
        g.sport === "FOOTBALL" &&
        g.league === league &&
        g.startTimeKst === kickoff &&
        g.rawMatchup === `${home} : ${away}`,
    );
    assert.ok(row, `blocked missing ${home}:${away}`);
    assert.equal(row.cState, "PASS_IDENTITY_REVIEW_REQUIRED");
    assert.equal(row.providerGameId, null);
  }

  assert.equal(recon.formalObservedAt, FROZEN_FORMAL_OBSERVED_AT);
  assert.equal(snap.formalObservedAt, FROZEN_FORMAL_OBSERVED_AT);
  assert.equal(recon.decisionAt, snap.decisionAt);
  assert.equal(recon.predictedAt, snap.predictedAt);
  assert.equal(recon.modelActuallyUsed, "NONE");
  assert.equal(
    recon.modelApprovalStatus,
    "NOT_APPROVED_FOR_OFFICIAL_RECOMMENDATION",
  );
  assert.equal(recon.dummyEngineUsed, false);
  assert.equal(recon.legacyMarketAssistedModelUsed, false);
  assert.equal(snap.resultDataPresent, false);
  assert.equal(snap.officialRecommendationCount, 0);

  assert.equal(recon.marketFirewall.marketBenchmarkOnly, true);
  assert.equal(recon.marketFirewall.predictionInput, false);
  assert.equal(recon.marketFirewall.engineInput, false);
  assert.equal(recon.marketFirewall.marketPriorUsed, false);
  assert.equal(recon.resultCalls, 0);
  assert.equal(recon.predictionProviderCalls, 0);
  assert.equal(recon.engineCalls, 0);
  assert.equal(recon.engineModified, false);
  assert.equal(recon.weightsModified, false);
  assert.equal(recon.resultDataUsed, false);
  assert.equal(recon.fuzzyMatchingUsed, false);
  assert.equal(recon.b1Sha256, SEALED_B1_SHA256);
  assert.equal(recon.b2Sha256, SEALED_B2_SHA256);
  assert.equal(sha256File(path.join(cwd, B1_REL)), SEALED_B1_SHA256);
  assert.equal(sha256File(path.join(cwd, LOCK_REL)), SEALED_STAGE_A[0]!.sha256);

  const snapText = readFileSync(snapAbs, "utf8");
  assert.equal(/"score"\s*:/.test(snapText), false);
  assert.equal(/"winner"\s*:/.test(snapText), false);
  assert.equal(/"grade"\s*:/.test(snapText), false);
  assert.equal(/"result"\s*:/.test(snapText), false);

  for (const sealed of SEALED_STAGE_A) {
    assert.equal(sha256File(path.join(cwd, sealed.rel)), sealed.sha256, sealed.rel);
  }
  for (const sealed of SEALED_2026_08_29) {
    assert.equal(sha256File(path.join(cwd, sealed.rel)), sealed.sha256, sealed.rel);
  }
  for (const sealed of SEALED_REGISTRY) {
    assert.equal(sha256File(path.join(cwd, sealed.rel)), sealed.sha256, sealed.rel);
  }

  const pngTracked = execSync(
    "git ls-files -- data/operator-observations/raw/2026-08-30 data/operator-observations/raw/2026-08-29",
    { cwd, encoding: "utf8" },
  );
  assert.equal(pngTracked.includes(".png"), false);

  const engineDiff = execSync(
    "git diff --name-only -- src/lib/engine src/lib/mlb/prediction-v0",
    { cwd, encoding: "utf8" },
  ).trim();
  assert.equal(engineDiff, "");

  console.log("PASS 2026-08-30 prediction pass reconciliation v1");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});

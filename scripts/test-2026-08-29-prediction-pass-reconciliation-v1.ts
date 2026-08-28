/**
 * 2026-08-29 C Prediction / PASS + snapshot seal tests.
 * READ-ONLY. Must not regenerate decisionAt or OWNER-reviewed hashes.
 *
 * Run: npm run test:2026-08-29-prediction-pass-reconciliation-v1
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
import { SEALED_LOCK_HASH } from "./audit-2026-08-29-schedule-identity-reconciliation-v1";
import { SEALED_B2_HASH } from "./audit-2026-08-29-pregame-input-coverage-v1";
import {
  C_RECON_REL,
  C_SNAPSHOT_REL,
  FROZEN_DECISION_AT,
  SEALED_C_RECON_HASH,
  SEALED_C_SNAPSHOT_HASH,
} from "./audit-2026-08-29-prediction-pass-reconciliation-v1";

async function main() {
  const cwd = process.cwd();
  const reconAbs = path.join(cwd, C_RECON_REL);
  const snapAbs = path.join(cwd, C_SNAPSHOT_REL);
  assert.equal(existsSync(reconAbs), true);
  assert.equal(existsSync(snapAbs), true);
  assert.equal(sha256File(reconAbs), SEALED_C_RECON_HASH);
  assert.equal(sha256File(snapAbs), SEALED_C_SNAPSHOT_HASH);
  assert.equal(sha256File(path.join(cwd, LOCK_REL)), SEALED_LOCK_HASH);

  const recon = JSON.parse(readFileSync(reconAbs, "utf8"));
  const snap = JSON.parse(readFileSync(snapAbs, "utf8"));

  assert.equal(recon.dateKst, DATE_KST);
  assert.equal(recon.officialScopeTotal, 29);
  assert.equal(recon.predictionCount, 0);
  assert.equal(recon.passCount, 29);
  assert.equal(recon.officialRecommendationCount, 0);
  assert.deepEqual(recon.officialRecommendations, []);
  assert.equal(recon.passBreakdown.PASS_ENGINE_NOT_APPROVED, 15);
  assert.equal(recon.passBreakdown.PASS_COMPETITION_REVIEW_REQUIRED, 6);
  assert.equal(recon.passBreakdown.PASS_PROVIDER_NOT_SUPPORTED, 6);
  assert.equal(recon.passBreakdown.PASS_IDENTITY_REVIEW_REQUIRED, 2);
  assert.equal(
    recon.passBreakdown.PASS_ENGINE_NOT_APPROVED +
      recon.passBreakdown.PASS_COMPETITION_REVIEW_REQUIRED +
      recon.passBreakdown.PASS_PROVIDER_NOT_SUPPORTED +
      recon.passBreakdown.PASS_IDENTITY_REVIEW_REQUIRED,
    29,
  );
  assert.equal(recon.games.length, 29);
  assert.equal(
    recon.games.every((g: { cState: string }) => g.cState !== "PREDICTION"),
    true,
  );
  assert.equal(
    recon.games.some(
      (g: { rawMatchup: string }) => g.rawMatchup === "요르단M : 필리핀M",
    ),
    false,
  );

  assert.equal(recon.decisionAt, FROZEN_DECISION_AT);
  assert.equal(recon.predictedAt, FROZEN_DECISION_AT);
  assert.equal(snap.decisionAt, FROZEN_DECISION_AT);
  assert.equal(snap.predictedAt, FROZEN_DECISION_AT);
  assert.equal(recon.formalObservedAt, FROZEN_FORMAL_OBSERVED_AT);
  assert.equal(snap.formalObservedAt, FROZEN_FORMAL_OBSERVED_AT);

  assert.equal(recon.modelActuallyUsed, "NONE");
  assert.equal(
    recon.modelApprovalStatus,
    "NOT_APPROVED_FOR_OFFICIAL_RECOMMENDATION",
  );
  assert.equal(recon.dummyEngineUsed, false);
  assert.equal(recon.legacyMarketAssistedModelUsed, false);
  assert.equal(recon.inspectedModel.approvedForOfficialRecommendation, false);
  assert.equal(snap.dummyEngineUsed, false);
  assert.equal(snap.legacyMarketAssistedModelUsed, false);
  assert.equal(snap.resultDataPresent, false);
  assert.equal(snap.predictionCount, 0);
  assert.equal(snap.passCount, 29);
  assert.equal(snap.officialRecommendationCount, 0);

  assert.equal(recon.marketFirewall.marketBenchmarkOnly, true);
  assert.equal(recon.marketFirewall.predictionInput, false);
  assert.equal(recon.marketFirewall.engineInput, false);
  assert.equal(recon.resultCalls, 0);
  assert.equal(recon.predictionProviderCalls, 0);
  assert.equal(recon.engineModified, false);
  assert.equal(recon.weightsModified, false);
  assert.equal(recon.b2Sha256, SEALED_B2_HASH);

  assert.equal(existsSync(path.join(cwd, "data/predictions/2026-08-29.json")), false);

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

  console.log("PASS 2026-08-29 prediction pass reconciliation v1");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});

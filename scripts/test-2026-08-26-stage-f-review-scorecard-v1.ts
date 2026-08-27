/**
 * 2026-08-26 Stage F Success/Failure Review + Scorecard tests.
 * Repository-only. Zero live provider calls.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  DAILY_STAGE_F_METRIC_NA,
  DAILY_STAGE_F_PREDICTION_PERFORMANCE_STATUS,
  STAGE_F_B1_REL,
  STAGE_F_B2_REL,
  STAGE_F_C_REL,
  STAGE_F_C_SHA256,
  STAGE_F_CLOSE_REL,
  STAGE_F_E_REL,
  STAGE_F_E_SHA256,
  STAGE_F_SCOPE_REL,
  STAGE_F_SNAPSHOT_REL,
  STAGE_F_SNAPSHOT_SHA256,
  assertDailyStageFInvariants,
  buildDailyStageFReviewScorecardV1,
} from "../src/lib/daily-ops/stage-f-review-scorecard-v1";

const SEALED = [
  STAGE_F_SCOPE_REL,
  STAGE_F_B1_REL,
  STAGE_F_B2_REL,
  STAGE_F_C_REL,
  STAGE_F_SNAPSHOT_REL,
  STAGE_F_E_REL,
] as const;

function shaFile(rel: string): string {
  return createHash("sha256")
    .update(readFileSync(path.join(process.cwd(), rel), "utf8"))
    .digest("hex");
}

async function main() {
  const cwd = process.cwd();
  assert.equal(shaFile(STAGE_F_C_REL), STAGE_F_C_SHA256);
  assert.equal(shaFile(STAGE_F_SNAPSHOT_REL), STAGE_F_SNAPSHOT_SHA256);
  assert.equal(shaFile(STAGE_F_E_REL), STAGE_F_E_SHA256);

  const liveForbidden = "LIVE_PROVIDER_FORBIDDEN_DURING_STAGE_F_TEST";
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error(liveForbidden);
  };
  let doc;
  try {
    doc = await buildDailyStageFReviewScorecardV1({
      cwd,
      reviewRunAt: "2026-08-27T12:40:00.000Z",
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
  assertDailyStageFInvariants(doc);

  assert.equal(doc.scopeTotal, 26);
  assert.equal(doc.predictionPerformance.predictionCount, 0);
  assert.equal(doc.predictionPerformance.passCount, 26);
  assert.equal(doc.predictionPerformance.gradedPredictionCount, 0);
  assert.equal(doc.predictionPerformance.correct, 0);
  assert.equal(doc.predictionPerformance.incorrect, 0);
  assert.equal(doc.predictionPerformance.accuracy.value, null);
  assert.equal(doc.predictionPerformance.accuracy.semantics, DAILY_STAGE_F_METRIC_NA);
  assert.notEqual(doc.predictionPerformance.accuracy.value, 0);
  assert.equal(doc.predictionPerformance.hitRate.semantics, DAILY_STAGE_F_METRIC_NA);
  assert.equal(doc.predictionPerformance.status, DAILY_STAGE_F_PREDICTION_PERFORMANCE_STATUS);
  assert.equal(doc.predictionPerformance.passAssignedSuccessFailureCount, 0);
  assert.equal(doc.predictionPerformance.passHitMissCount, 0);
  assert.equal(doc.games.length, 26);
  assert.equal(doc.games.every((g) => g.successFailureAssigned === false), true);
  assert.equal(doc.cStateCounts.PASS_ENGINE_NOT_APPROVED, 11);
  assert.equal(doc.cStateCounts.PASS_IDENTITY_REVIEW_REQUIRED, 13);
  assert.equal(doc.cStateCounts.PASS_MISSED_PRE_GAME_WINDOW, 1);
  assert.equal(doc.cStateCounts.PASS_PROVIDER_NOT_SUPPORTED, 1);
  assert.equal(doc.resultCoverage.finalResultCount, 13);
  assert.equal(doc.resultCoverage.terminalCoverageGapCount, 13);
  assert.equal(doc.resultCoverage.identityCoverageGapCount, 12);
  assert.equal(doc.resultCoverage.unsupportedCoverageGapCount, 1);
  assert.equal(doc.resultCoverage.fullFinalClaim, false);
  assert.equal(doc.marketOddsIsolation.predictionInput, false);
  assert.equal(doc.marketOddsIsolation.engineInput, false);
  assert.equal(doc.marketOddsIsolation.marketBenchmarkOnly, true);
  assert.equal(doc.leakage.retroactivePredictionAllowed, false);
  assert.equal(doc.leakage.fuzzyMatchingUsed, false);
  assert.equal(doc.leakage.engineModified, false);
  assert.equal(doc.leakage.weightsModified, false);
  assert.equal(doc.leakage.predictionModified, false);
  assert.equal(doc.providerNetworkCallCount, 0);
  assert.equal(doc.providerPredictionsEndpointUsed, false);
  assert.equal(doc.sportFindings.baseball.scopedCount, 11);
  assert.equal(doc.sportFindings.baseball.kboCount, 5);
  assert.equal(doc.sportFindings.baseball.npbCount, 6);
  assert.equal(doc.sportFindings.baseball.engineActivationRecommended, false);
  assert.equal(doc.sportFindings.football.predictionIdentityEqualsResultIdentity, false);
  assert.equal(doc.architecture.footballPickLevelScorecardApplied, false);
  assert.equal(doc.validatedHypothesisCount, 0);
  assert.equal(doc.enginePromotionCount, 0);
  assert.equal(doc.officialMandatoryCompletionRemainsPct, 75);
  assert.equal(doc.fStatus, "CANDIDATE_COMPLETE");
  assert.equal(doc.researchHygieneControls.length, 15);
  assert.equal(
    doc.futureResearchCandidates.every((c) => c.kind === "FOLLOW_UP_CANDIDATE" && c.implemented === false),
    true,
  );

  assert.equal(shaFile(STAGE_F_C_REL), STAGE_F_C_SHA256);
  assert.equal(shaFile(STAGE_F_SNAPSHOT_REL), STAGE_F_SNAPSHOT_SHA256);
  assert.equal(shaFile(STAGE_F_E_REL), STAGE_F_E_SHA256);

  const sealedDiff = execSync(
    `git diff --name-only -- ${SEALED.join(" ")} src/lib/engine src/app/analysis`,
    { cwd, encoding: "utf8" },
  ).trim();
  assert.equal(sealedDiff, "");

  if (existsSync(path.join(cwd, STAGE_F_CLOSE_REL))) {
    const written = JSON.parse(readFileSync(path.join(cwd, STAGE_F_CLOSE_REL), "utf8")) as {
      scopeTotal: number;
      predictionPerformance: {
        predictionCount: number;
        passCount: number;
        gradedPredictionCount: number;
        accuracy: { value: null; semantics: string };
        passAssignedSuccessFailureCount: number;
      };
      games: Array<{ successFailureAssigned: boolean }>;
      providerNetworkCallCount: number;
      fStatus: string;
    };
    assert.equal(written.scopeTotal, 26);
    assert.equal(written.predictionPerformance.predictionCount, 0);
    assert.equal(written.predictionPerformance.passCount, 26);
    assert.equal(written.predictionPerformance.gradedPredictionCount, 0);
    assert.equal(written.predictionPerformance.accuracy.value, null);
    assert.equal(written.predictionPerformance.accuracy.semantics, DAILY_STAGE_F_METRIC_NA);
    assert.equal(written.predictionPerformance.passAssignedSuccessFailureCount, 0);
    assert.equal(written.games.every((g) => g.successFailureAssigned === false), true);
    assert.equal(written.providerNetworkCallCount, 0);
    assert.equal(written.fStatus, "CANDIDATE_COMPLETE");
  }

  console.log("test:2026-08-26-stage-f-review-scorecard-v1 OK", {
    scopeTotal: 26,
    predictionCount: 0,
    passCount: 26,
    accuracy: DAILY_STAGE_F_METRIC_NA,
    fStatus: doc.fStatus,
    fetchCalls: 0,
  });
}

main();

/**
 * 2026-08-26 Stage G Daily Close + Git Sync tests.
 * Repository + local git only. Zero live provider calls.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  DAILY_STAGE_G_METRIC_NA,
  STAGE_G_B1_REL,
  STAGE_G_B2_REL,
  STAGE_G_C_REL,
  STAGE_G_C_SHA256,
  STAGE_G_CLOSE_REL,
  STAGE_G_E_REL,
  STAGE_G_E_SHA256,
  STAGE_G_F_REL,
  STAGE_G_F_SHA256,
  STAGE_G_REQUIRED_HEAD,
  STAGE_G_SCOPE_REL,
  STAGE_G_SCOPE_SHA256,
  STAGE_G_SNAPSHOT_REL,
  STAGE_G_SNAPSHOT_SHA256,
  assertDailyStageGInvariants,
  buildDailyStageGDailyCloseV1,
} from "../src/lib/daily-ops/stage-g-daily-close-v1";

const SEALED = [
  STAGE_G_SCOPE_REL,
  STAGE_G_B1_REL,
  STAGE_G_B2_REL,
  STAGE_G_C_REL,
  STAGE_G_SNAPSHOT_REL,
  STAGE_G_E_REL,
  STAGE_G_F_REL,
] as const;

function shaFile(rel: string): string {
  return createHash("sha256")
    .update(readFileSync(path.join(process.cwd(), rel), "utf8"))
    .digest("hex");
}

async function main() {
  const cwd = process.cwd();
  assert.equal(shaFile(STAGE_G_SCOPE_REL), STAGE_G_SCOPE_SHA256);
  assert.equal(shaFile(STAGE_G_C_REL), STAGE_G_C_SHA256);
  assert.equal(shaFile(STAGE_G_SNAPSHOT_REL), STAGE_G_SNAPSHOT_SHA256);
  assert.equal(shaFile(STAGE_G_E_REL), STAGE_G_E_SHA256);
  assert.equal(shaFile(STAGE_G_F_REL), STAGE_G_F_SHA256);

  const liveForbidden = "LIVE_PROVIDER_FORBIDDEN_DURING_STAGE_G_TEST";
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error(liveForbidden);
  };
  let doc;
  try {
    doc = await buildDailyStageGDailyCloseV1({
      cwd,
      closeAuditRunAt: "2026-08-27T13:10:00.000Z",
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
  assertDailyStageGInvariants(doc);

  assert.equal(doc.scope.scopeTotal, 26);
  assert.equal(doc.predictionPass.predictionCount, 0);
  assert.equal(doc.predictionPass.passCount, 26);
  assert.equal(doc.predictionPass.passReasonTotal, 26);
  assert.equal(doc.predictionPass.gradedPredictionCount, 0);
  assert.equal(doc.predictionPass.predictionPerformanceSemantics, DAILY_STAGE_G_METRIC_NA);
  assert.equal(doc.resultGrade.operationallyClosedCount, 26);
  assert.equal(doc.resultGrade.finalResultCount, 13);
  assert.equal(doc.resultGrade.terminalCoverageGapCount, 13);
  assert.equal(doc.resultGrade.activePendingCount, 0);
  assert.equal(doc.resultGrade.resultCoverage, "13_OF_26");
  assert.equal(doc.resultGrade.fullFinalClaim, false);
  assert.equal(doc.marketOddsFirewall.marketBenchmarkOnly, true);
  assert.equal(doc.marketOddsFirewall.predictionInput, false);
  assert.equal(doc.marketOddsFirewall.engineInput, false);
  assert.equal(doc.predictionPass.retroactivePrediction, false);
  assert.equal(doc.predictionPass.passConvertedToGradedOutcome, 0);
  assert.equal(doc.identityAudit.fuzzyMatchingUsed, false);
  assert.equal(doc.resultGrade.fabricatedScoreCount, 0);
  assert.equal(doc.engineWeightAudit.engineModified, false);
  assert.equal(doc.engineWeightAudit.weightsModified, false);
  assert.equal(doc.fReview.validatedHypothesisCreated, 0);
  assert.equal(doc.providerNetworkCallCount, 0);
  assert.equal(doc.providerPredictionsEndpointUsed, false);
  assert.equal(doc.leakageAudit.status, "PASS");
  assert.equal(doc.credits.preGTotal, 95);
  assert.equal(doc.credits.officialCompletionBeforeSeal, 95);
  assert.equal(doc.credits.targetCompletionAfterSeal, 100);
  assert.equal(doc.gitLineage.head, STAGE_G_REQUIRED_HEAD);
  assert.equal(doc.gStatus, "CANDIDATE_COMPLETE");
  assert.equal(doc.scope.kbo, 5);
  assert.equal(doc.scope.npb, 6);
  assert.equal(doc.scope.football, 14);
  assert.equal(doc.scope.volleyball, 1);
  assert.equal(doc.scope.mlb, 0);

  assert.equal(shaFile(STAGE_G_C_REL), STAGE_G_C_SHA256);
  assert.equal(shaFile(STAGE_G_SNAPSHOT_REL), STAGE_G_SNAPSHOT_SHA256);
  assert.equal(shaFile(STAGE_G_E_REL), STAGE_G_E_SHA256);
  assert.equal(shaFile(STAGE_G_F_REL), STAGE_G_F_SHA256);

  const sealedDiff = execSync(
    `git diff --name-only -- ${SEALED.join(" ")} src/lib/engine src/app/analysis`,
    { cwd, encoding: "utf8" },
  ).trim();
  assert.equal(sealedDiff, "");

  if (existsSync(path.join(cwd, STAGE_G_CLOSE_REL))) {
    const written = JSON.parse(readFileSync(path.join(cwd, STAGE_G_CLOSE_REL), "utf8")) as {
      scope: { scopeTotal: number };
      predictionPass: { predictionCount: number; passCount: number };
      resultGrade: { finalResultCount: number; fullFinalClaim: boolean };
      leakageAudit: { status: string };
      credits: { officialCompletionBeforeSeal: number; G: { awarded: number } };
      gStatus: string;
      providerNetworkCallCount: number;
    };
    assert.equal(written.scope.scopeTotal, 26);
    assert.equal(written.predictionPass.predictionCount, 0);
    assert.equal(written.predictionPass.passCount, 26);
    assert.equal(written.resultGrade.finalResultCount, 13);
    assert.equal(written.resultGrade.fullFinalClaim, false);
    assert.equal(written.leakageAudit.status, "PASS");
    assert.equal(written.credits.officialCompletionBeforeSeal, 95);
    assert.equal(written.credits.G.awarded, 0);
    assert.equal(written.gStatus, "CANDIDATE_COMPLETE");
    assert.equal(written.providerNetworkCallCount, 0);
  }

  console.log("test:2026-08-26-stage-g-daily-close-v1 OK", {
    scopeTotal: 26,
    predictionCount: 0,
    passCount: 26,
    leakage: doc.leakageAudit.status,
    gStatus: doc.gStatus,
    fetchCalls: 0,
  });
}

main();

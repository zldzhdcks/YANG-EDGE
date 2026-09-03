/**
 * 2025 EXTERNAL REPLICATION TRACK — frozen v2-C MODEL_CANDIDATE review tests.
 * Decision review only. Must not rerun evaluation or parse the 2025 Join.
 *
 *   npm run test:mlb-independent-external-replication-v2c-candidate-review-2025
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { independentJoinArtifactPath } from "../src/lib/mlb/independent-join-v1";
import { independentLabelArtifactPath } from "../src/lib/mlb/independent-label-v1";
import {
  independentSafeAFeatureArtifactPath,
  independentSafeAHistoricalSourcePath,
} from "../src/lib/mlb/independent-safe-a-v1/historical-source";
import {
  MLB_INDEPENDENT_2024_SEALED_JOIN_SHA256_V1,
  independentSplitArtifactPath,
} from "../src/lib/mlb/independent-split-v1";
import { independentLogisticModelPath } from "../src/lib/mlb/independent-logistic-v1";
import { independentLogisticV2aModelPath } from "../src/lib/mlb/independent-logistic-v2a";
import { independentLogisticV2bModelPath } from "../src/lib/mlb/independent-logistic-v2b";
import { independentLogisticV2cModelPath } from "../src/lib/mlb/independent-logistic-v2c";
import {
  EXTERNAL_REPLICATION_EXPOSED_STATE,
  FROZEN_2024_HOLDOUT_MEMBERSHIP_COUNT,
  MLB_INDEPENDENT_2025_SEALED_FEATURE_SHA256,
  MLB_INDEPENDENT_2025_SEALED_JOIN_SHA256,
  MLB_INDEPENDENT_2025_SEALED_LABEL_SHA256,
  MLB_INDEPENDENT_2025_SEALED_SOURCE_SHA256,
  MLB_INDEPENDENT_2025_SEALED_V2C_EVALUATION_SHA256,
  MLB_INDEPENDENT_2025_SEALED_V2C_MODEL_ARTIFACT_SHA256,
  MLB_INDEPENDENT_2025_SEALED_V2C_MODEL_CORE_HASH,
  MLB_INDEPENDENT_2025_SEALED_V2C_PROTOCOL_SHA256,
  SEALED_2025_BRIER,
  SEALED_2025_EXTERNAL_SAMPLE_COUNT,
  SEALED_2025_LOG_LOSS,
  SEALED_2025_ROC_AUC,
  SEALED_ABSOLUTE_CORRECT_GAME_ADVANTAGE,
  SEALED_CONSTANT_BASELINE_ACCURACY,
  SEALED_CONSTANT_BASELINE_AUC,
  SEALED_CONSTANT_BASELINE_BRIER,
  SEALED_CONSTANT_BASELINE_LOG_LOSS,
  SEALED_CONSTANT_HOME_BASELINE_CORRECT_COUNT,
  SEALED_PRIMARY_PASS_COUNT,
  SEALED_V2C_ACCURACY,
  SEALED_V2C_CORRECT_COUNT,
  V2C_CANDIDATE_PRIMARY_REASON,
  V2C_CANDIDATE_REVIEW_DECISION,
  V2C_CANDIDATE_SUPPORTING_REASON,
  hashExternalReplicationCandidateReviewArtifact2025,
  independentExternalReplication2025FeaturePath,
  independentExternalReplication2025JoinPath,
  independentExternalReplication2025LabelPath,
  independentExternalReplication2025SourcePath,
  independentExternalReplication2025V2cCandidateReviewAuditPath,
  independentExternalReplication2025V2cCandidateReviewPath,
  independentExternalReplication2025V2cEvaluationPath,
  independentExternalReplication2025V2cProtocolPath,
  independentSealedV2cModelArtifactPath,
  reviewV2cModelCandidate2025,
  type SealedV2cExternalReplicationEvidence2025,
} from "../src/lib/mlb/independent-external-replication-v1";

const ROOT = process.cwd();
const REVIEW_LIB = path.join(
  ROOT,
  "src/lib/mlb/independent-external-replication-v1/review-v2c-candidate-2025.ts",
);
const REVIEW_SCRIPT = path.join(
  ROOT,
  "scripts/review-mlb-independent-external-replication-v2c-candidate-2025.ts",
);
const JOIN_SHA_2024 = MLB_INDEPENDENT_2024_SEALED_JOIN_SHA256_V1;
const SPLIT_MANIFEST_SHA =
  "a72b8586971ee81a04e119c7d860f226abb503b5cc2341bb370d49d2fb47e71d";
const SOURCE_2024_SHA =
  "7a637e182a91a0b20e399ed2a4d98824c3a5916ac61cb6903e504a919a514e7d";
const FEATURE_2024_SHA =
  "5f0cf297ebc9e5a1e0b10aad136632f51ddbc9f6b1560c676f3df2aa2ea8c753";
const LABEL_2024_SHA =
  "9f52cd1de57567819dd7f6fea245baad1365a6eae12dadeafec76ead02d7a3da";
const V1_CORE =
  "7cb5253c824de514c25b1715e6f339b0f35c6942fa25c178423a415ec820430e";
const V2A_CORE =
  "bef2104957768a40cbfecbeb3ff99946dce80a7155ab93a29248cc6fab576c9b";
const V2B_CORE =
  "f601594dcac1ae266424cf1a1503ecc1228099c2b1e090c634d54868f379c24e";
const FORBIDDEN_RERUN_TOKENS = [
  "evaluateV2cExternalReplication2025",
  "evaluateProbabilitiesV1",
  "transformExternalReplicationFeatureWithFrozenPrep2025",
  "transformRowV2c",
  "fitTrainPreprocessorV2c",
  "fitFullBatchLogisticV1",
  "rocAucMannWhitney2025",
  "predictLogisticProbability",
];
const FORBIDDEN_SLICE_TOKENS = [
  "monthlyAnalysis",
  "teamAnalysis",
  "subgroupAnalysis",
  "featureDiagnostic",
  "calibrationBin",
  "thresholdSearch",
];

function sha256File(filePath: string): string {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function assertThrowsCode(fn: () => unknown, code: string, label: string): void {
  try {
    fn();
  } catch (e) {
    const err = e as { code?: string; message?: string };
    assert.equal(
      err.code,
      code,
      `${label}: expected ${code}, got ${err.code} (${err.message})`,
    );
    return;
  }
  assert.fail(`${label}: expected throw ${code}`);
}

function sealedEvidence(): SealedV2cExternalReplicationEvidence2025 {
  return {
    sampleCount: SEALED_2025_EXTERNAL_SAMPLE_COUNT,
    modelCandidate: false,
    v2cModelCoreHash: MLB_INDEPENDENT_2025_SEALED_V2C_MODEL_CORE_HASH,
    engineAdmission: "PROHIBITED",
    primaryMetrics: {
      rocAuc: SEALED_2025_ROC_AUC,
      logLoss: SEALED_2025_LOG_LOSS,
      brierScore: SEALED_2025_BRIER,
    },
    constantBaselineMetrics: {
      probability: 0.530416951469583,
      rocAuc: SEALED_CONSTANT_BASELINE_AUC,
      accuracy: SEALED_CONSTANT_BASELINE_ACCURACY,
      logLoss: SEALED_CONSTANT_BASELINE_LOG_LOSS,
      brierScore: SEALED_CONSTANT_BASELINE_BRIER,
    },
    directionalChecks: {
      AUC_PASS: true,
      LOGLOSS_PASS: false,
      BRIER_PASS: false,
      passCount: SEALED_PRIMARY_PASS_COUNT,
    },
    directionalVerdict: V2C_CANDIDATE_SUPPORTING_REASON,
    secondaryMetrics: {
      accuracy: SEALED_V2C_ACCURACY,
      TP: 875,
      TN: 454,
      FP: 657,
      FN: 444,
    },
  };
}

function main(): void {
  const evaluationSha = sha256File(independentExternalReplication2025V2cEvaluationPath());
  assert.equal(evaluationSha, MLB_INDEPENDENT_2025_SEALED_V2C_EVALUATION_SHA256);
  console.log("EVALUATION_SHA_PIN_MATCH = PASS");

  const modelSha = sha256File(independentSealedV2cModelArtifactPath());
  assert.equal(modelSha, MLB_INDEPENDENT_2025_SEALED_V2C_MODEL_ARTIFACT_SHA256);
  const model = JSON.parse(
    readFileSync(independentSealedV2cModelArtifactPath(), "utf8"),
  ) as { modelCoreHash: string; modelCandidate?: boolean };
  assert.equal(model.modelCoreHash, MLB_INDEPENDENT_2025_SEALED_V2C_MODEL_CORE_HASH);
  assert.equal(model.modelCandidate ?? false, false);
  console.log("MODEL_CORE_HASH_UNCHANGED = PASS");

  const parsedEvaluation = JSON.parse(
    readFileSync(independentExternalReplication2025V2cEvaluationPath(), "utf8"),
  ) as {
    sampleCount: number;
    modelCandidate: boolean;
    directionalVerdict: string;
    primaryMetrics: { rocAuc: number; logLoss: number; brierScore: number };
    directionalChecks: {
      AUC_PASS: boolean;
      LOGLOSS_PASS: boolean;
      BRIER_PASS: boolean;
      passCount: number;
    };
    secondaryMetrics: { accuracy: number; TP: number; TN: number; FP: number; FN: number };
  };
  assert.equal(parsedEvaluation.sampleCount, 2430);
  assert.equal(parsedEvaluation.directionalVerdict, "MIXED_EXTERNAL_REPLICATION");
  assert.equal(parsedEvaluation.directionalChecks.passCount, 1);
  assert.equal(parsedEvaluation.directionalChecks.AUC_PASS, true);
  assert.equal(parsedEvaluation.directionalChecks.LOGLOSS_PASS, false);
  assert.equal(parsedEvaluation.directionalChecks.BRIER_PASS, false);
  assert.equal(parsedEvaluation.modelCandidate, false);
  assert.equal(
    parsedEvaluation.secondaryMetrics.TP + parsedEvaluation.secondaryMetrics.TN,
    SEALED_V2C_CORRECT_COUNT,
  );
  console.log("SEALED_EXTERNAL_EVIDENCE_PRESERVED = PASS");

  const evidence = sealedEvidence();
  const generatedAt = "2026-09-03T03:12:00.000Z";
  const result = reviewV2cModelCandidate2025({
    evaluationSha256: evaluationSha,
    evidence,
    modelCoreHash: MLB_INDEPENDENT_2025_SEALED_V2C_MODEL_CORE_HASH,
    generatedAt,
  });
  assert.equal(result.review.candidateDecision, V2C_CANDIDATE_REVIEW_DECISION);
  assert.equal(result.review.candidate, false);
  assert.equal(result.review.primaryReason, V2C_CANDIDATE_PRIMARY_REASON);
  assert.equal(result.review.supportingReason, V2C_CANDIDATE_SUPPORTING_REASON);
  assert.equal(result.review.externalVerdict, "MIXED_EXTERNAL_REPLICATION");
  assert.equal(result.review.hasReplicatedRankingSignal, true);
  assert.equal(result.review.hasReplicatedProbabilityQuality, false);
  assert.equal(result.review.researchBaseline, "SEALED");
  assert.equal(result.review.holdoutOpen, false);
  assert.equal(result.review.holdoutEvaluated, false);
  assert.equal(result.review.holdoutMembershipCount, FROZEN_2024_HOLDOUT_MEMBERSHIP_COUNT);
  assert.equal(result.review.holdoutFeatureRowsRead, 0);
  assert.equal(result.review.holdoutLabelRowsRead, 0);
  assert.equal(result.review.holdoutTransformedRows, 0);
  assert.equal(result.review.holdoutLogitsCreated, 0);
  assert.equal(result.review.holdoutProbabilitiesCreated, 0);
  assert.equal(result.review["2025ExternalState"], EXTERNAL_REPLICATION_EXPOSED_STATE);
  assert.equal(result.review["2025ModelUnseen"], false);
  assert.equal(result.review.rerun2025AsUntouchedExternalAllowed, false);
  assert.equal(result.review.postExposureDiagnosticPerformed, false);
  assert.equal(result.review.engineAdmission, "PROHIBITED");
  assert.equal(result.review.secondaryContext.v2cCorrect, SEALED_V2C_CORRECT_COUNT);
  assert.equal(
    result.review.secondaryContext.constantHomeBaselineCorrect,
    SEALED_CONSTANT_HOME_BASELINE_CORRECT_COUNT,
  );
  assert.equal(
    result.review.secondaryContext.absoluteCorrectGameAdvantage,
    SEALED_ABSOLUTE_CORRECT_GAME_ADVANTAGE,
  );
  assert.equal(result.review.secondaryContext.secondaryDoesNotOverridePrimary, true);
  assert.equal(result.audit.candidateReviewPerformed, true);
  assert.equal(result.audit.modelCandidateBeforeReview, false);
  assert.equal(result.audit.modelCandidateAfterReview, false);
  assert.equal(result.audit.modelRerun, false);
  assert.equal(result.audit.probabilitiesRecreated, false);
  assert.equal(result.audit.metricsRecomputed, false);
  assert.equal(result.audit.thresholdTuned, false);
  assert.equal(result.audit.calibrationPerformed, false);
  assert.equal(result.audit.postExposureDiagnosticPerformed, false);
  assert.equal(result.audit.holdoutEvaluated, false);
  assert.equal(result.audit.engineChanged, false);
  assert.equal(result.audit.recommendationChanged, false);
  assert.equal(
    result.audit.reviewArtifactSha256,
    hashExternalReplicationCandidateReviewArtifact2025(result.review),
  );
  const replay = reviewV2cModelCandidate2025({
    evaluationSha256: evaluationSha,
    evidence,
    modelCoreHash: MLB_INDEPENDENT_2025_SEALED_V2C_MODEL_CORE_HASH,
    generatedAt,
  });
  assert.deepEqual(replay.review, result.review);
  console.log("CANDIDATE_DECISION_NOT_ADMITTED = PASS");
  console.log("HOLDOUT_REMAINS_SEALED = PASS");
  console.log("EXPOSED_STATE_PRESERVED = PASS");

  assertThrowsCode(
    () =>
      reviewV2cModelCandidate2025({
        evaluationSha256: "0".repeat(64),
        evidence,
        modelCoreHash: MLB_INDEPENDENT_2025_SEALED_V2C_MODEL_CORE_HASH,
      }),
    "EVALUATION_SHA_PIN_MISMATCH",
    "evaluation sha",
  );
  assertThrowsCode(
    () =>
      reviewV2cModelCandidate2025({
        evaluationSha256: evaluationSha,
        evidence,
        modelCoreHash: "0".repeat(64),
      }),
    "MODEL_CORE_HASH_PIN_MISMATCH",
    "modelCoreHash",
  );
  const verdictMismatch = clone(evidence);
  verdictMismatch.directionalVerdict = "DIRECTIONAL_EXTERNAL_REPLICATION_SUPPORTED";
  assertThrowsCode(
    () =>
      reviewV2cModelCandidate2025({
        evaluationSha256: evaluationSha,
        evidence: verdictMismatch,
        modelCoreHash: MLB_INDEPENDENT_2025_SEALED_V2C_MODEL_CORE_HASH,
      }),
    "EXTERNAL_VERDICT_NOT_MIXED",
    "verdict",
  );
  const passCountMismatch = clone(evidence);
  passCountMismatch.directionalChecks.passCount = 3;
  assertThrowsCode(
    () =>
      reviewV2cModelCandidate2025({
        evaluationSha256: evaluationSha,
        evidence: passCountMismatch,
        modelCoreHash: MLB_INDEPENDENT_2025_SEALED_V2C_MODEL_CORE_HASH,
      }),
    "PRIMARY_PASS_COUNT_MISMATCH",
    "passCount",
  );
  const aucMismatch = clone(evidence);
  aucMismatch.directionalChecks.AUC_PASS = false;
  aucMismatch.directionalChecks.passCount = 0;
  assertThrowsCode(
    () =>
      reviewV2cModelCandidate2025({
        evaluationSha256: evaluationSha,
        evidence: aucMismatch,
        modelCoreHash: MLB_INDEPENDENT_2025_SEALED_V2C_MODEL_CORE_HASH,
      }),
    "AUC_PASS_REQUIRED",
    "AUC_PASS",
  );
  const loglossMismatch = clone(evidence);
  loglossMismatch.directionalChecks.LOGLOSS_PASS = true;
  loglossMismatch.directionalChecks.passCount = 2;
  assertThrowsCode(
    () =>
      reviewV2cModelCandidate2025({
        evaluationSha256: evaluationSha,
        evidence: loglossMismatch,
        modelCoreHash: MLB_INDEPENDENT_2025_SEALED_V2C_MODEL_CORE_HASH,
      }),
    "LOGLOSS_PASS_MUST_BE_FALSE",
    "LOGLOSS_PASS",
  );
  const brierMismatch = clone(evidence);
  brierMismatch.directionalChecks.BRIER_PASS = true;
  brierMismatch.directionalChecks.passCount = 2;
  assertThrowsCode(
    () =>
      reviewV2cModelCandidate2025({
        evaluationSha256: evaluationSha,
        evidence: brierMismatch,
        modelCoreHash: MLB_INDEPENDENT_2025_SEALED_V2C_MODEL_CORE_HASH,
      }),
    "BRIER_PASS_MUST_BE_FALSE",
    "BRIER_PASS",
  );
  const candidateTrue = clone(evidence);
  candidateTrue.modelCandidate = true;
  assertThrowsCode(
    () =>
      reviewV2cModelCandidate2025({
        evaluationSha256: evaluationSha,
        evidence: candidateTrue,
        modelCoreHash: MLB_INDEPENDENT_2025_SEALED_V2C_MODEL_CORE_HASH,
      }),
    "CANDIDATE_CANNOT_BECOME_TRUE",
    "evidence.modelCandidate",
  );
  assertThrowsCode(
    () =>
      reviewV2cModelCandidate2025({
        evaluationSha256: evaluationSha,
        evidence,
        modelCoreHash: MLB_INDEPENDENT_2025_SEALED_V2C_MODEL_CORE_HASH,
        requestedCandidate: true,
      }),
    "CANDIDATE_CANNOT_BECOME_TRUE",
    "requestedCandidate",
  );
  assertThrowsCode(
    () =>
      reviewV2cModelCandidate2025({
        evaluationSha256: evaluationSha,
        evidence,
        modelCoreHash: MLB_INDEPENDENT_2025_SEALED_V2C_MODEL_CORE_HASH,
        requestedHoldoutOpen: true,
      }),
    "HOLDOUT_CANNOT_OPEN",
    "requestedHoldoutOpen",
  );
  assertThrowsCode(
    () =>
      reviewV2cModelCandidate2025({
        evaluationSha256: evaluationSha,
        evidence,
        modelCoreHash: MLB_INDEPENDENT_2025_SEALED_V2C_MODEL_CORE_HASH,
        requested2025ModelUnseen: true,
      }),
    "EXPOSED_STATE_CANNOT_REVERT",
    "requested2025ModelUnseen",
  );
  console.log("CANDIDATE_REVIEW_BLOCKS = PASS");

  const reviewLib = readFileSync(REVIEW_LIB, "utf8");
  const reviewScript = readFileSync(REVIEW_SCRIPT, "utf8");
  for (const token of FORBIDDEN_RERUN_TOKENS) {
    assert.equal(reviewLib.includes(token), false, `review lib ${token}`);
    assert.equal(reviewScript.includes(token), false, `review script ${token}`);
  }
  assert.equal(reviewLib.includes("independent-logistic-v2c"), false);
  assert.equal(reviewLib.includes("independent-join-v1"), false);
  assert.equal(reviewLib.includes("independent-label-v1"), false);
  assert.equal(reviewLib.includes("holdoutGamePks"), false);
  assert.equal(reviewLib.includes("JSON.parse"), false);
  assert.equal(reviewLib.includes("readFile"), false);
  assert.equal(reviewScript.includes("independentExternalReplication2025JoinPath"), false);
  assert.equal(reviewScript.includes("evaluateV2cExternalReplication2025"), false);
  assert.equal(reviewScript.includes("writeJsonAtomic(\n    independentExternalReplication2025V2cEvaluationPath"), false);
  assert.equal(reviewScript.includes("independentExternalReplication2025V2cEvaluationPath()"), true);
  for (const token of FORBIDDEN_SLICE_TOKENS) {
    assert.equal(
      reviewLib.includes(`${token} = true`) || reviewLib.includes(`${token}: true`),
      false,
      `review lib performed ${token}`,
    );
  }
  assert.equal(reviewLib.includes("thresholdTuned: false"), true);
  assert.equal(reviewLib.includes("calibrationPerformed: false"), true);
  assert.equal(reviewLib.includes("metricsRecomputed: false"), true);
  console.log("NO_EVALUATION_RERUN = PASS");
  console.log("NO_PROBABILITY_RECREATION = PASS");
  console.log("NO_METRIC_RECOMPUTATION = PASS");
  console.log("NO_THRESHOLD_CALIBRATION = PASS");
  console.log("NO_POST_EXPOSURE_SLICING = PASS");

  assert.equal(
    sha256File(independentExternalReplication2025SourcePath()),
    MLB_INDEPENDENT_2025_SEALED_SOURCE_SHA256,
  );
  assert.equal(
    sha256File(independentExternalReplication2025FeaturePath()),
    MLB_INDEPENDENT_2025_SEALED_FEATURE_SHA256,
  );
  assert.equal(
    sha256File(independentExternalReplication2025LabelPath()),
    MLB_INDEPENDENT_2025_SEALED_LABEL_SHA256,
  );
  assert.equal(
    sha256File(independentExternalReplication2025JoinPath()),
    MLB_INDEPENDENT_2025_SEALED_JOIN_SHA256,
  );
  assert.equal(
    sha256File(independentExternalReplication2025V2cProtocolPath()),
    MLB_INDEPENDENT_2025_SEALED_V2C_PROTOCOL_SHA256,
  );
  assert.equal(
    sha256File(independentExternalReplication2025V2cEvaluationPath()),
    MLB_INDEPENDENT_2025_SEALED_V2C_EVALUATION_SHA256,
  );
  assert.equal(sha256File(independentJoinArtifactPath()), JOIN_SHA_2024);
  assert.equal(sha256File(independentSafeAHistoricalSourcePath()), SOURCE_2024_SHA);
  assert.equal(sha256File(independentSafeAFeatureArtifactPath()), FEATURE_2024_SHA);
  assert.equal(sha256File(independentLabelArtifactPath()), LABEL_2024_SHA);
  const split = JSON.parse(readFileSync(independentSplitArtifactPath(), "utf8")) as {
    holdoutGamePks: number[];
    splitManifestHash: string;
  };
  assert.equal(split.splitManifestHash, SPLIT_MANIFEST_SHA);
  assert.equal(split.holdoutGamePks.length, 483);
  const v1 = JSON.parse(readFileSync(independentLogisticModelPath(), "utf8")) as {
    modelCoreHash: string;
  };
  const v2a = JSON.parse(readFileSync(independentLogisticV2aModelPath(), "utf8")) as {
    modelCoreHash: string;
  };
  const v2b = JSON.parse(readFileSync(independentLogisticV2bModelPath(), "utf8")) as {
    modelCoreHash: string;
  };
  const v2c = JSON.parse(readFileSync(independentLogisticV2cModelPath(), "utf8")) as {
    modelCoreHash: string;
    holdoutEvaluated: boolean;
    modelCandidate: boolean;
  };
  assert.equal(v1.modelCoreHash, V1_CORE);
  assert.equal(v2a.modelCoreHash, V2A_CORE);
  assert.equal(v2b.modelCoreHash, V2B_CORE);
  assert.equal(v2c.modelCoreHash, MLB_INDEPENDENT_2025_SEALED_V2C_MODEL_CORE_HASH);
  assert.equal(v2c.holdoutEvaluated, false);
  assert.equal(v2c.modelCandidate, false);
  console.log("ALL_SEALED_INPUTS_UNCHANGED = PASS");

  if (existsSync(independentExternalReplication2025V2cCandidateReviewPath())) {
    const written = JSON.parse(
      readFileSync(independentExternalReplication2025V2cCandidateReviewPath(), "utf8"),
    ) as typeof result.review;
    const writtenAudit = JSON.parse(
      readFileSync(independentExternalReplication2025V2cCandidateReviewAuditPath(), "utf8"),
    ) as { reviewArtifactSha256: string; modelCandidateAfterReview: boolean };
    assert.equal(written.candidate, false);
    assert.equal(written.candidateDecision, "NOT_ADMITTED");
    assert.equal(written.holdoutOpen, false);
    assert.equal(written["2025ModelUnseen"], false);
    assert.equal(writtenAudit.modelCandidateAfterReview, false);
    assert.equal(
      sha256File(independentExternalReplication2025V2cCandidateReviewPath()),
      hashExternalReplicationCandidateReviewArtifact2025(written),
    );
    assert.equal(
      writtenAudit.reviewArtifactSha256,
      hashExternalReplicationCandidateReviewArtifact2025(written),
    );
    console.log("WRITTEN_REVIEW_ARTIFACT_PIN = PASS");
  }

  console.log("ENGINE_REMAINS_PROHIBITED = PASS");
  console.log("test:mlb-independent-external-replication-v2c-candidate-review-2025 PASS");
}

main();

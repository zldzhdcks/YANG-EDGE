/**
 * Post-v2-C research-direction review tests.
 * Governance / design only. Must not inspect 2025 evaluation rows.
 *
 *   npm run test:mlb-independent-post-v2c-research-direction-v1
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
  MLB_INDEPENDENT_2025_SEALED_FEATURE_SHA256,
  MLB_INDEPENDENT_2025_SEALED_JOIN_SHA256,
  MLB_INDEPENDENT_2025_SEALED_LABEL_SHA256,
  MLB_INDEPENDENT_2025_SEALED_SOURCE_SHA256,
  MLB_INDEPENDENT_2025_SEALED_V2C_EVALUATION_SHA256,
  MLB_INDEPENDENT_2025_SEALED_V2C_MODEL_ARTIFACT_SHA256,
  MLB_INDEPENDENT_2025_SEALED_V2C_MODEL_CORE_HASH,
  MLB_INDEPENDENT_2025_SEALED_V2C_PROTOCOL_SHA256,
  V2C_CANDIDATE_REVIEW_DECISION,
  V2C_CANDIDATE_SUPPORTING_REASON,
  hashExternalReplicationCandidateReviewArtifact2025,
  independentExternalReplication2025FeaturePath,
  independentExternalReplication2025JoinPath,
  independentExternalReplication2025LabelPath,
  independentExternalReplication2025SourcePath,
  independentExternalReplication2025V2cCandidateReviewPath,
  independentExternalReplication2025V2cEvaluationPath,
  independentExternalReplication2025V2cProtocolPath,
  independentSealedV2cModelArtifactPath,
  type FrozenV2cModelCandidateReview2025,
} from "../src/lib/mlb/independent-external-replication-v1";
import {
  CURRENT_PROBABILITY_MODEL_QUALITY,
  MLB_INDEPENDENT_2025_SEALED_V2C_CANDIDATE_REVIEW_SHA256,
  NEXT_SOURCE_FOUNDATION_CANDIDATE,
  RECOMMENDED_STRATEGY,
  hashPostV2cResearchDirectionReviewV1,
  independentPostV2cResearchDirectionAuditPath,
  independentPostV2cResearchDirectionReviewPath,
  reviewPostV2cResearchDirectionV1,
} from "../src/lib/mlb/independent-research-direction-v1";

const ROOT = process.cwd();
const REVIEW_LIB = path.join(
  ROOT,
  "src/lib/mlb/independent-research-direction-v1/post-v2c-review.ts",
);
const REVIEW_SCRIPT = path.join(
  ROOT,
  "scripts/review-mlb-independent-post-v2c-research-direction-v1.ts",
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
const FORBIDDEN_TOKENS = [
  "evaluateV2cExternalReplication2025",
  "trainIndependentLogisticHeadToHeadAblationV2c",
  "fitTrainPreprocessorV2c",
  "fitFullBatchLogisticV1",
  "JSON.parse(evaluationBuf",
];

function sha256File(filePath: string): string {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
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

function main(): void {
  const evaluationSha = sha256File(independentExternalReplication2025V2cEvaluationPath());
  assert.equal(evaluationSha, MLB_INDEPENDENT_2025_SEALED_V2C_EVALUATION_SHA256);
  const candidateReviewSha = sha256File(
    independentExternalReplication2025V2cCandidateReviewPath(),
  );
  assert.equal(
    candidateReviewSha,
    MLB_INDEPENDENT_2025_SEALED_V2C_CANDIDATE_REVIEW_SHA256,
  );
  const candidateReview = JSON.parse(
    readFileSync(independentExternalReplication2025V2cCandidateReviewPath(), "utf8"),
  ) as FrozenV2cModelCandidateReview2025;
  assert.equal(
    hashExternalReplicationCandidateReviewArtifact2025(candidateReview),
    candidateReviewSha,
  );
  assert.equal(candidateReview.candidateDecision, "NOT_ADMITTED");
  assert.equal(candidateReview.externalVerdict, "MIXED_EXTERNAL_REPLICATION");
  assert.equal(candidateReview.candidate, false);
  console.log("SEALED_CANDIDATE_REVIEW_AND_EVALUATION_PINS = PASS");

  const generatedAt = "2026-09-03T03:35:00.000Z";
  const result = reviewPostV2cResearchDirectionV1({
    evaluationSha256: evaluationSha,
    candidateReviewSha256: candidateReviewSha,
    candidateDecision: V2C_CANDIDATE_REVIEW_DECISION,
    externalVerdict: V2C_CANDIDATE_SUPPORTING_REASON,
    generatedAt,
  });
  assert.equal(result.review.v2cCycleStatus, "CLOSED");
  assert.equal(result.review.v2cCandidateDecision, "NOT_ADMITTED");
  assert.equal(result.review.externalReplicationVerdict, "MIXED_EXTERNAL_REPLICATION");
  assert.equal(result.review.replicatedRankingSignal, true);
  assert.equal(result.review.replicatedProbabilityQuality, false);
  assert.equal(result.review.rankingSignalWording, "weak");
  assert.equal(result.review.rankingSignalProductionGrade, false);
  assert.equal(result.review.rankingSignalSufficientAloneForCandidate, false);
  assert.equal(
    result.review.currentProbabilityModelQuality,
    CURRENT_PROBABILITY_MODEL_QUALITY,
  );
  assert.equal(result.review.immediateV2d, false);
  assert.equal(result.review.calibrateV2cOn2025, false);
  assert.equal(result.review.immediateXgboostRandomForestNn, false);
  assert.equal(result.review.newModelTrainingAllowedNow, false);
  assert.equal(result.review["2025RowLevelDiagnosticAllowed"], false);
  assert.equal(result.review.holdoutEvaluated, false);
  assert.equal(result.review.holdoutOpen, false);
  assert.equal(result.review.nextSourceFoundationCandidate, NEXT_SOURCE_FOUNDATION_CANDIDATE);
  assert.equal(result.review.nextSourceFoundationStatus, "PROPOSED_NOT_STARTED");
  assert.equal(result.review.recommendedStrategy, RECOMMENDED_STRATEGY);
  assert.equal(result.review.engineAdmission, "PROHIBITED");
  assert.equal(result.review.doNotDefaultToV2dFeatureDeletion, true);
  assert.equal(result.review.noModelBeforePhaseF, true);
  assert.equal(result.audit.modelTrained, false);
  assert.equal(result.audit.modelEvaluated, false);
  assert.equal(result.audit["2025RowsInspected"], false);
  assert.equal(result.audit.holdoutEvaluated, false);
  assert.equal(result.audit.networkUsed, false);
  assert.equal(
    result.audit.reviewArtifactSha256,
    hashPostV2cResearchDirectionReviewV1(result.review),
  );
  const replay = reviewPostV2cResearchDirectionV1({
    evaluationSha256: evaluationSha,
    candidateReviewSha256: candidateReviewSha,
    candidateDecision: V2C_CANDIDATE_REVIEW_DECISION,
    externalVerdict: V2C_CANDIDATE_SUPPORTING_REASON,
    generatedAt,
  });
  assert.deepEqual(replay.review, result.review);
  console.log("V2C_CYCLE_CLOSED = PASS");
  console.log("CANDIDATE_NOT_ADMITTED = PASS");
  console.log("MIXED_EXTERNAL_REPLICATION = PASS");
  console.log("RECOMMENDED_STRATEGY_F = PASS");

  assertThrowsCode(
    () =>
      reviewPostV2cResearchDirectionV1({
        evaluationSha256: "0".repeat(64),
        candidateReviewSha256: candidateReviewSha,
        candidateDecision: V2C_CANDIDATE_REVIEW_DECISION,
        externalVerdict: V2C_CANDIDATE_SUPPORTING_REASON,
      }),
    "EVALUATION_SHA_PIN_MISMATCH",
    "evaluation sha",
  );
  assertThrowsCode(
    () =>
      reviewPostV2cResearchDirectionV1({
        evaluationSha256: evaluationSha,
        candidateReviewSha256: "0".repeat(64),
        candidateDecision: V2C_CANDIDATE_REVIEW_DECISION,
        externalVerdict: V2C_CANDIDATE_SUPPORTING_REASON,
      }),
    "CANDIDATE_REVIEW_SHA_PIN_MISMATCH",
    "candidate review sha",
  );
  assertThrowsCode(
    () =>
      reviewPostV2cResearchDirectionV1({
        evaluationSha256: evaluationSha,
        candidateReviewSha256: candidateReviewSha,
        candidateDecision: "ADMITTED",
        externalVerdict: V2C_CANDIDATE_SUPPORTING_REASON,
      }),
    "CANDIDATE_DECISION_NOT_ADMITTED_REQUIRED",
    "candidate decision",
  );
  assertThrowsCode(
    () =>
      reviewPostV2cResearchDirectionV1({
        evaluationSha256: evaluationSha,
        candidateReviewSha256: candidateReviewSha,
        candidateDecision: V2C_CANDIDATE_REVIEW_DECISION,
        externalVerdict: "DIRECTIONAL_EXTERNAL_REPLICATION_SUPPORTED",
      }),
    "EXTERNAL_VERDICT_NOT_MIXED",
    "verdict",
  );
  assertThrowsCode(
    () =>
      reviewPostV2cResearchDirectionV1({
        evaluationSha256: evaluationSha,
        candidateReviewSha256: candidateReviewSha,
        candidateDecision: V2C_CANDIDATE_REVIEW_DECISION,
        externalVerdict: V2C_CANDIDATE_SUPPORTING_REASON,
        requestedImmediateV2d: true,
      }),
    "IMMEDIATE_V2D_PROHIBITED",
    "v2-D",
  );
  assertThrowsCode(
    () =>
      reviewPostV2cResearchDirectionV1({
        evaluationSha256: evaluationSha,
        candidateReviewSha256: candidateReviewSha,
        candidateDecision: V2C_CANDIDATE_REVIEW_DECISION,
        externalVerdict: V2C_CANDIDATE_SUPPORTING_REASON,
        requestedCalibrate2025: true,
      }),
    "CALIBRATE_V2C_ON_2025_PROHIBITED",
    "calibrate",
  );
  assertThrowsCode(
    () =>
      reviewPostV2cResearchDirectionV1({
        evaluationSha256: evaluationSha,
        candidateReviewSha256: candidateReviewSha,
        candidateDecision: V2C_CANDIDATE_REVIEW_DECISION,
        externalVerdict: V2C_CANDIDATE_SUPPORTING_REASON,
        requestedNewModelTraining: true,
      }),
    "NEW_MODEL_TRAINING_PROHIBITED",
    "new model",
  );
  assertThrowsCode(
    () =>
      reviewPostV2cResearchDirectionV1({
        evaluationSha256: evaluationSha,
        candidateReviewSha256: candidateReviewSha,
        candidateDecision: V2C_CANDIDATE_REVIEW_DECISION,
        externalVerdict: V2C_CANDIDATE_SUPPORTING_REASON,
        requested2025RowInspection: true,
      }),
    "2025_ROW_LEVEL_INSPECTION_PROHIBITED",
    "2025 rows",
  );
  assertThrowsCode(
    () =>
      reviewPostV2cResearchDirectionV1({
        evaluationSha256: evaluationSha,
        candidateReviewSha256: candidateReviewSha,
        candidateDecision: V2C_CANDIDATE_REVIEW_DECISION,
        externalVerdict: V2C_CANDIDATE_SUPPORTING_REASON,
        requestedHoldoutOpen: true,
      }),
    "HOLDOUT_CANNOT_OPEN",
    "Holdout",
  );
  console.log("DIRECTION_REVIEW_BLOCKS = PASS");

  const reviewLib = readFileSync(REVIEW_LIB, "utf8");
  const reviewScript = readFileSync(REVIEW_SCRIPT, "utf8");
  for (const token of FORBIDDEN_TOKENS) {
    assert.equal(reviewLib.includes(token), false, `review lib ${token}`);
    assert.equal(reviewScript.includes(token), false, `review script ${token}`);
  }
  assert.equal(reviewLib.includes("holdoutGamePks"), false);
  assert.equal(reviewLib.includes("independent-logistic-v2c"), false);
  assert.equal(
    reviewLib.includes("evaluations/2025-v2c-external-replication-evaluation"),
    false,
  );
  assert.equal(reviewScript.includes("JSON.parse(evaluationBuf"), false);
  assert.equal(reviewScript.includes("sha256Bytes(evaluationBuf)"), true);
  assert.equal(reviewScript.includes(".rows"), false);
  assert.equal(reviewLib.includes(".rows"), false);
  console.log("NO_2025_ROW_INSPECTION = PASS");
  console.log("NO_NEW_MODEL = PASS");

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
  assert.equal(
    sha256File(independentSealedV2cModelArtifactPath()),
    MLB_INDEPENDENT_2025_SEALED_V2C_MODEL_ARTIFACT_SHA256,
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
  console.log("HOLDOUT_REMAINS_SEALED = PASS");
  console.log("ENGINE_REMAINS_PROHIBITED = PASS");

  if (existsSync(independentPostV2cResearchDirectionReviewPath())) {
    const written = JSON.parse(
      readFileSync(independentPostV2cResearchDirectionReviewPath(), "utf8"),
    ) as typeof result.review;
    const writtenAudit = JSON.parse(
      readFileSync(independentPostV2cResearchDirectionAuditPath(), "utf8"),
    ) as { reviewArtifactSha256: string; modelTrained: boolean };
    assert.equal(written.v2cCycleStatus, "CLOSED");
    assert.equal(written.newModelTrainingAllowedNow, false);
    assert.equal(writtenAudit.modelTrained, false);
    assert.equal(
      sha256File(independentPostV2cResearchDirectionReviewPath()),
      hashPostV2cResearchDirectionReviewV1(written),
    );
    assert.equal(
      writtenAudit.reviewArtifactSha256,
      hashPostV2cResearchDirectionReviewV1(written),
    );
    console.log("WRITTEN_DIRECTION_REVIEW_ARTIFACT_PIN = PASS");
  }

  console.log("test:mlb-independent-post-v2c-research-direction-v1 PASS");
}

main();

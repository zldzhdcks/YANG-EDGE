/**
 * Frozen v2-C MODEL_CANDIDATE review for sealed 2025 external replication.
 * LOCAL ONLY. Governance decision. Does not rerun v2-C or rewrite evaluation.
 *
 *   npm run review:mlb-independent-external-replication-v2c-candidate-2025
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  MLB_INDEPENDENT_2025_SEALED_V2C_EVALUATION_SHA256,
  MLB_INDEPENDENT_2025_SEALED_V2C_MODEL_ARTIFACT_SHA256,
  MLB_INDEPENDENT_2025_SEALED_V2C_MODEL_CORE_HASH,
  hashExternalReplicationCandidateReviewArtifact2025,
  independentExternalReplication2025V2cCandidateReviewAuditPath,
  independentExternalReplication2025V2cCandidateReviewAuditRel,
  independentExternalReplication2025V2cCandidateReviewPath,
  independentExternalReplication2025V2cCandidateReviewRel,
  independentExternalReplication2025V2cEvaluationPath,
  independentExternalReplication2025V2cEvaluationRel,
  independentSealedV2cModelArtifactPath,
  reviewV2cModelCandidate2025,
  serializeExternalReplicationJson,
  type SealedV2cExternalReplicationEvidence2025,
} from "../src/lib/mlb/independent-external-replication-v1";

const REVIEW_GENERATED_AT = "2026-09-03T03:12:00.000Z";

async function writeJsonAtomic(filePath: string, value: unknown): Promise<void> {
  const tmp = `${filePath}.tmp`;
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(tmp, serializeExternalReplicationJson(value), "utf8");
  await rename(tmp, filePath);
}

function sha256Bytes(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

function evidenceFromSealedEvaluation(
  parsed: Record<string, unknown>,
): SealedV2cExternalReplicationEvidence2025 {
  const primary = parsed.primaryMetrics as SealedV2cExternalReplicationEvidence2025["primaryMetrics"];
  const baseline =
    parsed.constantBaselineMetrics as SealedV2cExternalReplicationEvidence2025["constantBaselineMetrics"];
  const checks =
    parsed.directionalChecks as SealedV2cExternalReplicationEvidence2025["directionalChecks"];
  const secondary =
    parsed.secondaryMetrics as SealedV2cExternalReplicationEvidence2025["secondaryMetrics"];
  return {
    sampleCount: parsed.sampleCount as number,
    modelCandidate: parsed.modelCandidate as boolean,
    v2cModelCoreHash: parsed.v2cModelCoreHash as string,
    engineAdmission: parsed.engineAdmission as string,
    primaryMetrics: {
      rocAuc: primary.rocAuc,
      logLoss: primary.logLoss,
      brierScore: primary.brierScore,
    },
    constantBaselineMetrics: {
      probability: baseline.probability,
      rocAuc: baseline.rocAuc,
      accuracy: baseline.accuracy,
      logLoss: baseline.logLoss,
      brierScore: baseline.brierScore,
    },
    directionalChecks: {
      AUC_PASS: checks.AUC_PASS,
      LOGLOSS_PASS: checks.LOGLOSS_PASS,
      BRIER_PASS: checks.BRIER_PASS,
      passCount: checks.passCount,
    },
    directionalVerdict: parsed.directionalVerdict as string,
    secondaryMetrics: {
      accuracy: secondary.accuracy,
      TP: secondary.TP,
      TN: secondary.TN,
      FP: secondary.FP,
      FN: secondary.FN,
    },
  };
}

async function main(): Promise<void> {
  console.log("=== Review MLB Independent v2-C MODEL_CANDIDATE 2025 ===");
  const evaluationPath = independentExternalReplication2025V2cEvaluationPath();
  const evaluationBuf = await readFile(evaluationPath);
  const evaluationSha256 = sha256Bytes(evaluationBuf);
  if (evaluationSha256 !== MLB_INDEPENDENT_2025_SEALED_V2C_EVALUATION_SHA256) {
    throw new Error(
      `EVALUATION_SHA_PIN_MISMATCH expected ${MLB_INDEPENDENT_2025_SEALED_V2C_EVALUATION_SHA256} got ${evaluationSha256}`,
    );
  }
  console.log("EVALUATION_SHA_PIN_MATCH=PASS");

  const parsed = JSON.parse(evaluationBuf.toString("utf8")) as Record<string, unknown>;
  const evidence = evidenceFromSealedEvaluation(parsed);

  const modelBuf = await readFile(independentSealedV2cModelArtifactPath());
  const modelArtifactSha256 = sha256Bytes(modelBuf);
  if (modelArtifactSha256 !== MLB_INDEPENDENT_2025_SEALED_V2C_MODEL_ARTIFACT_SHA256) {
    throw new Error(
      `MODEL_ARTIFACT_SHA_PIN_MISMATCH expected ${MLB_INDEPENDENT_2025_SEALED_V2C_MODEL_ARTIFACT_SHA256} got ${modelArtifactSha256}`,
    );
  }
  const model = JSON.parse(modelBuf.toString("utf8")) as { modelCoreHash: string };
  if (model.modelCoreHash !== MLB_INDEPENDENT_2025_SEALED_V2C_MODEL_CORE_HASH) {
    throw new Error(
      `MODEL_CORE_HASH_PIN_MISMATCH expected ${MLB_INDEPENDENT_2025_SEALED_V2C_MODEL_CORE_HASH} got ${model.modelCoreHash}`,
    );
  }
  console.log("MODEL_CORE_HASH_UNCHANGED=PASS");

  const result = reviewV2cModelCandidate2025({
    evaluationSha256,
    evidence,
    modelCoreHash: model.modelCoreHash,
    generatedAt: REVIEW_GENERATED_AT,
  });
  const replay = reviewV2cModelCandidate2025({
    evaluationSha256,
    evidence,
    modelCoreHash: model.modelCoreHash,
    generatedAt: REVIEW_GENERATED_AT,
  });
  if (JSON.stringify(result.review) !== JSON.stringify(replay.review)) {
    throw new Error("DETERMINISTIC_REVIEW_REPLAY_IDENTICAL=FAIL");
  }
  console.log("DETERMINISTIC_REVIEW_REPLAY_IDENTICAL=PASS");

  await writeJsonAtomic(
    independentExternalReplication2025V2cCandidateReviewPath(),
    result.review,
  );
  await writeJsonAtomic(
    independentExternalReplication2025V2cCandidateReviewAuditPath(),
    result.audit,
  );
  const writtenSha = hashExternalReplicationCandidateReviewArtifact2025(result.review);
  if (writtenSha !== result.audit.reviewArtifactSha256) {
    throw new Error("REVIEW_SHA_MISMATCH");
  }

  const postWriteSha = sha256Bytes(await readFile(evaluationPath));
  if (postWriteSha !== MLB_INDEPENDENT_2025_SEALED_V2C_EVALUATION_SHA256) {
    throw new Error("EVALUATION_ARTIFACT_MUTATED");
  }

  console.log(`evaluationRel=${independentExternalReplication2025V2cEvaluationRel()}`);
  console.log(`review artifact=${independentExternalReplication2025V2cCandidateReviewRel()}`);
  console.log(`audit artifact=${independentExternalReplication2025V2cCandidateReviewAuditRel()}`);
  console.log(`reviewArtifactSha256=${result.audit.reviewArtifactSha256}`);
  console.log(`externalVerdict=${result.review.externalVerdict}`);
  console.log(`candidateDecision=${result.review.candidateDecision}`);
  console.log("V2C_MODEL_CANDIDATE=NO");
  console.log("V2C_CANDIDATE_REVIEW_DECISION=NOT_ADMITTED");
  console.log(`primaryReason=${result.review.primaryReason}`);
  console.log("OPEN_2024_HOLDOUT=NO");
  console.log("2024_HOLDOUT_EVALUATED=NO");
  console.log("2025_MODEL_UNSEEN=NO");
  console.log("2025_EXTERNAL_REPLICATION_STATE=EXTERNAL_REPLICATION_EXPOSED");
  console.log("POST_EXPOSURE_DIAGNOSTIC_PERFORMED=NO");
  console.log("ENGINE_ADMISSION=PROHIBITED");
  console.log("ENGINE_CHANGED=NO");
  console.log("RECOMMENDATION_CHANGED=NO");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.stack ?? e.message : e);
  process.exitCode = 1;
});

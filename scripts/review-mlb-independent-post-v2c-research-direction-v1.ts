/**
 * Post-v2-C research-direction review. Governance / design only.
 * Hashes sealed 2025 evaluation bytes. Does not parse evaluation rows.
 *
 *   npm run review:mlb-independent-post-v2c-research-direction-v1
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  MLB_INDEPENDENT_2025_SEALED_V2C_EVALUATION_SHA256,
  hashExternalReplicationCandidateReviewArtifact2025,
  independentExternalReplication2025V2cCandidateReviewPath,
  independentExternalReplication2025V2cEvaluationPath,
  type FrozenV2cModelCandidateReview2025,
} from "../src/lib/mlb/independent-external-replication-v1";
import {
  MLB_INDEPENDENT_2025_SEALED_V2C_CANDIDATE_REVIEW_SHA256,
  hashPostV2cResearchDirectionReviewV1,
  independentPostV2cResearchDirectionAuditPath,
  independentPostV2cResearchDirectionAuditRel,
  independentPostV2cResearchDirectionReviewPath,
  independentPostV2cResearchDirectionReviewRel,
  reviewPostV2cResearchDirectionV1,
  serializeResearchDirectionJson,
} from "../src/lib/mlb/independent-research-direction-v1";

const REVIEW_GENERATED_AT = "2026-09-03T03:35:00.000Z";

async function writeJsonAtomic(filePath: string, value: unknown): Promise<void> {
  const tmp = `${filePath}.tmp`;
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(tmp, serializeResearchDirectionJson(value), "utf8");
  await rename(tmp, filePath);
}

function sha256Bytes(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

async function main(): Promise<void> {
  console.log("=== Post-v2-C Research Direction Review v1 ===");
  const evaluationBuf = await readFile(
    independentExternalReplication2025V2cEvaluationPath(),
  );
  const evaluationSha256 = sha256Bytes(evaluationBuf);
  if (evaluationSha256 !== MLB_INDEPENDENT_2025_SEALED_V2C_EVALUATION_SHA256) {
    throw new Error(
      `EVALUATION_SHA_PIN_MISMATCH expected ${MLB_INDEPENDENT_2025_SEALED_V2C_EVALUATION_SHA256} got ${evaluationSha256}`,
    );
  }
  console.log("EVALUATION_SHA_PIN_MATCH=PASS");
  console.log("2025_ROWS_INSPECTED=NO");

  const candidateReviewBuf = await readFile(
    independentExternalReplication2025V2cCandidateReviewPath(),
  );
  const candidateReviewSha256 = sha256Bytes(candidateReviewBuf);
  if (candidateReviewSha256 !== MLB_INDEPENDENT_2025_SEALED_V2C_CANDIDATE_REVIEW_SHA256) {
    throw new Error(
      `CANDIDATE_REVIEW_SHA_PIN_MISMATCH expected ${MLB_INDEPENDENT_2025_SEALED_V2C_CANDIDATE_REVIEW_SHA256} got ${candidateReviewSha256}`,
    );
  }
  const candidateReview = JSON.parse(
    candidateReviewBuf.toString("utf8"),
  ) as FrozenV2cModelCandidateReview2025;
  if (
    hashExternalReplicationCandidateReviewArtifact2025(candidateReview) !==
    candidateReviewSha256
  ) {
    throw new Error("CANDIDATE_REVIEW_SHA_REPLAY_MISMATCH");
  }
  console.log("CANDIDATE_REVIEW_SHA_PIN_MATCH=PASS");

  const result = reviewPostV2cResearchDirectionV1({
    evaluationSha256,
    candidateReviewSha256,
    candidateDecision: candidateReview.candidateDecision,
    externalVerdict: candidateReview.externalVerdict,
    generatedAt: REVIEW_GENERATED_AT,
  });
  const replay = reviewPostV2cResearchDirectionV1({
    evaluationSha256,
    candidateReviewSha256,
    candidateDecision: candidateReview.candidateDecision,
    externalVerdict: candidateReview.externalVerdict,
    generatedAt: REVIEW_GENERATED_AT,
  });
  if (JSON.stringify(result.review) !== JSON.stringify(replay.review)) {
    throw new Error("DETERMINISTIC_DIRECTION_REVIEW_REPLAY_IDENTICAL=FAIL");
  }
  console.log("DETERMINISTIC_DIRECTION_REVIEW_REPLAY_IDENTICAL=PASS");

  await writeJsonAtomic(
    independentPostV2cResearchDirectionReviewPath(),
    result.review,
  );
  await writeJsonAtomic(
    independentPostV2cResearchDirectionAuditPath(),
    result.audit,
  );
  const writtenSha = hashPostV2cResearchDirectionReviewV1(result.review);
  if (writtenSha !== result.audit.reviewArtifactSha256) {
    throw new Error("DIRECTION_REVIEW_SHA_MISMATCH");
  }
  const postWriteEvalSha = sha256Bytes(
    await readFile(independentExternalReplication2025V2cEvaluationPath()),
  );
  if (postWriteEvalSha !== MLB_INDEPENDENT_2025_SEALED_V2C_EVALUATION_SHA256) {
    throw new Error("EVALUATION_ARTIFACT_MUTATED");
  }

  console.log(`review artifact=${independentPostV2cResearchDirectionReviewRel()}`);
  console.log(`audit artifact=${independentPostV2cResearchDirectionAuditRel()}`);
  console.log(`reviewArtifactSha256=${result.audit.reviewArtifactSha256}`);
  console.log(`v2cCycleStatus=${result.review.v2cCycleStatus}`);
  console.log(`v2cCandidateDecision=${result.review.v2cCandidateDecision}`);
  console.log(`externalReplicationVerdict=${result.review.externalReplicationVerdict}`);
  console.log(`recommendedStrategy=${result.review.recommendedStrategy}`);
  console.log(`nextSourceFoundationCandidate=${result.review.nextSourceFoundationCandidate}`);
  console.log("NEW_MODEL_TRAINING_ALLOWED_NOW=NO");
  console.log("IMMEDIATE_V2D=NO");
  console.log("CALIBRATE_v2C_ON_2025=NO");
  console.log("2025_ROW_LEVEL_DIAGNOSTIC_ALLOWED=NO");
  console.log("OPEN_2024_HOLDOUT=NO");
  console.log("ENGINE_ADMISSION=PROHIBITED");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.stack ?? e.message : e);
  process.exitCode = 1;
});

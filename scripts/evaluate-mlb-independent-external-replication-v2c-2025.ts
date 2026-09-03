/**
 * One-time frozen v2-C external replication evaluation for 2025.
 * LOCAL ONLY. Protocol/model/join SHA gates before Join parse.
 *
 *   npm run evaluate:mlb-independent-external-replication-v2c-2025
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  MLB_INDEPENDENT_2025_SEALED_JOIN_SHA256,
  MLB_INDEPENDENT_2025_SEALED_V2C_MODEL_ARTIFACT_SHA256,
  MLB_INDEPENDENT_2025_SEALED_V2C_MODEL_CORE_HASH,
  MLB_INDEPENDENT_2025_SEALED_V2C_PROTOCOL_SHA256,
  assertPreOpenV2cExternalReplicationGates2025,
  evaluateV2cExternalReplication2025,
  hashExternalReplicationEvaluationArtifact2025,
  independentExternalReplication2025JoinPath,
  independentExternalReplication2025JoinRel,
  independentExternalReplication2025V2cEvaluationAuditPath,
  independentExternalReplication2025V2cEvaluationAuditRel,
  independentExternalReplication2025V2cEvaluationPath,
  independentExternalReplication2025V2cEvaluationRel,
  independentExternalReplication2025V2cProtocolPath,
  independentSealedV2cModelArtifactPath,
  serializeExternalReplicationJson,
  type ExternalReplicationJoinArtifact2025,
  type FrozenV2cExternalReplicationProtocol2025,
  type FrozenV2cModelProtocolView,
} from "../src/lib/mlb/independent-external-replication-v1";

async function writeJsonAtomic(filePath: string, value: unknown): Promise<void> {
  const tmp = `${filePath}.tmp`;
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(tmp, serializeExternalReplicationJson(value), "utf8");
  await rename(tmp, filePath);
}

function sha256Bytes(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

function replayComparable(
  evaluation: { generatedAt?: string; [key: string]: unknown },
): string {
  const copy = { ...evaluation };
  delete copy.generatedAt;
  return JSON.stringify(copy);
}

async function main(): Promise<void> {
  console.log("=== Evaluate MLB Independent External Replication v2-C 2025 ===");
  const protocolBuf = await readFile(independentExternalReplication2025V2cProtocolPath());
  const protocolSha256 = sha256Bytes(protocolBuf);
  if (protocolSha256 !== MLB_INDEPENDENT_2025_SEALED_V2C_PROTOCOL_SHA256) {
    throw new Error(
      `PROTOCOL_SHA_PIN_MISMATCH expected ${MLB_INDEPENDENT_2025_SEALED_V2C_PROTOCOL_SHA256} got ${protocolSha256}`,
    );
  }
  const protocol = JSON.parse(
    protocolBuf.toString("utf8"),
  ) as FrozenV2cExternalReplicationProtocol2025;
  console.log("PROTOCOL_SHA_PIN_MATCH=PASS");

  const joinBuf = await readFile(independentExternalReplication2025JoinPath());
  const joinSha256 = sha256Bytes(joinBuf);
  if (joinSha256 !== MLB_INDEPENDENT_2025_SEALED_JOIN_SHA256) {
    throw new Error(
      `JOIN_SHA_PIN_MISMATCH expected ${MLB_INDEPENDENT_2025_SEALED_JOIN_SHA256} got ${joinSha256}`,
    );
  }
  console.log("JOIN_SHA_PIN_MATCH=PASS");
  console.log("JOIN_ROWS_NOT_PARSED_YET=YES");

  const modelBuf = await readFile(independentSealedV2cModelArtifactPath());
  const modelArtifactSha256 = sha256Bytes(modelBuf);
  if (modelArtifactSha256 !== MLB_INDEPENDENT_2025_SEALED_V2C_MODEL_ARTIFACT_SHA256) {
    throw new Error(
      `MODEL_ARTIFACT_SHA_PIN_MISMATCH expected ${MLB_INDEPENDENT_2025_SEALED_V2C_MODEL_ARTIFACT_SHA256} got ${modelArtifactSha256}`,
    );
  }
  const model = JSON.parse(modelBuf.toString("utf8")) as FrozenV2cModelProtocolView;
  if (model.modelCoreHash !== MLB_INDEPENDENT_2025_SEALED_V2C_MODEL_CORE_HASH) {
    throw new Error(
      `MODEL_CORE_HASH_PIN_MISMATCH expected ${MLB_INDEPENDENT_2025_SEALED_V2C_MODEL_CORE_HASH} got ${String(model.modelCoreHash)}`,
    );
  }
  console.log("MODEL_ARTIFACT_SHA_PIN_MATCH=PASS");
  console.log("MODEL_CORE_HASH_PIN_MATCH=PASS");

  assertPreOpenV2cExternalReplicationGates2025({
    protocolSha256,
    joinSha256,
    modelArtifactSha256,
    protocol,
    model,
  });
  console.log("PRE_OPEN_MODEL_CONTRACT=PASS");
  console.log("2025_MODEL_UNSEEN_BEFORE_PARSE=YES");

  const join = JSON.parse(joinBuf.toString("utf8")) as ExternalReplicationJoinArtifact2025;
  console.log("2025_JOIN_PARSED=YES");
  console.log("2025_MODEL_UNSEEN_AFTER_PARSE=NO");
  console.log("2025_EXTERNAL_REPLICATION_STATE=EXTERNAL_REPLICATION_EXPOSED");

  const result = evaluateV2cExternalReplication2025({
    protocolSha256,
    joinSha256,
    modelArtifactSha256,
    protocol,
    model,
    join,
    sealed: true,
  });

  const replay = evaluateV2cExternalReplication2025({
    protocolSha256,
    joinSha256,
    modelArtifactSha256,
    protocol,
    model,
    join,
    sealed: true,
    generatedAt: result.evaluation.generatedAt,
  });
  if (
    replayComparable(result.evaluation) !== replayComparable(replay.evaluation) ||
    JSON.stringify(result.evaluation.rows) !== JSON.stringify(replay.evaluation.rows) ||
    JSON.stringify(result.evaluation.primaryMetrics) !==
      JSON.stringify(replay.evaluation.primaryMetrics)
  ) {
    throw new Error("DETERMINISTIC_REPLAY_IDENTICAL=FAIL");
  }
  console.log("DETERMINISTIC_REPLAY_IDENTICAL=PASS");

  await writeJsonAtomic(
    independentExternalReplication2025V2cEvaluationPath(),
    result.evaluation,
  );
  await writeJsonAtomic(
    independentExternalReplication2025V2cEvaluationAuditPath(),
    result.audit,
  );
  const writtenSha = hashExternalReplicationEvaluationArtifact2025(result.evaluation);
  if (writtenSha !== result.audit.evaluationArtifactSha256) {
    throw new Error("EVALUATION_SHA_MISMATCH");
  }

  const p = result.evaluation.primaryMetrics;
  const b = result.evaluation.constantBaselineMetrics;
  const s = result.evaluation.secondaryMetrics;
  const d = result.evaluation.directionalChecks;
  console.log(`sampleCount=${result.evaluation.sampleCount}`);
  console.log(`excludedCount=${result.evaluation.excludedCount}`);
  console.log(`ROC_AUC_2025=${p.rocAuc}`);
  console.log(`LOGLOSS_2025=${p.logLoss}`);
  console.log(`BRIER_2025=${p.brierScore}`);
  console.log(`CONSTANT_BASELINE_AUC=${b.rocAuc}`);
  console.log(`CONSTANT_BASELINE_ACCURACY=${b.accuracy}`);
  console.log(`CONSTANT_BASELINE_LOGLOSS=${b.logLoss}`);
  console.log(`CONSTANT_BASELINE_BRIER=${b.brierScore}`);
  console.log(`AUC_PASS=${d.AUC_PASS ? "YES" : "NO"}`);
  console.log(`LOGLOSS_PASS=${d.LOGLOSS_PASS ? "YES" : "NO"}`);
  console.log(`BRIER_PASS=${d.BRIER_PASS ? "YES" : "NO"}`);
  console.log(`DIRECTIONAL_VERDICT=${result.evaluation.directionalVerdict}`);
  console.log(`accuracy=${s.accuracy}`);
  console.log(`TP=${s.TP} TN=${s.TN} FP=${s.FP} FN=${s.FN}`);
  console.log(`actualHomeRate=${s.actualHomeRate}`);
  console.log(`predictedHomeClassRate=${s.predictedHomeClassRate}`);
  console.log(`meanPredictedHomeProbability=${s.meanPredictedHomeProbability}`);
  console.log(`signedProbabilityBias=${s.signedProbabilityBias}`);
  console.log(`evaluationArtifactSha256=${result.audit.evaluationArtifactSha256}`);
  console.log(`joinRel=${independentExternalReplication2025JoinRel()}`);
  console.log(`evaluation artifact=${independentExternalReplication2025V2cEvaluationRel()}`);
  console.log(`audit artifact=${independentExternalReplication2025V2cEvaluationAuditRel()}`);
  console.log("V2C_MODEL_CANDIDATE=NO");
  console.log("2024_HOLDOUT_EVALUATED=NO");
  console.log("EXTERNAL_AGGREGATE_EVALUATION_COUNT=1");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.stack ?? e.message : e);
  process.exitCode = 1;
});

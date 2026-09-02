/**
 * Train Independent Logistic STREAK_REST Ablation Prototype v2-B.
 * TRAIN-internal rolling first, then freeze, then Validation. HOLDOUT sealed.
 *
 *   npm run train:mlb-independent-logistic-streak-rest-ablation-v2b
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { independentJoinArtifactPath } from "../src/lib/mlb/independent-join-v1";
import {
  MLB_INDEPENDENT_2024_SEALED_JOIN_SHA256_V1,
  independentSplitArtifactPath,
} from "../src/lib/mlb/independent-split-v1";
import { IndependentLogisticError } from "../src/lib/mlb/independent-logistic-v1/spec";
import { independentLogisticV2aEvalPath } from "../src/lib/mlb/independent-logistic-v2a";
import {
  MLB_INDEPENDENT_2024_SEALED_V1_MODEL_CORE_HASH_V2B,
  MLB_INDEPENDENT_2024_SEALED_V2A_MODEL_CORE_HASH_V2B,
  independentLogisticV2bAuditPath,
  independentLogisticV2bAuditRel,
  independentLogisticV2bEvalPath,
  independentLogisticV2bEvalRel,
  independentLogisticV2bModelPath,
  independentLogisticV2bModelRel,
  independentLogisticV2bRollingPath,
  independentLogisticV2bRollingRel,
  trainIndependentLogisticStreakRestAblationV2b,
} from "../src/lib/mlb/independent-logistic-v2b";

async function writeJsonAtomic(filePath: string, value: unknown): Promise<void> {
  const tmp = `${filePath}.tmp`;
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(tmp, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(tmp, filePath);
}

async function main(): Promise<void> {
  console.log("=== Train MLB Independent Logistic STREAK_REST Ablation v2-B ===");
  const joinBuf = await readFile(independentJoinArtifactPath());
  const sourceJoinHash = createHash("sha256").update(joinBuf).digest("hex");
  if (sourceJoinHash !== MLB_INDEPENDENT_2024_SEALED_JOIN_SHA256_V1) {
    throw new IndependentLogisticError(
      "SEALED_JOIN_ARTIFACT_HASH_MISMATCH",
      sourceJoinHash,
    );
  }
  const join = JSON.parse(joinBuf.toString("utf8"));
  const split = JSON.parse(
    (await readFile(independentSplitArtifactPath())).toString("utf8"),
  );
  const v2aEval = JSON.parse(
    (await readFile(independentLogisticV2aEvalPath())).toString("utf8"),
  );
  if (v2aEval.modelCoreHash !== MLB_INDEPENDENT_2024_SEALED_V2A_MODEL_CORE_HASH_V2B) {
    throw new IndependentLogisticError(
      "V2A_MODEL_CORE_HASH_PIN_MISMATCH",
      v2aEval.modelCoreHash,
    );
  }

  const result = trainIndependentLogisticStreakRestAblationV2b(join, split, {
    sourceJoinHash,
    v1ModelCoreHash: MLB_INDEPENDENT_2024_SEALED_V1_MODEL_CORE_HASH_V2B,
    v2aModelCoreHash: MLB_INDEPENDENT_2024_SEALED_V2A_MODEL_CORE_HASH_V2B,
    v2aValidation: v2aEval.validation,
  });

  await writeJsonAtomic(independentLogisticV2bModelPath(), result.model);
  await writeJsonAtomic(independentLogisticV2bEvalPath(), result.evaluation);
  await writeJsonAtomic(independentLogisticV2bRollingPath(), result.rolling);
  await writeJsonAtomic(independentLogisticV2bAuditPath(), result.audit);

  const o = result.audit as Record<string, unknown>;
  const tm = o.trainMetrics as Record<string, number>;
  const vm = o.validationMetrics as Record<string, number>;
  const deltas = o.v2bMinusV2a as Record<string, number>;
  console.log(`TRAIN=${result.model.trainingSampleCount}`);
  console.log(`VALIDATION=${result.model.validationSampleCount}`);
  console.log(`HOLDOUT=${result.model.holdoutSampleCount}`);
  console.log(`HOLDOUT_EVALUATED=false`);
  console.log(`baseDimensions=${result.model.featureSpec.baseDimensions}`);
  console.log(`missingIndicators=${result.model.featureSpec.missingIndicators}`);
  console.log(`modelDimensions=${result.model.featureSpec.modelDimensions}`);
  console.log(
    `EXACT_STREAK_REST_ABLATION=${(o.ablation as { EXACT_STREAK_REST_ABLATION: string }).EXACT_STREAK_REST_ABLATION}`,
  );
  console.log(`TRAIN_INTERNAL_ROLLING_COMPLETE=${o.TRAIN_INTERNAL_ROLLING_COMPLETE}`);
  console.log(`V2B_SPEC_FROZEN=${o.V2B_SPEC_FROZEN}`);
  console.log(`V2B_MODEL_CORE_HASH_CREATED=${o.V2B_MODEL_CORE_HASH_CREATED}`);
  console.log(
    `VALIDATION_EVALUATION_AFTER_MODEL_FREEZE=${o.VALIDATION_EVALUATION_AFTER_MODEL_FREEZE}`,
  );
  console.log(`modelCoreHash=${result.model.modelCoreHash}`);
  console.log(`TRAIN_rocAuc=${o.trainRocAuc}`);
  console.log(`TRAIN_logLoss=${tm.logLoss}`);
  console.log(`TRAIN_brier=${tm.brierScore}`);
  console.log(`VALIDATION_rocAuc=${o.validationRocAuc}`);
  console.log(`VALIDATION_accuracy=${vm.accuracy}`);
  console.log(`VALIDATION_logLoss=${vm.logLoss}`);
  console.log(`VALIDATION_brier=${vm.brierScore}`);
  console.log(`v2bMinusV2aAuc=${deltas.auc}`);
  console.log(`v2bMinusV2aLogLoss=${deltas.logLoss}`);
  console.log(`v2bMinusV2aBrier=${deltas.brierScore}`);
  console.log(`researchInterpretation=${o.researchInterpretation}`);
  console.log(`model artifact=${independentLogisticV2bModelRel()}`);
  console.log(`eval artifact=${independentLogisticV2bEvalRel()}`);
  console.log(`rolling artifact=${independentLogisticV2bRollingRel()}`);
  console.log(`audit artifact=${independentLogisticV2bAuditRel()}`);
  console.log("INDEPENDENT_LOGISTIC_V2B_ABLATION_TRAINED");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.stack ?? e.message : e);
  process.exitCode = 1;
});

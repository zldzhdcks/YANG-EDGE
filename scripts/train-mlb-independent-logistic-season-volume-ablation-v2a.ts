/**
 * Train Independent Logistic Season-Volume Ablation Prototype v2-A.
 * TRAIN/VALIDATION only. Does not modify frozen v1 artifacts.
 *
 *   npm run train:mlb-independent-logistic-season-volume-ablation-v2a
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
import { independentLogisticEvalPath } from "../src/lib/mlb/independent-logistic-v1";
import {
  MLB_INDEPENDENT_2024_SEALED_V1_MODEL_CORE_HASH_V2A,
  independentLogisticV2aAuditPath,
  independentLogisticV2aAuditRel,
  independentLogisticV2aEvalPath,
  independentLogisticV2aEvalRel,
  independentLogisticV2aModelPath,
  independentLogisticV2aModelRel,
  trainIndependentLogisticSeasonVolumeAblationV2a,
} from "../src/lib/mlb/independent-logistic-v2a";

async function writeJsonAtomic(filePath: string, value: unknown): Promise<void> {
  const tmp = `${filePath}.tmp`;
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(tmp, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(tmp, filePath);
}

async function main(): Promise<void> {
  console.log("=== Train MLB Independent Logistic Season-Volume Ablation v2-A ===");
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
  const v1Eval = JSON.parse(
    (await readFile(independentLogisticEvalPath())).toString("utf8"),
  );
  if (v1Eval.modelCoreHash !== MLB_INDEPENDENT_2024_SEALED_V1_MODEL_CORE_HASH_V2A) {
    throw new IndependentLogisticError(
      "V1_MODEL_CORE_HASH_PIN_MISMATCH",
      v1Eval.modelCoreHash,
    );
  }

  const result = trainIndependentLogisticSeasonVolumeAblationV2a(join, split, {
    sourceJoinHash,
    v1ModelCoreHash: MLB_INDEPENDENT_2024_SEALED_V1_MODEL_CORE_HASH_V2A,
    v1Validation: v1Eval.validation,
  });

  await writeJsonAtomic(independentLogisticV2aModelPath(), result.model);
  await writeJsonAtomic(independentLogisticV2aEvalPath(), result.evaluation);
  await writeJsonAtomic(independentLogisticV2aAuditPath(), result.audit);

  const o = result.audit.optimizer;
  const tm = result.audit.trainMetrics;
  const vm = result.audit.validationMetrics;
  console.log(`TRAIN=${result.model.trainingSampleCount}`);
  console.log(`VALIDATION=${result.model.validationSampleCount}`);
  console.log(`HOLDOUT=${result.model.holdoutSampleCount}`);
  console.log(`HOLDOUT_EVALUATED=false`);
  console.log(`baseDimensions=${result.model.featureSpec.baseDimensions}`);
  console.log(`missingIndicators=${result.model.featureSpec.missingIndicators}`);
  console.log(`modelDimensions=${result.model.featureSpec.modelDimensions}`);
  console.log(`EXACT_SINGLE_ABLATION=${result.audit.ablation.EXACT_SINGLE_ABLATION}`);
  console.log(`converged=${o.converged}`);
  console.log(`iterations=${o.iterations}`);
  console.log(`intercept=${result.model.intercept}`);
  console.log(`modelCoreHash=${result.model.modelCoreHash}`);
  console.log(`TRAIN_accuracy=${tm.accuracy}`);
  console.log(`TRAIN_logLoss=${tm.logLoss}`);
  console.log(`TRAIN_brier=${tm.brierScore}`);
  console.log(`VALIDATION_accuracy=${vm.accuracy}`);
  console.log(`VALIDATION_logLoss=${vm.logLoss}`);
  console.log(`VALIDATION_brier=${vm.brierScore}`);
  console.log(`VALIDATION_predictedHomeRate=${vm.predictedHomeRate}`);
  console.log(`VALIDATION_meanPredictedProbability=${vm.meanPredictedProbability}`);
  console.log(`v2aTotalLogitShift=${result.audit.logitShift.v2aTotalLogitShift}`);
  console.log(`v1TotalLogitShift=${result.audit.logitShift.v1TotalLogitShift}`);
  console.log(`v2aMinusV1LogitShift=${result.audit.logitShift.v2aMinusV1LogitShift}`);
  console.log(`v1MeanProbabilityBias=${result.audit.probabilityBias.v1MeanProbabilityBias}`);
  console.log(`v2aMeanProbabilityBias=${result.audit.probabilityBias.v2aMeanProbabilityBias}`);
  console.log(`researchInterpretation=${result.audit.researchInterpretation}`);
  console.log(`model artifact=${independentLogisticV2aModelRel()}`);
  console.log(`eval artifact=${independentLogisticV2aEvalRel()}`);
  console.log(`audit artifact=${independentLogisticV2aAuditRel()}`);
  console.log("INDEPENDENT_LOGISTIC_V2A_ABLATION_TRAINED");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.stack ?? e.message : e);
  process.exitCode = 1;
});

/**
 * Train Independent Logistic HEAD_TO_HEAD Ablation Prototype v2-C.
 * TRAIN rolling H2H replay, then freeze, then one aggregate Validation pass.
 * HOLDOUT sealed. No Validation slicing.
 *
 *   npm run train:mlb-independent-logistic-head-to-head-ablation-v2c
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
import { independentLogisticV2bModelPath } from "../src/lib/mlb/independent-logistic-v2b";
import {
  MLB_INDEPENDENT_2024_SEALED_V1_MODEL_CORE_HASH_V2C,
  MLB_INDEPENDENT_2024_SEALED_V2A_MODEL_CORE_HASH_V2C,
  MLB_INDEPENDENT_2024_SEALED_V2B_MODEL_CORE_HASH_V2C,
  independentLogisticV2cAuditPath,
  independentLogisticV2cAuditRel,
  independentLogisticV2cEvalPath,
  independentLogisticV2cEvalRel,
  independentLogisticV2cModelPath,
  independentLogisticV2cModelRel,
  independentLogisticV2cRollingPath,
  independentLogisticV2cRollingRel,
  trainIndependentLogisticHeadToHeadAblationV2c,
} from "../src/lib/mlb/independent-logistic-v2c";

async function writeJsonAtomic(filePath: string, value: unknown): Promise<void> {
  const tmp = `${filePath}.tmp`;
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(tmp, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(tmp, filePath);
}

async function main(): Promise<void> {
  console.log("=== Train MLB Independent Logistic HEAD_TO_HEAD Ablation v2-C ===");
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
  const v2bModel = JSON.parse(
    (await readFile(independentLogisticV2bModelPath())).toString("utf8"),
  ) as { modelCoreHash: string };
  if (v2bModel.modelCoreHash !== MLB_INDEPENDENT_2024_SEALED_V2B_MODEL_CORE_HASH_V2C) {
    throw new IndependentLogisticError(
      "V2B_MODEL_CORE_HASH_PIN_MISMATCH",
      v2bModel.modelCoreHash,
    );
  }

  const result = trainIndependentLogisticHeadToHeadAblationV2c(join, split, {
    sourceJoinHash,
    v1ModelCoreHash: MLB_INDEPENDENT_2024_SEALED_V1_MODEL_CORE_HASH_V2C,
    v2aModelCoreHash: MLB_INDEPENDENT_2024_SEALED_V2A_MODEL_CORE_HASH_V2C,
    v2bModelCoreHash: MLB_INDEPENDENT_2024_SEALED_V2B_MODEL_CORE_HASH_V2C,
  });

  await writeJsonAtomic(independentLogisticV2cModelPath(), result.model);
  await writeJsonAtomic(independentLogisticV2cEvalPath(), result.evaluation);
  await writeJsonAtomic(independentLogisticV2cRollingPath(), result.rolling);
  await writeJsonAtomic(independentLogisticV2cAuditPath(), result.audit);

  const o = result.audit as Record<string, unknown>;
  const tm = o.trainMetrics as Record<string, number>;
  const vm = o.validationMetrics as Record<string, number>;
  const deltas = o.v2cMinusV2b as Record<string, number>;
  const vsConst = o.v2cMinusConstant as Record<string, number>;
  console.log(`TRAIN=${result.model.trainingSampleCount}`);
  console.log(`VALIDATION=${result.model.validationSampleCount}`);
  console.log(`HOLDOUT=${result.model.holdoutSampleCount}`);
  console.log(`HOLDOUT_EVALUATED=false`);
  console.log(`baseDimensions=${result.model.featureSpec.baseDimensions}`);
  console.log(`missingIndicators=${result.model.featureSpec.missingIndicators}`);
  console.log(`modelDimensions=${result.model.featureSpec.modelDimensions}`);
  console.log(
    `EXACT_H2H_ABLATION=${(o.ablation as { EXACT_H2H_ABLATION: string }).EXACT_H2H_ABLATION}`,
  );
  console.log(`H2H_ROLLING_FOLD_1_REPLAY=${o.H2H_ROLLING_FOLD_1_REPLAY}`);
  console.log(`H2H_ROLLING_FOLD_2_REPLAY=${o.H2H_ROLLING_FOLD_2_REPLAY}`);
  console.log(`H2H_ROLLING_FOLD_3_REPLAY=${o.H2H_ROLLING_FOLD_3_REPLAY}`);
  console.log(`V2C_SPEC_FROZEN=${o.V2C_SPEC_FROZEN}`);
  console.log(`V2C_MODEL_CORE_HASH_CREATED=${o.V2C_MODEL_CORE_HASH_CREATED}`);
  console.log(
    `VALIDATION_EVALUATION_AFTER_MODEL_FREEZE=${o.VALIDATION_EVALUATION_AFTER_MODEL_FREEZE}`,
  );
  console.log(
    `VALIDATION_BIN_ANALYSIS_PERFORMED=${o.VALIDATION_BIN_ANALYSIS_PERFORMED}`,
  );
  console.log(`modelCoreHash=${result.model.modelCoreHash}`);
  console.log(`TRAIN_rocAuc=${o.trainRocAuc}`);
  console.log(`TRAIN_logLoss=${tm.logLoss}`);
  console.log(`TRAIN_brier=${tm.brierScore}`);
  console.log(`VALIDATION_rocAuc=${o.validationRocAuc}`);
  console.log(`VALIDATION_accuracy=${vm.accuracy}`);
  console.log(`VALIDATION_logLoss=${vm.logLoss}`);
  console.log(`VALIDATION_brier=${vm.brierScore}`);
  console.log(`v2cMinusV2bAuc=${deltas.auc}`);
  console.log(`v2cMinusV2bLogLoss=${deltas.logLoss}`);
  console.log(`v2cMinusV2bBrier=${deltas.brierScore}`);
  console.log(`v2cMinusConstantLogLoss=${vsConst.logLoss}`);
  console.log(`v2cMinusConstantBrier=${vsConst.brierScore}`);
  console.log(`researchInterpretation=${o.researchInterpretation}`);
  console.log(`model artifact=${independentLogisticV2cModelRel()}`);
  console.log(`eval artifact=${independentLogisticV2cEvalRel()}`);
  console.log(`rolling artifact=${independentLogisticV2cRollingRel()}`);
  console.log(`audit artifact=${independentLogisticV2cAuditRel()}`);
  console.log("INDEPENDENT_LOGISTIC_V2C_H2H_ABLATION_TRAINED");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.stack ?? e.message : e);
  process.exitCode = 1;
});

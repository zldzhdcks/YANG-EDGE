/**
 * Train Independent Logistic Regression Prototype v1 (TRAIN/VALIDATION only).
 *
 *   npm run train:mlb-independent-logistic-prototype-v1
 *
 * HOLDOUT labels are not evaluated. No network. No engine wiring.
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { independentJoinArtifactPath } from "../src/lib/mlb/independent-join-v1";
import {
  MLB_INDEPENDENT_2024_SEALED_JOIN_SHA256_V1,
  independentSplitArtifactPath,
} from "../src/lib/mlb/independent-split-v1";
import {
  independentLogisticAuditPath,
  independentLogisticAuditRel,
  independentLogisticEvalPath,
  independentLogisticEvalRel,
  independentLogisticModelPath,
  independentLogisticModelRel,
  trainIndependentLogisticPrototypeV1,
} from "../src/lib/mlb/independent-logistic-v1";
import { IndependentLogisticError } from "../src/lib/mlb/independent-logistic-v1";

async function writeJsonAtomic(filePath: string, value: unknown): Promise<void> {
  const tmp = `${filePath}.tmp`;
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(tmp, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(tmp, filePath);
}

async function main(): Promise<void> {
  console.log("=== Train MLB Independent Logistic Prototype v1 ===");
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
    await readFile(independentSplitArtifactPath(), "utf8"),
  );
  const result = trainIndependentLogisticPrototypeV1(join, split, {
    sourceJoinHash,
  });

  await writeJsonAtomic(independentLogisticModelPath(), result.model);
  await writeJsonAtomic(independentLogisticEvalPath(), result.evaluation);
  await writeJsonAtomic(independentLogisticAuditPath(), result.audit);

  const o = result.audit.optimizer;
  const tm = result.audit.trainMetrics;
  const vm = result.audit.validationMetrics;
  console.log(`TRAIN=${result.model.trainingSampleCount}`);
  console.log(`VALIDATION=${result.model.validationSampleCount}`);
  console.log(`HOLDOUT=${result.model.holdoutSampleCount}`);
  console.log(`HOLDOUT_EVALUATED=false`);
  console.log(`converged=${o.converged}`);
  console.log(`iterations=${o.iterations}`);
  console.log(`initialObjective=${o.initialObjective}`);
  console.log(`finalObjective=${o.finalObjective}`);
  console.log(`finalGradientNorm=${o.finalGradientNorm}`);
  console.log(`intercept=${result.model.intercept}`);
  console.log(`modelCoreHash=${result.model.modelCoreHash}`);
  console.log(`TRAIN_accuracy=${tm.accuracy}`);
  console.log(`TRAIN_logLoss=${tm.logLoss}`);
  console.log(`TRAIN_brier=${tm.brierScore}`);
  console.log(`VALIDATION_accuracy=${vm.accuracy}`);
  console.log(`VALIDATION_logLoss=${vm.logLoss}`);
  console.log(`VALIDATION_brier=${vm.brierScore}`);
  console.log(`baselineTrainHomeRate=${result.audit.baselineTrainHomeRate}`);
  console.log(`accuracyDelta=${result.audit.validationDeltas.accuracyDelta}`);
  console.log(`logLossDelta=${result.audit.validationDeltas.logLossDelta}`);
  console.log(`brierDelta=${result.audit.validationDeltas.brierDelta}`);
  console.log(`model artifact=${independentLogisticModelRel()}`);
  console.log(`eval artifact=${independentLogisticEvalRel()}`);
  console.log(`audit artifact=${independentLogisticAuditRel()}`);
  console.log("INDEPENDENT_LOGISTIC_PROTOTYPE_TRAINED");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.stack ?? e.message : e);
  process.exitCode = 1;
});

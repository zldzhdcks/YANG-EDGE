/**
 * Frozen v2-A calibration / discrimination / residual-shift diagnostic.
 * Does not retrain, calibrate, or open Holdout.
 *
 *   npm run diagnose:mlb-independent-logistic-v2a-calibration-discrimination-v1
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { independentJoinArtifactPath } from "../src/lib/mlb/independent-join-v1";
import type { IndependentJoinArtifactV1 } from "../src/lib/mlb/independent-join-v1";
import { independentSplitArtifactPath } from "../src/lib/mlb/independent-split-v1";
import type { IndependentSplitArtifactV1 } from "../src/lib/mlb/independent-split-v1";
import { independentLogisticEvalPath } from "../src/lib/mlb/independent-logistic-v1";
import {
  diagnoseV2aCalibrationDiscriminationV1,
  independentLogisticV2aCalibAuditPath,
  independentLogisticV2aCalibAuditRel,
  independentLogisticV2aCalibDiagnosticPath,
  independentLogisticV2aCalibDiagnosticRel,
  sealedV2aEvalPath,
  sealedV2aModelPath,
  type FrozenV2aModelV1,
} from "../src/lib/mlb/independent-logistic-v2a-diagnostic-v1";

async function writeJsonAtomic(filePath: string, value: unknown): Promise<void> {
  const tmp = `${filePath}.tmp`;
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(tmp, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(tmp, filePath);
}

async function main(): Promise<void> {
  console.log("=== Diagnose MLB Independent Logistic v2-A Calibration/Discrimination v1 ===");
  const joinBuf = await readFile(independentJoinArtifactPath());
  const sourceJoinHash = createHash("sha256").update(joinBuf).digest("hex");
  const join = JSON.parse(joinBuf.toString("utf8")) as IndependentJoinArtifactV1;
  const split = JSON.parse(
    (await readFile(independentSplitArtifactPath())).toString("utf8"),
  ) as IndependentSplitArtifactV1;
  const model = JSON.parse(
    (await readFile(sealedV2aModelPath())).toString("utf8"),
  ) as FrozenV2aModelV1;
  const evaluation = JSON.parse(
    (await readFile(sealedV2aEvalPath())).toString("utf8"),
  );
  const v1Evaluation = JSON.parse(
    (await readFile(independentLogisticEvalPath())).toString("utf8"),
  );

  const result = diagnoseV2aCalibrationDiscriminationV1({
    join,
    split,
    model,
    evaluation,
    v1Evaluation,
    sourceJoinHash,
    generatedAt: new Date().toISOString(),
  });

  await writeJsonAtomic(
    independentLogisticV2aCalibDiagnosticPath(),
    result.diagnostic,
  );
  await writeJsonAtomic(independentLogisticV2aCalibAuditPath(), result.audit);

  const d = result.diagnostic;
  const e = d.evidenceSummary as Record<string, unknown>;
  console.log(`modelCoreHash=${d.modelCoreHash}`);
  console.log(`residualLogitShift=${d.residualLogitShift}`);
  console.log(`largestResidualShiftGroup=${d.largestResidualShiftGroup}`);
  console.log(`validationMeanProbabilityBias=${e.validationMeanProbabilityBias}`);
  console.log(`validationCalibrationOffsetNeeded=${e.validationCalibrationOffsetNeeded}`);
  console.log(`trainRocAuc=${d.trainRocAuc}`);
  console.log(`validationRocAuc=${d.validationRocAuc}`);
  console.log(`validationFixedBinECE=${d.validationFixedBinECE}`);
  console.log(`v2aValidationLogLoss=${e.v2aValidationLogLoss}`);
  console.log(`baselineValidationLogLoss=${e.baselineValidationLogLoss}`);
  console.log(`holdoutEvaluated=${d.holdoutEvaluated}`);
  console.log(`diagnostic=${independentLogisticV2aCalibDiagnosticRel()}`);
  console.log(`audit=${independentLogisticV2aCalibAuditRel()}`);
  console.log("V2A_CALIBRATION_DISCRIMINATION_DIAGNOSTIC_MATERIALIZED");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.stack ?? e.message : e);
  process.exitCode = 1;
});

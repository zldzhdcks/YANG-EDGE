/**
 * Frozen Prototype v1 Validation shift diagnostic.
 * Does not retrain. Does not open Holdout features/labels. No engine write.
 *
 *   npm run diagnose:mlb-independent-logistic-validation-shift-v1
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { independentJoinArtifactPath } from "../src/lib/mlb/independent-join-v1";
import type { IndependentJoinArtifactV1 } from "../src/lib/mlb/independent-join-v1";
import { independentSplitArtifactPath } from "../src/lib/mlb/independent-split-v1";
import type { IndependentSplitArtifactV1 } from "../src/lib/mlb/independent-split-v1";
import {
  diagnoseLogisticValidationShiftV1,
  independentLogisticDiagnosticAuditPath,
  independentLogisticDiagnosticAuditRel,
  independentLogisticDiagnosticPath,
  independentLogisticDiagnosticRel,
  sealedLogisticEvalPath,
  sealedLogisticEvalRel,
  sealedLogisticModelPath,
  sealedLogisticModelRel,
  type FrozenPrototypeEvalV1,
  type FrozenPrototypeModelV1,
} from "../src/lib/mlb/independent-logistic-diagnostic-v1";

async function writeJsonAtomic(filePath: string, value: unknown): Promise<void> {
  const tmp = `${filePath}.tmp`;
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(tmp, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(tmp, filePath);
}

function sha256Bytes(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

async function main(): Promise<void> {
  console.log("=== Diagnose MLB Independent Logistic Validation Shift v1 ===");
  const joinBuf = await readFile(independentJoinArtifactPath());
  const sourceJoinHash = sha256Bytes(joinBuf);
  const join = JSON.parse(joinBuf.toString("utf8")) as IndependentJoinArtifactV1;
  const split = JSON.parse(
    (await readFile(independentSplitArtifactPath())).toString("utf8"),
  ) as IndependentSplitArtifactV1;
  const model = JSON.parse(
    (await readFile(sealedLogisticModelPath())).toString("utf8"),
  ) as FrozenPrototypeModelV1;
  const evaluation = JSON.parse(
    (await readFile(sealedLogisticEvalPath())).toString("utf8"),
  ) as FrozenPrototypeEvalV1;

  const result = diagnoseLogisticValidationShiftV1({
    join,
    split,
    model,
    evaluation,
    sourceJoinHash,
    generatedAt: new Date().toISOString(),
  });

  await writeJsonAtomic(independentLogisticDiagnosticPath(), result.diagnostic);
  await writeJsonAtomic(independentLogisticDiagnosticAuditPath(), result.audit);

  const d = result.diagnostic;
  console.log(`modelCoreHash=${d.modelCoreHash}`);
  console.log(`sourceJoinArtifactHash=${d.sourceJoinArtifactHash}`);
  console.log(`sourceSplitManifestHash=${d.sourceSplitManifestHash}`);
  console.log(`trainMeanLogit=${d.trainMeanLogit}`);
  console.log(`validationMeanLogit=${d.validationMeanLogit}`);
  console.log(`logitShift=${d.logitShift}`);
  console.log(`logitShiftReconciliation=${d.logitShiftReconciliation}`);
  console.log(`trainMeanProbability=${d.trainMeanProbability}`);
  console.log(`validationMeanProbability=${d.validationMeanProbability}`);
  console.log(`predictedMeanProbabilityShift=${d.predictedMeanProbabilityShift}`);
  console.log(`actualHomeRateShift=${d.actualHomeRateShift}`);
  console.log(
    `seasonVolumeTotalShiftContribution=${d.seasonVolumeTotalShiftContribution}`,
  );
  console.log(
    `missingIndicatorTotalShiftContribution=${d.missingIndicatorTotalShiftContribution}`,
  );
  console.log(`diagnosticClassification=${d.diagnosticClassification}`);
  console.log(`holdoutEvaluated=${d.holdoutEvaluated}`);
  console.log(`model=${sealedLogisticModelRel()}`);
  console.log(`evaluation=${sealedLogisticEvalRel()}`);
  console.log(`diagnostic=${independentLogisticDiagnosticRel()}`);
  console.log(`audit=${independentLogisticDiagnosticAuditRel()}`);
  console.log("VALIDATION_SHIFT_DIAGNOSTIC_MATERIALIZED");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.stack ?? e.message : e);
  process.exitCode = 1;
});

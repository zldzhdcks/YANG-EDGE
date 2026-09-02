/**
 * Frozen v2-A temporal signal-stability diagnostic.
 * Does not retrain, select features, calibrate, or open Holdout.
 *
 *   npm run diagnose:mlb-independent-logistic-v2a-signal-stability-v1
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { independentJoinArtifactPath } from "../src/lib/mlb/independent-join-v1";
import type { IndependentJoinArtifactV1 } from "../src/lib/mlb/independent-join-v1";
import { independentSplitArtifactPath } from "../src/lib/mlb/independent-split-v1";
import type { IndependentSplitArtifactV1 } from "../src/lib/mlb/independent-split-v1";
import type { FrozenV2aModelV1 } from "../src/lib/mlb/independent-logistic-v2a-diagnostic-v1";
import {
  diagnoseV2aSignalStabilityV1,
  independentLogisticV2aSignalStabAuditPath,
  independentLogisticV2aSignalStabAuditRel,
  independentLogisticV2aSignalStabDiagnosticPath,
  independentLogisticV2aSignalStabDiagnosticRel,
  sealedV2aEvalPathStab,
  sealedV2aModelPathStab,
} from "../src/lib/mlb/independent-logistic-v2a-signal-stability-v1";

async function writeJsonAtomic(filePath: string, value: unknown): Promise<void> {
  const tmp = `${filePath}.tmp`;
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(tmp, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(tmp, filePath);
}

async function main(): Promise<void> {
  console.log("=== Diagnose MLB Independent Logistic v2-A Signal Stability v1 ===");
  const joinBuf = await readFile(independentJoinArtifactPath());
  const sourceJoinHash = createHash("sha256").update(joinBuf).digest("hex");
  const join = JSON.parse(joinBuf.toString("utf8")) as IndependentJoinArtifactV1;
  const split = JSON.parse(
    (await readFile(independentSplitArtifactPath())).toString("utf8"),
  ) as IndependentSplitArtifactV1;
  const model = JSON.parse(
    (await readFile(sealedV2aModelPathStab())).toString("utf8"),
  ) as FrozenV2aModelV1;
  const evaluation = JSON.parse(
    (await readFile(sealedV2aEvalPathStab())).toString("utf8"),
  );

  const result = diagnoseV2aSignalStabilityV1({
    join,
    split,
    model,
    evaluation,
    sourceJoinHash,
    generatedAt: new Date().toISOString(),
  });

  await writeJsonAtomic(
    independentLogisticV2aSignalStabDiagnosticPath(),
    result.diagnostic,
  );
  await writeJsonAtomic(independentLogisticV2aSignalStabAuditPath(), result.audit);

  const d = result.diagnostic;
  const g = d.globalSignalTransfer as Record<string, unknown>;
  console.log(`modelCoreHash=${d.modelCoreHash}`);
  console.log(`featureCount=${d.featureCount}`);
  console.log(`trainModelAuc=${d.trainModelAuc}`);
  console.log(`validationModelAuc=${d.validationModelAuc}`);
  console.log(`featureSignalTransferPearson=${g.featureSignalTransferPearson}`);
  console.log(`featureSignalTransferSpearman=${g.featureSignalTransferSpearman}`);
  console.log(
    `trainToValidationDirectionMatchCount=${g.trainToValidationDirectionMatchCount}`,
  );
  console.log(
    `trainToValidationDirectionFlipCount=${g.trainToValidationDirectionFlipCount}`,
  );
  console.log(
    `trainAlignedValidationMisalignedCount=${g.trainAlignedValidationMisalignedCount}`,
  );
  console.log(`holdoutEvaluated=${d.holdoutEvaluated}`);
  console.log(`diagnostic=${independentLogisticV2aSignalStabDiagnosticRel()}`);
  console.log(`audit=${independentLogisticV2aSignalStabAuditRel()}`);
  console.log("V2A_SIGNAL_STABILITY_DIAGNOSTIC_MATERIALIZED");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.stack ?? e.message : e);
  process.exitCode = 1;
});

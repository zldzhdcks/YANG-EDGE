/**
 * TRAIN-only v2-B group contribution diagnostic.
 * Does not create v2-C, read Validation values, or open Holdout.
 *
 *   npm run diagnose:mlb-independent-logistic-v2b-group-contribution-v1
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { independentJoinArtifactPath } from "../src/lib/mlb/independent-join-v1";
import type { IndependentJoinArtifactV1 } from "../src/lib/mlb/independent-join-v1";
import { independentSplitArtifactPath } from "../src/lib/mlb/independent-split-v1";
import type { IndependentSplitArtifactV1 } from "../src/lib/mlb/independent-split-v1";
import { independentLogisticV2bModelPath } from "../src/lib/mlb/independent-logistic-v2b";
import {
  MLB_INDEPENDENT_2024_SEALED_V2B_MODEL_CORE_HASH_GCV1,
  diagnoseV2bTrainGroupContributionV1,
  independentLogisticV2bGroupContribAuditPath,
  independentLogisticV2bGroupContribAuditRel,
  independentLogisticV2bGroupContribDiagnosticPath,
  independentLogisticV2bGroupContribDiagnosticRel,
  independentLogisticV2bRollingPath,
  independentLogisticV2bRollingRel,
  type SealedV2bRollingArtifactV1,
} from "../src/lib/mlb/independent-logistic-v2b-group-contribution-v1";

async function writeJsonAtomic(filePath: string, value: unknown): Promise<void> {
  const tmp = `${filePath}.tmp`;
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(tmp, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(tmp, filePath);
}

async function main(): Promise<void> {
  console.log("=== Diagnose MLB Independent Logistic v2-B TRAIN Group Contribution v1 ===");
  const joinBuf = await readFile(independentJoinArtifactPath());
  const sourceJoinHash = createHash("sha256").update(joinBuf).digest("hex");
  const join = JSON.parse(joinBuf.toString("utf8")) as IndependentJoinArtifactV1;
  const split = JSON.parse(
    (await readFile(independentSplitArtifactPath())).toString("utf8"),
  ) as IndependentSplitArtifactV1;
  const model = JSON.parse(
    (await readFile(independentLogisticV2bModelPath())).toString("utf8"),
  ) as { modelCoreHash: string };
  const sealedRolling = JSON.parse(
    (await readFile(independentLogisticV2bRollingPath())).toString("utf8"),
  ) as SealedV2bRollingArtifactV1;

  const result = diagnoseV2bTrainGroupContributionV1({
    join,
    split,
    sourceJoinHash,
    sealedRolling,
    sealedV2bModelCoreHash: model.modelCoreHash,
    generatedAt: new Date().toISOString(),
  });

  await writeJsonAtomic(
    independentLogisticV2bGroupContribDiagnosticPath(),
    result.diagnostic,
  );
  await writeJsonAtomic(
    independentLogisticV2bGroupContribAuditPath(),
    result.audit,
  );

  const d = result.diagnostic as Record<string, unknown>;
  const replay1 = d.V2B_ROLLING_FOLD_1_REPLAY;
  const replay2 = d.V2B_ROLLING_FOLD_2_REPLAY;
  const replay3 = d.V2B_ROLLING_FOLD_3_REPLAY;
  console.log(`v2bBaselineModelCoreHash=${d.v2bBaselineModelCoreHash}`);
  console.log(
    `expectedPin=${MLB_INDEPENDENT_2024_SEALED_V2B_MODEL_CORE_HASH_GCV1}`,
  );
  console.log(`GROUP_FEATURE_COUNT=${(d.groupCoverage as { GROUP_FEATURE_COUNT: number }).GROUP_FEATURE_COUNT}`);
  console.log(`V2B_ROLLING_FOLD_1_REPLAY=${replay1}`);
  console.log(`V2B_ROLLING_FOLD_2_REPLAY=${replay2}`);
  console.log(`V2B_ROLLING_FOLD_3_REPLAY=${replay3}`);
  console.log(`VALIDATION_EVALUATED=${d.VALIDATION_EVALUATED}`);
  console.log(`HOLDOUT_EVALUATED=${d.HOLDOUT_EVALUATED}`);
  console.log(`newModelCreated=${d.newModelCreated}`);
  console.log(`featureSelectionPerformed=${d.featureSelectionPerformed}`);
  console.log(`sealedRolling=${independentLogisticV2bRollingRel()}`);
  console.log(`diagnostic=${independentLogisticV2bGroupContribDiagnosticRel()}`);
  console.log(`audit=${independentLogisticV2bGroupContribAuditRel()}`);
  console.log("V2B_TRAIN_GROUP_CONTRIBUTION_DIAGNOSTIC_MATERIALIZED");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.stack ?? e.message : e);
  process.exitCode = 1;
});

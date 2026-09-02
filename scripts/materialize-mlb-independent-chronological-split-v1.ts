/**
 * Chronological TRAIN / VALIDATION / HOLDOUT split of the sealed join artifact.
 *
 *   npm run materialize:mlb-independent-chronological-split-v1
 *
 * NO NETWORK. Does not mutate join / feature / label artifacts. No trainer.
 * Pins Join bytes against MLB_INDEPENDENT_2024_SEALED_JOIN_SHA256_V1 before parse.
 */
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { independentJoinArtifactPath } from "../src/lib/mlb/independent-join-v1";
import {
  independentSplitArtifactPath,
  independentSplitArtifactRel,
  independentSplitAuditPath,
  independentSplitAuditRel,
  splitSealedIndependentJoinBytesV1,
} from "../src/lib/mlb/independent-split-v1";

async function writeJsonAtomic(filePath: string, value: unknown): Promise<void> {
  const tmp = `${filePath}.tmp`;
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(tmp, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(tmp, filePath);
}

async function main(): Promise<void> {
  console.log("=== Chronological Split MLB Independent Join v1 ===");
  const joinPath = independentJoinArtifactPath();
  const joinBuf = await readFile(joinPath);
  const result = splitSealedIndependentJoinBytesV1(joinBuf, {
    sourceJoinPath:
      "data/research/mlb/independent-model-v1/join/2024-feature-label-join-v1.json",
  });

  await writeJsonAtomic(independentSplitArtifactPath(), result.artifact);
  await writeJsonAtomic(independentSplitAuditPath(), result.audit);

  const { counts, boundaries } = result.artifact;
  console.log(`JOINED_ROWS=${result.artifact.independentModelSample}`);
  console.log(`INDEPENDENT_MODEL_SAMPLE=${result.artifact.independentModelSample}`);
  console.log(`TRAIN=${counts.train}`);
  console.log(`VALIDATION=${counts.validation}`);
  console.log(`HOLDOUT=${counts.holdout}`);
  console.log(`trainEndDate=${boundaries.trainEndDate}`);
  console.log(`validationStartDate=${boundaries.validationStartDate}`);
  console.log(`validationEndDate=${boundaries.validationEndDate}`);
  console.log(`holdoutStartDate=${boundaries.holdoutStartDate}`);
  console.log(`holdoutEndDate=${boundaries.holdoutEndDate}`);
  console.log(`splitManifestHash=${result.artifact.splitManifestHash}`);
  console.log(`sourceJoinArtifactHash=${result.artifact.sourceJoinArtifactHash}`);
  console.log(`SPLIT_READY=true`);
  console.log(`DATASET_READY=true`);
  console.log(`split artifact=${independentSplitArtifactRel()}`);
  console.log(`audit artifact=${independentSplitAuditRel()}`);
  console.log("INDEPENDENT_CHRONOLOGICAL_SPLIT_MATERIALIZED");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.stack ?? e.message : e);
  process.exitCode = 1;
});

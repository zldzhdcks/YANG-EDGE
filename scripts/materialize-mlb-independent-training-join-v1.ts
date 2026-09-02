/**
 * Strict-join sealed SAFE_A features with sealed HOME_WIN labels.
 *
 *   npm run materialize:mlb-independent-training-join-v1
 *
 * NO NETWORK. Does not mutate feature/label artifacts. No split or trainer.
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  independentJoinArtifactPath,
  independentJoinArtifactRel,
  independentJoinAuditPath,
  independentJoinAuditRel,
  joinIndependentFeatureLabelV1,
} from "../src/lib/mlb/independent-join-v1";
import { independentLabelArtifactPath } from "../src/lib/mlb/independent-label-v1";
import { independentSafeAFeatureArtifactPath } from "../src/lib/mlb/independent-safe-a-v1/historical-source";

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
  console.log("=== Join MLB Independent Feature + Label v1 ===");
  const featurePath = independentSafeAFeatureArtifactPath();
  const labelPath = independentLabelArtifactPath();
  const featureBuf = await readFile(featurePath);
  const labelBuf = await readFile(labelPath);
  const featureHash = sha256Bytes(featureBuf);
  const labelHash = sha256Bytes(labelBuf);
  const features = JSON.parse(featureBuf.toString("utf8"));
  const labels = JSON.parse(labelBuf.toString("utf8"));

  const result = joinIndependentFeatureLabelV1(features, labels, {
    featurePath: "data/research/mlb/independent-model-v1/features/2024-safe-a-feature-artifact-v1.json",
    labelPath: "data/research/mlb/independent-model-v1/labels/2024-home-win-label-artifact-v1.json",
    featureArtifactHash: featureHash,
    labelArtifactHash: labelHash,
  });

  await writeJsonAtomic(independentJoinArtifactPath(), result.artifact);
  await writeJsonAtomic(independentJoinAuditPath(), result.audit);

  console.log(`featureRows=${result.audit.featureRows}`);
  console.log(`labelRows=${result.audit.labelRows}`);
  console.log(`JOINED_ROWS=${result.audit.joinedRows}`);
  console.log(`FEATURE_ONLY_GAMEPK_COUNT=${result.audit.featureOnlyCount}`);
  console.log(`LABEL_ONLY_GAMEPK_COUNT=${result.audit.labelOnlyCount}`);
  console.log(`featureHashVerifiedCount=${result.audit.featureHashVerifiedCount}`);
  console.log(`INDEPENDENT_MODEL_SAMPLE=${result.audit.independentModelSample}`);
  console.log(`JOIN_READY=true`);
  console.log(`DATASET_READY=false`);
  console.log(`join artifact=${independentJoinArtifactRel()}`);
  console.log(`audit artifact=${independentJoinAuditRel()}`);
  console.log("INDEPENDENT_TRAINING_JOIN_MATERIALIZED");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.stack ?? e.message : e);
  process.exitCode = 1;
});

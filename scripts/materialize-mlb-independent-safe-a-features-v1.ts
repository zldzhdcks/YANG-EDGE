/**
 * Materialize 2024 SAFE_A historical feature rows from the local source artifact.
 *
 *   npm run materialize:mlb-independent-safe-a-features-v1
 *
 * NO NETWORK. Reads historical source only. Does not build labels or train.
 */
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  independentSafeAAuditArtifactPath,
  independentSafeAAuditArtifactRel,
  independentSafeAFeatureArtifactPath,
  independentSafeAFeatureArtifactRel,
  independentSafeAHistoricalSourcePath,
  independentSafeAHistoricalSourceRel,
  materializeIndependentSafeAFeaturesV1,
  validateHistoricalSourceArtifact,
} from "../src/lib/mlb/independent-safe-a-v1";

async function writeJsonAtomic(filePath: string, value: unknown): Promise<void> {
  const tmp = `${filePath}.tmp`;
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(tmp, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(tmp, filePath);
}

async function main(): Promise<void> {
  console.log("=== Materialize MLB Independent SAFE_A Features v1 ===");
  const sourcePath = independentSafeAHistoricalSourcePath();
  const raw = await readFile(sourcePath, "utf8");
  const source = JSON.parse(raw);
  validateHistoricalSourceArtifact(source);

  const result = materializeIndependentSafeAFeaturesV1(source, {
    sourcePath: independentSafeAHistoricalSourceRel(),
  });

  await writeJsonAtomic(independentSafeAFeatureArtifactPath(), result.artifact);
  await writeJsonAtomic(independentSafeAAuditArtifactPath(), result.audit);

  console.log(`sourceRows=${result.audit.sourceRowCount}`);
  console.log(`FEATURE_ROWS_CREATED=${result.audit.featureRowCount}`);
  console.log(`excludedTargetCount=${result.audit.excludedTargetCount}`);
  console.log(
    `officialDateRange=${result.audit.firstOfficialDate}..${result.audit.lastOfficialDate}`,
  );
  console.log(`statusDistribution=${JSON.stringify(result.audit.statusDistribution)}`);
  console.log(
    `exclusionReasonCounts=${JSON.stringify(result.audit.exclusionReasonCounts)}`,
  );
  console.log(`unusualProvenance=${JSON.stringify(result.audit.unusualProvenance)}`);
  console.log(`DATASET_READY=false`);
  console.log(`INDEPENDENT_MODEL_SAMPLE=0`);
  console.log(`feature artifact=${independentSafeAFeatureArtifactRel()}`);
  console.log(`audit artifact=${independentSafeAAuditArtifactRel()}`);
  console.log("SAFE_A_FEATURES_MATERIALIZED");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.stack ?? e.message : e);
  process.exitCode = 1;
});

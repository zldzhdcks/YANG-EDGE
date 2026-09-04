/**
 * Materialize 2024 TRAIN+VALIDATION SAFE_A subset for multi-season
 * stability input. LOCAL ONLY. Streaming extract. Holdout Feature
 * objects are never JSON.parse'd. No statistics. No labels. No model.
 *
 *   npm run materialize:mlb-independent-2024-development-safe-a
 */
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { independentSafeAFeatureArtifactPath } from "../src/lib/mlb/independent-safe-a-v1/historical-source";
import { independentSplitArtifactPath } from "../src/lib/mlb/independent-split-v1";
import {
  MLB_INDEPENDENT_2024_SEALED_SAFE_A_SHA256,
  MLB_INDEPENDENT_2024_SEALED_SPLIT_MANIFEST_SHA256,
  extract2024DevelopmentSafeAFromBytes,
  hashMultiseasonStabilityBytes,
  independent2024DevelopmentSafeASubsetAuditPath,
  independent2024DevelopmentSafeASubsetAuditRel,
  independent2024DevelopmentSafeASubsetPath,
  independent2024DevelopmentSafeASubsetRel,
  serializeMultiseasonStabilityJson,
} from "../src/lib/mlb/independent-multiseason-stability-v1";

async function writeJsonAtomic(filePath: string, value: unknown): Promise<void> {
  const tmp = `${filePath}.tmp`;
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(tmp, serializeMultiseasonStabilityJson(value), "utf8");
  await rename(tmp, filePath);
}

async function main(): Promise<void> {
  console.log("=== Materialize 2024 Development-Visible SAFE_A Subset ===");
  const featurePath = independentSafeAFeatureArtifactPath();
  const splitPath = independentSplitArtifactPath();
  const featureBytes = await readFile(featurePath);
  const featureSha256 = hashMultiseasonStabilityBytes(featureBytes);
  if (featureSha256 !== MLB_INDEPENDENT_2024_SEALED_SAFE_A_SHA256) {
    throw new Error(
      `FEATURE_SHA_PIN_MISMATCH expected ${MLB_INDEPENDENT_2024_SEALED_SAFE_A_SHA256} got ${featureSha256}`,
    );
  }

  const split = JSON.parse((await readFile(splitPath)).toString("utf8"));
  const result = extract2024DevelopmentSafeAFromBytes(featureBytes, split, {
    expectedFeatureSha256: featureSha256,
    expectedSplitManifestHash: MLB_INDEPENDENT_2024_SEALED_SPLIT_MANIFEST_SHA256,
  });

  if (result.audit.developmentRowsOutput !== 1946) {
    throw new Error(`DEVELOPMENT_ROWS_OUTPUT ${result.audit.developmentRowsOutput} != 1946`);
  }
  if (result.audit.holdoutRowsSkippedWithoutFeatureParse !== 483) {
    throw new Error("HOLDOUT skip count != 483");
  }
  if (result.audit.holdoutFeatureObjectsParsed !== 0) {
    throw new Error("HOLDOUT_FEATURE_OBJECTS_PARSED != 0");
  }
  if (result.audit.fullArtifactJsonParsed !== false) {
    throw new Error("fullArtifactJsonParsed must be false");
  }

  await writeJsonAtomic(independent2024DevelopmentSafeASubsetPath(), result.artifact);
  await writeJsonAtomic(independent2024DevelopmentSafeASubsetAuditPath(), result.audit);

  const featureAfter = hashMultiseasonStabilityBytes(await readFile(featurePath));
  if (featureAfter !== MLB_INDEPENDENT_2024_SEALED_SAFE_A_SHA256) {
    throw new Error("FULL_2024_SAFE_A_UNCHANGED = FAIL");
  }

  console.log("FEATURE_SHA_PIN_MATCH=PASS");
  console.log(`splitManifestHash=${result.audit.splitManifestHash}`);
  console.log(`FULL_FEATURE_ROWS_SEALED=${result.audit.fullFeatureRowsSealed}`);
  console.log(`TRAIN_MEMBERSHIP=${result.audit.trainMembership}`);
  console.log(`VALIDATION_MEMBERSHIP=${result.audit.validationMembership}`);
  console.log(`DEVELOPMENT_MEMBERSHIP=${result.audit.developmentMembership}`);
  console.log(`HOLDOUT_MEMBERSHIP=${result.audit.holdoutMembership}`);
  console.log(`DEVELOPMENT_ROWS_OUTPUT=${result.audit.developmentRowsOutput}`);
  console.log(`HOLDOUT_ROWS_SKIPPED=${result.audit.holdoutRowsSkippedWithoutFeatureParse}`);
  console.log(`holdoutFeatureObjectsParsed=${result.audit.holdoutFeatureObjectsParsed}`);
  console.log(`fullArtifactJsonParsed=${result.audit.fullArtifactJsonParsed}`);
  console.log(`FEATURE_HASH_VERIFIED_COUNT=${result.audit.featureHashVerifiedCount}`);
  console.log(`subsetSha256=${result.audit.subsetArtifactSha256}`);
  console.log("FULL_2024_SAFE_A_UNCHANGED=PASS");
  console.log("STABILITY_STATISTICS_CALCULATED=NO");
  console.log("NETWORK_USED=NO");
  console.log(`subset=${independent2024DevelopmentSafeASubsetRel()}`);
  console.log(`audit=${independent2024DevelopmentSafeASubsetAuditRel()}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.stack ?? e.message : e);
  process.exitCode = 1;
});

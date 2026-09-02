/**
 * Materialize 2025 SAFE_A historical feature rows from the sealed
 * external-replication source. LOCAL ONLY. No labels. No model.
 *
 *   npm run materialize:mlb-independent-external-replication-safe-a-2025
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  MLB_INDEPENDENT_2025_SEALED_SOURCE_SHA256,
  independentExternalReplication2025FeatureAuditPath,
  independentExternalReplication2025FeatureAuditRel,
  independentExternalReplication2025FeaturePath,
  independentExternalReplication2025FeatureRel,
  independentExternalReplication2025SourcePath,
  independentExternalReplication2025SourceRel,
  materializeExternalReplicationSafeAFeatures2025,
  serializeExternalReplicationJson,
  validateExternalReplicationSourceArtifact2025,
} from "../src/lib/mlb/independent-external-replication-v1";

async function writeJsonAtomic(filePath: string, value: unknown): Promise<void> {
  const tmp = `${filePath}.tmp`;
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(tmp, serializeExternalReplicationJson(value), "utf8");
  await rename(tmp, filePath);
}

async function main(): Promise<void> {
  console.log("=== Materialize MLB Independent External Replication SAFE_A 2025 ===");
  const sourcePath = independentExternalReplication2025SourcePath();
  const raw = await readFile(sourcePath);
  const sourceSha256 = createHash("sha256").update(raw).digest("hex");
  if (sourceSha256 !== MLB_INDEPENDENT_2025_SEALED_SOURCE_SHA256) {
    throw new Error(
      `SOURCE_SHA_PIN_MISMATCH expected ${MLB_INDEPENDENT_2025_SEALED_SOURCE_SHA256} got ${sourceSha256}`,
    );
  }
  const source = JSON.parse(raw.toString("utf8"));
  validateExternalReplicationSourceArtifact2025(source);

  const result = materializeExternalReplicationSafeAFeatures2025(source, {
    sourcePath: independentExternalReplication2025SourceRel(),
    expectedSourceSha256: sourceSha256,
  });

  if (result.audit.sourceRowCount !== 2430) {
    throw new Error(`SOURCE_ROW_COUNT ${result.audit.sourceRowCount} != 2430`);
  }
  if (result.audit.featureRowCount !== 2430) {
    throw new Error(
      `FEATURE_ROW_COUNT ${result.audit.featureRowCount} != 2430 excluded=${JSON.stringify(result.excluded)}`,
    );
  }
  if (result.audit.excludedTargetCount !== 0) {
    throw new Error(`EXCLUDED_TARGET_COUNT ${result.audit.excludedTargetCount}`);
  }
  if (!result.audit.finalRollingStateMatchesSource) {
    throw new Error("FINAL_ROLLING_STATE_MATCHES_SOURCE = FAIL");
  }

  await writeJsonAtomic(independentExternalReplication2025FeaturePath(), result.artifact);
  await writeJsonAtomic(independentExternalReplication2025FeatureAuditPath(), result.audit);

  console.log(`SOURCE_SHA_PIN_MATCH=PASS`);
  console.log(`sourceRows=${result.audit.sourceRowCount}`);
  console.log(`FEATURE_ROWS_CREATED=${result.audit.featureRowCount}`);
  console.log(`excludedTargetCount=${result.audit.excludedTargetCount}`);
  console.log(
    `officialDateRange=${result.audit.firstOfficialDate}..${result.audit.lastOfficialDate}`,
  );
  console.log(`doubleHeaderGameCount=${result.audit.doubleHeaderGameCount}`);
  console.log(`resolvedCrossDateResumeCount=${result.audit.resolvedCrossDateResumeCount}`);
  console.log(`taintedTeamCount=${result.audit.taintedTeamCount}`);
  console.log(`teamRollingMismatchCount=${result.audit.teamRollingMismatchCount}`);
  console.log(`FINAL_ROLLING_STATE_MATCHES_SOURCE=PASS`);
  console.log(`featureArtifactSha256=${result.audit.featureArtifactSha256}`);
  console.log(`feature artifact=${independentExternalReplication2025FeatureRel()}`);
  console.log(`audit artifact=${independentExternalReplication2025FeatureAuditRel()}`);
  console.log("modelEvaluated=false");
  console.log("EXTERNAL_REPLICATION_2025_SAFE_A_MATERIALIZED");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.stack ?? e.message : e);
  process.exitCode = 1;
});

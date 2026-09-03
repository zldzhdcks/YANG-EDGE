/**
 * Materialize 2023 SAFE_A historical feature rows from the sealed
 * multi-season development source. LOCAL ONLY. No labels. No model. No network.
 *
 *   npm run materialize:mlb-independent-multiseason-safe-a-2023
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  MLB_INDEPENDENT_2023_SEALED_SOURCE_SHA256,
  independentMultiseasonDevelopment2023FeatureAuditPath,
  independentMultiseasonDevelopment2023FeatureAuditRel,
  independentMultiseasonDevelopment2023FeaturePath,
  independentMultiseasonDevelopment2023FeatureRel,
  independentMultiseasonDevelopment2023SourcePath,
  independentMultiseasonDevelopment2023SourceRel,
  materializeMultiseasonDevelopmentSafeAFeatures2023,
  serializeMultiseasonDevelopmentJson,
  validateMultiseasonDevelopmentSourceArtifact2023,
} from "../src/lib/mlb/independent-multiseason-development-v1";

async function writeJsonAtomic(filePath: string, value: unknown): Promise<void> {
  const tmp = `${filePath}.tmp`;
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(tmp, serializeMultiseasonDevelopmentJson(value), "utf8");
  await rename(tmp, filePath);
}

async function main(): Promise<void> {
  console.log("=== Materialize MLB Independent Multi-Season Development SAFE_A 2023 ===");
  const sourcePath = independentMultiseasonDevelopment2023SourcePath();
  const raw = await readFile(sourcePath);
  const sourceSha256 = createHash("sha256").update(raw).digest("hex");
  if (sourceSha256 !== MLB_INDEPENDENT_2023_SEALED_SOURCE_SHA256) {
    throw new Error(
      `SOURCE_SHA_PIN_MISMATCH expected ${MLB_INDEPENDENT_2023_SEALED_SOURCE_SHA256} got ${sourceSha256}`,
    );
  }
  const source = JSON.parse(raw.toString("utf8"));
  validateMultiseasonDevelopmentSourceArtifact2023(source);

  const result = materializeMultiseasonDevelopmentSafeAFeatures2023(source, {
    sourcePath: independentMultiseasonDevelopment2023SourceRel(),
    expectedSourceSha256: sourceSha256,
  });

  if (result.audit.sourceRowCount !== source.rowCount) {
    throw new Error(
      `SOURCE_ROW_COUNT ${result.audit.sourceRowCount} != ${source.rowCount}`,
    );
  }
  if (result.audit.featureRowCount !== source.rowCount) {
    throw new Error(
      `FEATURE_ROW_COUNT ${result.audit.featureRowCount} != ${source.rowCount} excluded=${JSON.stringify(result.excluded)}`,
    );
  }
  if (source.rowCount !== 2430) {
    throw new Error(`unexpected sealed 2023 source.rowCount=${source.rowCount}`);
  }
  if (result.audit.excludedCount !== 0) {
    throw new Error(`EXCLUDED_FEATURE_ROW_COUNT ${result.audit.excludedCount}`);
  }
  if (!result.audit.finalRollingStateMatchesSource) {
    throw new Error("ROLLING_TEAM_RECONCILIATION = FAIL");
  }

  await writeJsonAtomic(
    independentMultiseasonDevelopment2023FeaturePath(),
    result.artifact,
  );
  await writeJsonAtomic(
    independentMultiseasonDevelopment2023FeatureAuditPath(),
    result.audit,
  );

  console.log("SOURCE_SHA_PIN_MATCH=PASS");
  console.log(`NETWORK_USED=NO`);
  console.log(`sourceRows=${result.audit.sourceRowCount}`);
  console.log(`FEATURE_ROWS_CREATED=${result.audit.featureRowCount}`);
  console.log(`EXCLUDED_FEATURE_ROW_COUNT=${result.audit.excludedCount}`);
  console.log(
    `officialDateRange=${result.audit.firstOfficialDate}..${result.audit.lastOfficialDate}`,
  );
  console.log(`DOUBLEHEADER_GAME_COUNT=${result.audit.doubleHeaderGameCount}`);
  console.log(`resolvedCrossDateResumeCount=${result.audit.resolvedCrossDateResumeCount}`);
  console.log(`taintedTeamCount=${result.audit.taintedTeamCount}`);
  console.log(`teamRollingMismatchCount=${result.audit.teamRollingMismatchCount}`);
  console.log("ROLLING_TEAM_RECONCILIATION=PASS");
  console.log(`featureHashVerifiedCount=${result.audit.featureHashVerifiedCount}`);
  console.log(`2023_SAFE_A_FEATURE_SHA256=${result.audit.featureArtifactSha256}`);
  console.log(`feature artifact=${independentMultiseasonDevelopment2023FeatureRel()}`);
  console.log(`audit artifact=${independentMultiseasonDevelopment2023FeatureAuditRel()}`);
  console.log("labelsCreated=false");
  console.log("joinCreated=false");
  console.log("modelEvaluated=false");
  console.log("2023_MULTI_SEASON_DEVELOPMENT_SAFE_A_MATERIALIZED");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.stack ?? e.message : e);
  process.exitCode = 1;
});

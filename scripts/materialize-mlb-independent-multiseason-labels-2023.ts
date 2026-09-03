/**
 * Materialize 2023 HOME_WIN labels from the sealed multi-season
 * development source. LOCAL ONLY. Source-only. No SAFE_A I/O during
 * derivation. No join. No model.
 *
 *   npm run materialize:mlb-independent-multiseason-labels-2023
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  MLB_INDEPENDENT_2023_COEXISTING_SAFE_A_FEATURE_SHA256,
  MLB_INDEPENDENT_2023_LABEL_SOURCE_SHA256,
  independentMultiseasonDevelopment2023LabelAuditPath,
  independentMultiseasonDevelopment2023LabelAuditRel,
  independentMultiseasonDevelopment2023LabelPath,
  independentMultiseasonDevelopment2023LabelRel,
  independentMultiseasonDevelopment2023SourcePath,
  independentMultiseasonDevelopment2023SourceRel,
  materializeMultiseasonDevelopmentLabels2023,
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
  console.log("=== Materialize MLB Independent Multi-Season Development Labels 2023 ===");
  const sourcePath = independentMultiseasonDevelopment2023SourcePath();
  const raw = await readFile(sourcePath);
  const sourceSha256 = createHash("sha256").update(raw).digest("hex");
  if (sourceSha256 !== MLB_INDEPENDENT_2023_LABEL_SOURCE_SHA256) {
    throw new Error(
      `SOURCE_SHA_PIN_MISMATCH expected ${MLB_INDEPENDENT_2023_LABEL_SOURCE_SHA256} got ${sourceSha256}`,
    );
  }
  const source = JSON.parse(raw.toString("utf8"));
  validateMultiseasonDevelopmentSourceArtifact2023(source);

  const result = materializeMultiseasonDevelopmentLabels2023(source, {
    sourcePath: independentMultiseasonDevelopment2023SourceRel(),
    expectedSourceSha256: sourceSha256,
  });

  if (result.audit.sourceRowCount !== source.rowCount) {
    throw new Error(
      `SOURCE_ROW_COUNT ${result.audit.sourceRowCount} != ${source.rowCount}`,
    );
  }
  if (result.audit.labelRowCount !== source.rowCount) {
    throw new Error(
      `LABEL_ROW_COUNT ${result.audit.labelRowCount} != ${source.rowCount} excluded=${JSON.stringify(result.excluded)}`,
    );
  }
  if (source.rowCount !== 2430) {
    throw new Error(`unexpected sealed 2023 source.rowCount=${source.rowCount}`);
  }
  if (result.audit.excludedRowCount !== 0) {
    throw new Error(`EXCLUDED_LABEL_ROW_COUNT ${result.audit.excludedRowCount}`);
  }
  const home = result.audit.winnerDistribution.HOME;
  const away = result.audit.winnerDistribution.AWAY;
  if (home + away !== source.rowCount) {
    throw new Error(`HOME+AWAY ${home}+${away} != ${source.rowCount}`);
  }
  if (result.audit.identityMismatchCount !== 0) {
    throw new Error(
      `SOURCE_LABEL_IDENTITY_MISMATCH_COUNT ${result.audit.identityMismatchCount}`,
    );
  }
  if (result.audit.winnerTargetMismatchCount !== 0) {
    throw new Error(
      `WINNER_TARGET_MISMATCH_COUNT ${result.audit.winnerTargetMismatchCount}`,
    );
  }
  if (result.audit.duplicateLabelGamePkCount !== 0) {
    throw new Error(
      `DUPLICATE_LABEL_GAME_PK_COUNT ${result.audit.duplicateLabelGamePkCount}`,
    );
  }
  if (result.audit.featureArtifactRead !== false) {
    throw new Error("FEATURE_ARTIFACT_READ must be false");
  }
  if (result.audit.joinCreated !== false) {
    throw new Error("JOIN_CREATED must be false");
  }

  await writeJsonAtomic(
    independentMultiseasonDevelopment2023LabelPath(),
    result.artifact,
  );
  await writeJsonAtomic(
    independentMultiseasonDevelopment2023LabelAuditPath(),
    result.audit,
  );

  const featureBytes = await readFile(
    path.join(
      process.cwd(),
      "data/research/mlb/independent-model-v1/multi-season-development/2023/features/2023-safe-a-feature-artifact-v1.json",
    ),
  );
  const featureSha256 = createHash("sha256").update(featureBytes).digest("hex");
  if (featureSha256 !== MLB_INDEPENDENT_2023_COEXISTING_SAFE_A_FEATURE_SHA256) {
    throw new Error(
      `2023_SAFE_A_UNCHANGED FAIL expected ${MLB_INDEPENDENT_2023_COEXISTING_SAFE_A_FEATURE_SHA256} got ${featureSha256}`,
    );
  }

  console.log("SOURCE_SHA_PIN_MATCH=PASS");
  console.log("FEATURE_ARTIFACT_READ=NO");
  console.log("NETWORK_USED=NO");
  console.log(`sourceRows=${result.audit.sourceRowCount}`);
  console.log(`LABEL_ROWS_CREATED=${result.audit.labelRowCount}`);
  console.log(`excludedRowCount=${result.audit.excludedRowCount}`);
  console.log(`HOME_WIN_LABEL_COUNT=${home}`);
  console.log(`AWAY_WIN_LABEL_COUNT=${away}`);
  console.log(`HOME_WIN_RATE=${result.audit.homeWinRate}`);
  console.log(`targetDistribution=${JSON.stringify(result.audit.targetDistribution)}`);
  console.log(`uniqueGamePk=${result.audit.uniqueGamePk}`);
  console.log(`duplicateLabelGamePkCount=${result.audit.duplicateLabelGamePkCount}`);
  console.log(`identityMismatchCount=${result.audit.identityMismatchCount}`);
  console.log(`winnerTargetMismatchCount=${result.audit.winnerTargetMismatchCount}`);
  console.log(`labelArtifactSha256=${result.audit.labelArtifactSha256}`);
  console.log("2023_SAFE_A_UNCHANGED=PASS");
  console.log(`label artifact=${independentMultiseasonDevelopment2023LabelRel()}`);
  console.log(`audit artifact=${independentMultiseasonDevelopment2023LabelAuditRel()}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.stack ?? e.message : e);
  process.exitCode = 1;
});

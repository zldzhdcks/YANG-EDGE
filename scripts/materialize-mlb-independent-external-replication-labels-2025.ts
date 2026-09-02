/**
 * Materialize 2025 HOME_WIN labels from the sealed external-replication source.
 * LOCAL ONLY. Source-only. No SAFE_A I/O. No join. No model.
 *
 *   npm run materialize:mlb-independent-external-replication-labels-2025
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  MLB_INDEPENDENT_2025_SEALED_SOURCE_SHA256,
  independentExternalReplication2025LabelAuditPath,
  independentExternalReplication2025LabelAuditRel,
  independentExternalReplication2025LabelPath,
  independentExternalReplication2025LabelRel,
  independentExternalReplication2025SourcePath,
  independentExternalReplication2025SourceRel,
  materializeExternalReplicationLabels2025,
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
  console.log("=== Materialize MLB Independent External Replication Labels 2025 ===");
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

  const result = materializeExternalReplicationLabels2025(source, {
    sourcePath: independentExternalReplication2025SourceRel(),
    expectedSourceSha256: sourceSha256,
  });

  if (result.audit.sourceRowCount !== 2430) {
    throw new Error(`SOURCE_ROW_COUNT ${result.audit.sourceRowCount} != 2430`);
  }
  if (result.audit.labelRowCount !== 2430) {
    throw new Error(
      `LABEL_ROW_COUNT ${result.audit.labelRowCount} != 2430 excluded=${JSON.stringify(result.excluded)}`,
    );
  }
  if (result.audit.excludedRowCount !== 0) {
    throw new Error(`EXCLUDED_ROW_COUNT ${result.audit.excludedRowCount}`);
  }
  const home = result.audit.winnerDistribution.HOME;
  const away = result.audit.winnerDistribution.AWAY;
  if (home + away !== 2430) {
    throw new Error(`HOME+AWAY ${home}+${away} != 2430`);
  }
  if (result.audit.sourceIdentityMismatch !== 0) {
    throw new Error(`SOURCE_IDENTITY_MISMATCH_COUNT ${result.audit.sourceIdentityMismatch}`);
  }

  await writeJsonAtomic(independentExternalReplication2025LabelPath(), result.artifact);
  await writeJsonAtomic(independentExternalReplication2025LabelAuditPath(), result.audit);

  console.log("SOURCE_SHA_PIN_MATCH=PASS");
  console.log(`sourceRows=${result.audit.sourceRowCount}`);
  console.log(`LABEL_ROWS_CREATED=${result.audit.labelRowCount}`);
  console.log(`excludedRowCount=${result.audit.excludedRowCount}`);
  console.log(`HOME_WIN_COUNT=${home}`);
  console.log(`AWAY_WIN_COUNT=${away}`);
  console.log(`targetDistribution=${JSON.stringify(result.audit.targetDistribution)}`);
  console.log(`uniqueGamePk=${result.audit.uniqueGamePk}`);
  console.log(`duplicateGamePk=${result.audit.duplicateGamePk}`);
  console.log(`sourceIdentityMismatch=${result.audit.sourceIdentityMismatch}`);
  console.log(`labelArtifactSha256=${result.audit.labelArtifactSha256}`);
  console.log(`label artifact=${independentExternalReplication2025LabelRel()}`);
  console.log(`audit artifact=${independentExternalReplication2025LabelAuditRel()}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.stack ?? e.message : e);
  process.exitCode = 1;
});

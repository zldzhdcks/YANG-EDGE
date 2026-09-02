/**
 * Materialize 2024 Independent HOME_WIN labels from the local historical source.
 *
 *   npm run materialize:mlb-independent-labels-v1
 *
 * NO NETWORK. Reads historical source only. Does not read/write features, join, or train.
 */
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  independentLabelArtifactPath,
  independentLabelArtifactRel,
  independentLabelAuditPath,
  independentLabelAuditRel,
  materializeIndependentLabelsV1,
} from "../src/lib/mlb/independent-label-v1";
import {
  independentSafeAHistoricalSourcePath,
  independentSafeAHistoricalSourceRel,
  validateHistoricalSourceArtifact,
} from "../src/lib/mlb/independent-safe-a-v1/historical-source";

async function writeJsonAtomic(filePath: string, value: unknown): Promise<void> {
  const tmp = `${filePath}.tmp`;
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(tmp, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(tmp, filePath);
}

async function main(): Promise<void> {
  console.log("=== Materialize MLB Independent HOME_WIN Labels v1 ===");
  const sourcePath = independentSafeAHistoricalSourcePath();
  const raw = await readFile(sourcePath, "utf8");
  const source = JSON.parse(raw);
  validateHistoricalSourceArtifact(source);

  const result = materializeIndependentLabelsV1(source, {
    sourcePath: independentSafeAHistoricalSourceRel(),
  });

  await writeJsonAtomic(independentLabelArtifactPath(), result.artifact);
  await writeJsonAtomic(independentLabelAuditPath(), result.audit);

  console.log(`sourceRows=${result.audit.sourceRows}`);
  console.log(`LABEL_ROWS_CREATED=${result.audit.labelRows}`);
  console.log(`excludedRows=${result.audit.excludedRows}`);
  console.log(`winnerDistribution=${JSON.stringify(result.audit.winnerDistribution)}`);
  console.log(`targetDistribution=${JSON.stringify(result.audit.targetDistribution)}`);
  console.log(
    `exclusionReasonCounts=${JSON.stringify(result.audit.exclusionReasonCounts)}`,
  );
  console.log(`resumeLabelCases=${JSON.stringify(result.audit.resumeLabelCases)}`);
  console.log(`cancelled=${JSON.stringify(result.audit.cancelled)}`);
  console.log(`DATASET_READY=false`);
  console.log(`INDEPENDENT_MODEL_SAMPLE=0`);
  console.log(`label artifact=${independentLabelArtifactRel()}`);
  console.log(`audit artifact=${independentLabelAuditRel()}`);
  console.log("INDEPENDENT_LABELS_MATERIALIZED");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.stack ?? e.message : e);
  process.exitCode = 1;
});

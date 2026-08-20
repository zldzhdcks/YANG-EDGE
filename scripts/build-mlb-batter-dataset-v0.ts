/**
 * Build MLB Batter Dataset v0 (research only).
 *
 * Default: cache-only, no Stats API network.
 * Completed slates cannot be backfilled from live season aggregates.
 *
 *   npx tsx scripts/build-mlb-batter-dataset-v0.ts 2026-08-20
 *   npx tsx scripts/build-mlb-batter-dataset-v0.ts 2026-08-21 --fetch
 */
import { access, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  assertBatterDatasetIntegrity,
  buildBatterDatasetV0,
  mlbBatterDatasetAbs,
} from "../src/lib/mlb/batter-dataset-v0";

const DATE =
  process.argv.find((a) => /^\d{4}-\d{2}-\d{2}$/.test(a)) ??
  process.env.MLB_TARGET_DATE_KST?.trim() ??
  "2026-08-20";
const ALLOW_NETWORK = process.argv.includes("--fetch");
const FORCE = process.argv.includes("--force");
const generatedAtArg = process.argv
  .find((a) => a.startsWith("--generated-at="))
  ?.slice("--generated-at=".length);

async function exists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const out = mlbBatterDatasetAbs(DATE);
  if (!FORCE && (await exists(out))) {
    process.stdout.write(`IMMUTABLE: exists — skip overwrite ${out}\n`);
    return;
  }

  const generatedAt = generatedAtArg || new Date().toISOString();
  const { document, predictionHash } = await buildBatterDatasetV0({
    dateKst: DATE,
    generatedAt,
    allowNetwork: ALLOW_NETWORK,
  });

  const errors = assertBatterDatasetIntegrity(document);
  if (errors.length > 0) {
    throw new Error(`integrity: ${errors.join("; ")}`);
  }

  await mkdir(path.dirname(out), { recursive: true });
  await writeFile(out, `${JSON.stringify(document, null, 2)}\n`, "utf8");
  process.stdout.write(
    `Wrote ${out} games=${document.summary.totalGames} slots=${document.summary.totalBatterSlots} safety=${document.meta.reconstructionSafety} network=${document.meta.networkCalls} predHash=${predictionHash.slice(0, 16)}\n`,
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});

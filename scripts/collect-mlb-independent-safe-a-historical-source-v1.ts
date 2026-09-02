/**
 * Collect 2024 MLB Regular Season historical source from Official MLB Stats API.
 *
 *   npm run collect:mlb-independent-safe-a-historical-source-v1
 *
 * Network allowed. Official MLB Stats API only.
 */
import { mkdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  collectMlbIndependentSafeAHistoricalSourceV1,
  independentSafeAHistoricalSourcePath,
  independentSafeAHistoricalSourceRel,
} from "../src/lib/mlb/independent-safe-a-v1";

async function writeJsonAtomic(filePath: string, value: unknown): Promise<void> {
  const tmp = `${filePath}.tmp`;
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(tmp, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(tmp, filePath);
}

async function main(): Promise<void> {
  console.log("=== Collect MLB Independent SAFE_A Historical Source v1 ===");
  const { artifact, usage } = await collectMlbIndependentSafeAHistoricalSourceV1();
  const filePath = independentSafeAHistoricalSourcePath();
  await writeJsonAtomic(filePath, artifact);

  const dates = artifact.games.map((g) => g.officialDate).sort();
  console.log(`source=MLB_STATS_API season=2024 gameType=R`);
  console.log(`query=${artifact.query}`);
  console.log(`rowCount=${artifact.rowCount}`);
  console.log(`collapsedSameGamePkCount=${artifact.collapsedSameGamePkCount}`);
  console.log(`officialDateRange=${dates[0] ?? "none"}..${dates[dates.length - 1] ?? "none"}`);
  console.log(
    `cache rawHit/miss=${usage.rawHit}/${usage.rawMiss} network=${usage.networkCalls}`,
  );
  console.log(`artifact path=${independentSafeAHistoricalSourceRel()}`);
  console.log("SAFE_A_HISTORICAL_SOURCE_COLLECTED");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.stack ?? e.message : e);
  process.exitCode = 1;
});

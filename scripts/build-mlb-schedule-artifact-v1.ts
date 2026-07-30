/**
 * Build MLB Schedule Artifact v1 for a KST date.
 *
 *   npm run research:mlb-schedule -- YYYY-MM-DD
 *   npx tsx --env-file=.env.local scripts/build-mlb-schedule-artifact-v1.ts [YYYY-MM-DD]
 */
import { saveMlbScheduleArtifactV1 } from "../src/lib/mlb/build-mlb-schedule-artifact";

const DATE =
  process.argv[2]?.trim() ||
  process.env.MLB_TARGET_DATE_KST?.trim() ||
  "";

async function main() {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(DATE)) {
    console.error("Usage: npm run research:mlb-schedule -- YYYY-MM-DD");
    process.exitCode = 1;
    return;
  }

  console.log(`=== Build MLB Schedule Artifact v1 (${DATE}) ===`);
  const { document, pathRel, usage } = await saveMlbScheduleArtifactV1(DATE);
  console.log(`date=${DATE}`);
  console.log(`schedule games count=${document.summary.totalGames}`);
  console.log(
    `cache rawHit/miss=${usage.rawHit}/${usage.rawMiss} network=${usage.networkCalls}`,
  );
  console.log(`artifact path=${pathRel}`);
  console.log("MLB_SCHEDULE_ARTIFACT_V1_CREATED");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});

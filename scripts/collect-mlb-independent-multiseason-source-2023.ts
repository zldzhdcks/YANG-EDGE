/**
 * Collect 2023 MLB Regular Season historical source for the multi-season
 * development track. Official MLB Stats API only. No features, labels,
 * join, or model evaluation.
 *
 *   npm run collect:mlb-independent-multiseason-source-2023
 */
import { mkdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  collectMlbIndependentMultiseasonSource2023,
  independentMultiseasonDevelopment2023AuditPath,
  independentMultiseasonDevelopment2023AuditRel,
  independentMultiseasonDevelopment2023SourcePath,
  independentMultiseasonDevelopment2023SourceRel,
  serializeMultiseasonDevelopmentJson,
} from "../src/lib/mlb/independent-multiseason-development-v1";

async function writeJsonAtomic(filePath: string, value: unknown): Promise<void> {
  const tmp = `${filePath}.tmp`;
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(tmp, serializeMultiseasonDevelopmentJson(value), "utf8");
  await rename(tmp, filePath);
}

async function main(): Promise<void> {
  console.log("=== Collect MLB Independent Multi-Season Development Source 2023 ===");
  const {
    artifact,
    audit,
    usage,
    rawScheduleSnapshotCount,
    sourceArtifactSha256,
  } = await collectMlbIndependentMultiseasonSource2023();

  await writeJsonAtomic(independentMultiseasonDevelopment2023SourcePath(), artifact);
  await writeJsonAtomic(independentMultiseasonDevelopment2023AuditPath(), audit);

  const c = audit.completeness;
  console.log(`source=${artifact.source} season=${artifact.season} gameType=${artifact.gameType}`);
  console.log(`track=${artifact.track} developmentEvidence=${artifact.developmentEvidence}`);
  console.log(`query=${artifact.query}`);
  console.log(`RAW_SCHEDULE_SNAPSHOT_COUNT=${rawScheduleSnapshotCount}`);
  console.log(`FINAL_UNIQUE_GAME_PK_COUNT=${c.uniqueFinalGamePkCount}`);
  console.log(`COLLAPSED_SAME_GAME_PK_COUNT=${c.collapsedDuplicateSnapshotCount}`);
  console.log(
    `status FINAL_STANDARD=${c.statusCounts.FINAL_STANDARD} POSTPONED=${c.statusCounts.POSTPONED} CANCELLED=${c.statusCounts.CANCELLED} SUSPENDED=${c.statusCounts.SUSPENDED} UNKNOWN=${c.statusCounts.UNKNOWN} OTHER=${c.statusCounts.OTHER}`,
  );
  console.log(
    `provenance STANDARD=${c.provenanceCounts.STANDARD} CROSS_DATE_RESUME_RESOLVED=${c.provenanceCounts.CROSS_DATE_RESUME_RESOLVED} UNPROVEN_COMPLETION=${c.provenanceCounts.UNPROVEN_COMPLETION} NOT_APPLICABLE=${c.provenanceCounts.NOT_APPLICABLE}`,
  );
  console.log(
    `VALID_NON_TIED_FINAL_RESULT_COUNT=${c.validNonTiedFinalResultCount} UNUSABLE_FINAL_RESULT_COUNT=${c.unusableFinalResultCount} TIED_FINAL_COUNT=${c.tiedFinalCount} INVALID_SCORE_COUNT=${c.invalidScoreCount} MISSING_SCORE_COUNT=${c.missingScoreCount}`,
  );
  console.log(`MIN_OFFICIAL_DATE=${c.minOfficialDate ?? "none"}`);
  console.log(`MAX_OFFICIAL_DATE=${c.maxOfficialDate ?? "none"}`);
  console.log(`manualReviewCount=${audit.manualReviewGames.length}`);
  console.log(`2023_SOURCE_SHA256=${sourceArtifactSha256}`);
  console.log(
    `cache rawHit/miss=${usage.rawHit}/${usage.rawMiss} network=${usage.networkCalls}`,
  );
  console.log(`artifact path=${independentMultiseasonDevelopment2023SourceRel()}`);
  console.log(`audit path=${independentMultiseasonDevelopment2023AuditRel()}`);
  console.log("modelEvaluated=false");
  console.log("2023_MULTI_SEASON_DEVELOPMENT_SOURCE_COLLECTED");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.stack ?? e.message : e);
  process.exitCode = 1;
});

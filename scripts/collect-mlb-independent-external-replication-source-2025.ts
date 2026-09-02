/**
 * Collect 2025 MLB Regular Season historical source for the external
 * replication track. Official MLB Stats API only. No features, labels,
 * join, or model evaluation.
 *
 *   npm run collect:mlb-independent-external-replication-source-2025
 */
import { mkdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  collectMlbIndependentExternalReplicationSource2025,
  independentExternalReplication2025AuditPath,
  independentExternalReplication2025AuditRel,
  independentExternalReplication2025SourcePath,
  independentExternalReplication2025SourceRel,
  serializeExternalReplicationJson,
} from "../src/lib/mlb/independent-external-replication-v1";

async function writeJsonAtomic(filePath: string, value: unknown): Promise<void> {
  const tmp = `${filePath}.tmp`;
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(tmp, serializeExternalReplicationJson(value), "utf8");
  await rename(tmp, filePath);
}

async function main(): Promise<void> {
  console.log("=== Collect MLB Independent External Replication Source 2025 ===");
  const {
    artifact,
    audit,
    usage,
    rawScheduleSnapshotCount,
    sourceArtifactSha256,
  } = await collectMlbIndependentExternalReplicationSource2025();

  await writeJsonAtomic(independentExternalReplication2025SourcePath(), artifact);
  await writeJsonAtomic(independentExternalReplication2025AuditPath(), audit);

  const c = audit.completeness;
  console.log(`source=${artifact.source} season=${artifact.season} gameType=${artifact.gameType}`);
  console.log(`query=${artifact.query}`);
  console.log(`rawScheduleSnapshotCount=${rawScheduleSnapshotCount}`);
  console.log(`uniqueFinalGamePkCount=${c.uniqueFinalGamePkCount}`);
  console.log(`collapsedSameGamePkCount=${c.collapsedDuplicateSnapshotCount}`);
  console.log(
    `status FINAL_STANDARD=${c.statusCounts.FINAL_STANDARD} POSTPONED=${c.statusCounts.POSTPONED} CANCELLED=${c.statusCounts.CANCELLED} SUSPENDED=${c.statusCounts.SUSPENDED} UNKNOWN=${c.statusCounts.UNKNOWN} OTHER=${c.statusCounts.OTHER}`,
  );
  console.log(
    `provenance STANDARD=${c.provenanceCounts.STANDARD} CROSS_DATE_RESUME_RESOLVED=${c.provenanceCounts.CROSS_DATE_RESUME_RESOLVED} UNPROVEN_COMPLETION=${c.provenanceCounts.UNPROVEN_COMPLETION} NOT_APPLICABLE=${c.provenanceCounts.NOT_APPLICABLE}`,
  );
  console.log(
    `validNonTiedFinal=${c.gamesWithValidNonTiedFinalScores} withoutUsableFinal=${c.gamesWithoutUsableFinalResult}`,
  );
  console.log(`officialDateRange=${c.minOfficialDate ?? "none"}..${c.maxOfficialDate ?? "none"}`);
  console.log(`manualReviewCount=${audit.manualReviewGames.length}`);
  console.log(`sourceSha256=${sourceArtifactSha256}`);
  console.log(
    `cache rawHit/miss=${usage.rawHit}/${usage.rawMiss} network=${usage.networkCalls}`,
  );
  console.log(`artifact path=${independentExternalReplication2025SourceRel()}`);
  console.log(`audit path=${independentExternalReplication2025AuditRel()}`);
  console.log("modelEvaluated=false");
  console.log("EXTERNAL_REPLICATION_2025_SOURCE_COLLECTED");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.stack ?? e.message : e);
  process.exitCode = 1;
});

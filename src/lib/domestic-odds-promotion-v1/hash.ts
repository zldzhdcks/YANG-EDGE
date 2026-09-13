import { createHash } from "node:crypto";
import type { StructuredOddsRowV1 } from "./types";

export function canonicalJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function sha256Text(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

export function countJoin(rows: StructuredOddsRowV1[]) {
  const counts = {
    scheduleMatched: 0,
    identityReview: 0,
    competitionReview: 0,
    teamAliasMatchedNoSchedule: 0,
    sourceUnreadable: 0,
    excludedNonTargetDate: 0,
    extractedRows: rows.length,
    oddsParsedRows: 0,
    unreadableRows: 0,
    predictionEligible: 0,
    predictionRejected: 0,
    targetDateRows: 0,
  };
  for (const row of rows) {
    if (row.targetDateKst === row.operatingDateKst) counts.targetDateRows += 1;
    if (row.extractionStatus === "PARSED") counts.oddsParsedRows += 1;
    if (row.extractionStatus === "SOURCE_UNREADABLE") counts.unreadableRows += 1;
    if (row.joinStatus === "SCHEDULE_MATCHED") counts.scheduleMatched += 1;
    if (row.joinStatus === "IDENTITY_REVIEW_REQUIRED") counts.identityReview += 1;
    if (row.joinStatus === "COMPETITION_REVIEW_REQUIRED") {
      counts.competitionReview += 1;
    }
    if (row.joinStatus === "TEAM_ALIAS_MATCHED_NO_SCHEDULE") {
      counts.teamAliasMatchedNoSchedule += 1;
    }
    if (row.joinStatus === "SOURCE_UNREADABLE") counts.sourceUnreadable += 1;
    if (row.joinStatus === "EXCLUDED_NON_TARGET_DATE") {
      counts.excludedNonTargetDate += 1;
    }
    if (row.predictionInputAllowed) counts.predictionEligible += 1;
    else counts.predictionRejected += 1;
  }
  return counts;
}

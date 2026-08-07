/**
 * NPB Postgame Ops One-Command v0
 * Official results + market baseline + lifecycle. No prediction grades.
 */

import type { NpbDailyEvidenceDayAssessment } from "@/lib/npb/daily-evidence-continuity-v0";
import type { NpbOfficialResultsDocumentV0 } from "@/lib/npb/official-result-intake-v0";

export const NPB_POSTGAME_OPS_SCHEMA = "npb-postgame-ops-v0" as const;

export type NpbPostgameOpsStageName =
  | "PREFLIGHT"
  | "OFFICIAL_RESULT"
  | "PREGAME_JOIN"
  | "MARKET_BASELINE"
  | "DAILY_EVIDENCE_LIFECYCLE"
  | "OPERATOR_SUMMARY";

export type NpbPostgameImmutableAudit = {
  predictionRel: string;
  predictionHashFieldBefore: string | null;
  predictionHashFieldAfter: string | null;
  predictionFileSha256Before: string | null;
  predictionFileSha256After: string | null;
  predictionMtimeBefore: number | null;
  predictionMtimeAfter: number | null;
  predictionUnchanged: boolean;
};

export type NpbPostgameOpsFailure = {
  stage: NpbPostgameOpsStageName | "ORCHESTRATOR";
  reason: string;
  nextAction: string;
};

export type NpbPostgameOpsReport = {
  schemaVersion: typeof NPB_POSTGAME_OPS_SCHEMA;
  dateKst: string;
  dryRun: boolean;
  assessOnly: boolean;
  generatedAt: string;
  opsSuccess: boolean;
  stagesRun: NpbPostgameOpsStageName[];
  day: NpbDailyEvidenceDayAssessment;
  results: NpbOfficialResultsDocumentV0 | null;
  resultsWrote: boolean;
  recentDays: Array<{
    dateKst: string;
    shortDate: string;
    lifecycle: NpbDailyEvidenceDayAssessment["lifecycle"];
  }>;
  immutableAudit: NpbPostgameImmutableAudit;
  nextAction: string;
  failure: NpbPostgameOpsFailure | null;
  operatorSummaryText: string;
};

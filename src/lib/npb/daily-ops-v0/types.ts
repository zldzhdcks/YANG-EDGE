/**
 * NPB Daily Ops One-Command v0 — evidence accumulation only.
 * No Prediction Engine / picks / confidence.
 */

import type { NpbDailyEvidenceDayAssessment } from "@/lib/npb/daily-evidence-continuity-v0";
import type { NpbPregameEvidenceFreezeResult } from "@/lib/npb/pregame-evidence-snapshot-v0";

export const NPB_DAILY_OPS_SCHEMA = "npb-daily-ops-v0" as const;

export type NpbDailyOpsStageName =
  | "SCHEDULE"
  | "STARTER"
  | "ODDS"
  | "LINEUP"
  | "PREGAME_EVIDENCE"
  | "CONTINUITY_GUARD"
  | "OPERATOR_SUMMARY";

export type NpbDailyOpsFailure = {
  stage: NpbDailyOpsStageName | "ORCHESTRATOR";
  reason: string;
  nextAction: string;
  uiPath: string | null;
};

export type NpbDailyOpsReport = {
  schemaVersion: typeof NPB_DAILY_OPS_SCHEMA;
  dateKst: string;
  dryRun: boolean;
  assessOnly: boolean;
  generatedAt: string;
  opsSuccess: boolean;
  stagesRun: NpbDailyOpsStageName[];
  day: NpbDailyEvidenceDayAssessment;
  recentDays: Array<{
    dateKst: string;
    shortDate: string;
    lifecycle: NpbDailyEvidenceDayAssessment["lifecycle"];
  }>;
  freeze: NpbPregameEvidenceFreezeResult | null;
  nextAction: string;
  nextActionUi: string | null;
  failure: NpbDailyOpsFailure | null;
  operatorSummaryText: string;
  warnings: string[];
};

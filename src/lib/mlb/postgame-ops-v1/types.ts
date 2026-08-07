/**
 * MLB Postgame Ops One-Command v1 — types.
 * Orchestration / presentation only — no Engine / Prediction mutation.
 */

import type { SlateProvenanceBanner } from "@/lib/mlb/recommendation-provenance-v1";

export const MLB_POSTGAME_OPS_SCHEMA = "yang-edge-mlb-postgame-ops-v1" as const;

/** Align with Daily Ops lifecycle where possible. */
export type MlbPostgameLifecycleStatus =
  | "NOT_STARTED"
  | "PREGAME_READY"
  | "AWAITING_RESULT"
  | "REVIEW_READY"
  | "COMPLETED"
  | "NO_PREGAME_SNAPSHOT"
  | "OPS_FAILURE";

export type MlbPostgameStageName =
  | "PREFLIGHT"
  | "OFFICIAL_RESULTS"
  | "FINAL_STATUS_VERIFY"
  | "GRADE_RESEARCH"
  | "GRADE_ENGINE_RECORD"
  | "DAILY_REVIEW"
  | "GOOD_PICK_FEEDBACK"
  | "LEARNING_TRACKER"
  | "OPERATOR_SUMMARY";

export type MlbPostgameFailure = {
  stage: MlbPostgameStageName;
  reason: string;
  nextAction: string;
};

export type AllResearchScorecard = {
  totalGames: number;
  graded: number;
  correct: number;
  incorrect: number;
  pending: number;
  accuracyPercent: number | null;
  brier: number | null;
  logLoss: number | null;
};

export type EngineGoodPickRow = {
  gameId: string;
  gamePk: number | null;
  pick: string | null;
  tier: "STRONG" | "GOOD";
  probability: number | null;
  confidence: number | null;
  researchOnly: boolean;
  finalScore: string | null;
  grade: "CORRECT" | "INCORRECT" | "PENDING" | "UNKNOWN" | "INELIGIBLE";
  eligibleForRecord: boolean;
  primaryReviewCandidate: string | null;
  secondaryReviewCandidates: string[];
  whyCorrectLabels: string[];
  whyIncorrectLabels: string[];
  beforeSignals: Array<{ id: string; label: string; plain: string }>;
  afterPlain: string | null;
};

export type EngineGoodPickScorecard = {
  recordStatus: "SEALED" | "ABSENT" | "NOT_ELIGIBLE";
  recordPath: string | null;
  total: number;
  correct: number;
  incorrect: number;
  pending: number;
  accuracyPercent: number | null;
  rows: EngineGoodPickRow[];
  topSuccessCandidate: string | null;
  topFailureCandidate: string | null;
};

export type MlbPostgameImmutableAudit = {
  predictionRel: string;
  predictionHashBefore: string | null;
  predictionHashAfter: string | null;
  predictionMtimeBefore: number | null;
  predictionMtimeAfter: number | null;
  predictionUnchanged: boolean;
  recommendationRel: string | null;
  recommendationHashBefore: string | null;
  recommendationHashAfter: string | null;
  recommendationMtimeBefore: number | null;
  recommendationMtimeAfter: number | null;
  recommendationUnchanged: boolean;
};

export type MlbPostgameResultsStatus = {
  games: number;
  final: number;
  notFinal: number;
  allFinal: boolean;
};

export type MlbPostgameReport = {
  schemaVersion: typeof MLB_POSTGAME_OPS_SCHEMA;
  dateKst: string;
  dryRun: boolean;
  assessOnly: boolean;
  generatedAt: string;
  opsSuccess: boolean;
  lifecycle: MlbPostgameLifecycleStatus;
  failure: MlbPostgameFailure | null;
  provenance: SlateProvenanceBanner | null;
  resultsStatus: MlbPostgameResultsStatus | null;
  allResearch: AllResearchScorecard | null;
  engineGoodPicks: EngineGoodPickScorecard;
  dailyLearningPlain: string | null;
  researchQuestions: string[];
  trackerLine: string | null;
  immutableAudit: MlbPostgameImmutableAudit;
  operatorSummaryText: string;
  stagesRun: MlbPostgameStageName[];
  nextAction: string;
};

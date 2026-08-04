/**
 * Football Review & Scorecard Foundation v0 — contracts.
 * No Prediction / Engine / Weight connection.
 */

import type { FootballOsLevel } from "../foundation/types";

export const FOOTBALL_REVIEW_SCORECARD_FOUNDATION_VERSION =
  "football-review-scorecard-foundation-v0" as const;

export type FootballOneXTwoSide = "HOME" | "DRAW" | "AWAY";

export type FootballGradeVerdict =
  | "CORRECT"
  | "INCORRECT"
  | "GRADING_BLOCKED";

export type FootballGradeBlockReason =
  | "NOT_FINAL"
  | "VOID"
  | "POSTPONED"
  | "CANCELLED"
  | "ABANDONED"
  | "SUSPENDED"
  | "RESULT_NOT_GRADABLE"
  | "PREDICTION_SIDE_MISSING"
  | "UNSUPPORTED_MARKET"
  | null;

/** Sample lane — never mix Research observation into Official KPI. */
export type FootballSampleLane = "RESEARCH" | "OFFICIAL";

export type FootballReviewLane = "RESEARCH_REVIEW" | "OFFICIAL_REVIEW";

export type FootballOneXTwoGradeInput = {
  matchId: string;
  marketType: "MONEYLINE_3WAY_1X2";
  /** Hypothetical / fixture pick — NOT from Engine in this mission */
  predictedSide: FootballOneXTwoSide | null;
  actualSide: FootballOneXTwoSide | null;
  gradingAllowed: boolean;
  blockReason?: FootballGradeBlockReason;
  sampleLane: FootballSampleLane;
};

export type FootballOneXTwoGradeResult = {
  matchId: string;
  marketType: "MONEYLINE_3WAY_1X2";
  predictedSide: FootballOneXTwoSide | null;
  actualSide: FootballOneXTwoSide | null;
  verdict: FootballGradeVerdict;
  blockReason: FootballGradeBlockReason;
  sampleLane: FootballSampleLane;
  /** Exact 3-way match required for CORRECT */
  exactMatch: boolean | null;
};

export type FootballReviewRecordV0 = {
  schemaVersion: "football-review-v0";
  reviewLane: FootballReviewLane;
  sampleLane: FootballSampleLane;
  generatedAt: string;
  dateKst: string;
  identityVersion: string;
  resultFoundationVersion: string;
  grades: FootballOneXTwoGradeResult[];
  summary: {
    graded: number;
    correct: number;
    incorrect: number;
    blocked: number;
    /** Observation only — never labeled as official product KPI in Research lane */
    observationNote: string;
  };
  /** Official KPI fields stay null on Research lane */
  officialKpi: {
    accuracy: number | null;
    eligible: boolean;
  };
};

export type FootballThreeWayProbability = {
  home: number;
  draw: number;
  away: number;
};

export type FootballScorecardRowV0 = {
  matchId: string;
  sampleLane: FootballSampleLane;
  grade: FootballOneXTwoGradeResult;
  /** Optional observation probabilities — NOT engine output */
  probabilities: FootballThreeWayProbability | null;
  brier: number | null;
  logLoss: number | null;
  calibrationBucket: string | null;
  confidenceBucket: string | null;
  componentAlignment: "ALIGNED" | "DIVERGED" | "UNKNOWN" | "NOT_APPLICABLE";
};

export type FootballScorecardV0 = {
  schemaVersion: "football-scorecard-v0";
  sampleLane: FootballSampleLane;
  generatedAt: string;
  dateKst: string;
  foundationVersion: typeof FOOTBALL_REVIEW_SCORECARD_FOUNDATION_VERSION;
  engineImpact: "NONE";
  predictionFormulaConnected: false;
  rows: FootballScorecardRowV0[];
  metrics: {
    accuracy: number | null;
    meanBrier: number | null;
    meanLogLoss: number | null;
    gradedCount: number;
    blockedCount: number;
  };
  calibration: {
    observationOnly: true;
    buckets: { id: string; count: number; meanPredicted: number | null; hitRate: number | null }[];
  };
  confidence: {
    predictionLayerConnected: false;
    buckets: { id: string; count: number }[];
  };
  component: {
    frameworkOnly: true;
    note: string;
  };
  observationNote: string;
};

export type FootballReviewScorecardGate = {
  status: FootballOsLevel;
  stage: "NOT_STARTED" | "FOUNDATION" | "READY" | "BLOCKED";
  prediction: "NONE";
  plainLanguage: string;
  progressPercent: null;
  researchReviewReady: boolean;
  officialReviewReady: boolean;
  scorecardReady: boolean;
};

export type FootballReviewScorecardOperationSlice = {
  reviewStage: "NOT_STARTED" | "FOUNDATION" | "READY" | "BLOCKED";
  scorecardStage: "NOT_STARTED" | "FOUNDATION" | "READY" | "BLOCKED";
  prediction: "NONE";
  plainLanguage: string;
  gate: FootballReviewScorecardGate;
  sourceRefs: string[];
};

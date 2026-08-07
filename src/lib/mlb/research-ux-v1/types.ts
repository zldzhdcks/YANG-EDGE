/**
 * MLB Research UX v1 — view models only.
 * Does not mutate Prediction / Engine / Dataset / research logic.
 */

export const MLB_RESEARCH_UX_SCHEMA = "mlb-research-ux-v1" as const;

export type ResearchUxAccuracy = "CORRECT" | "INCORRECT";

export type ResearchUxCause = {
  code: string;
  label: string;
  evidence: string | null;
};

export type ResearchReviewCardModel = {
  gameId: string;
  gamePk: number | null;
  matchupLabel: string;
  /** Baseball convention: AWAY @ HOME */
  matchupLine: string;
  predictionSide: string;
  predictionTeam: string | null;
  actualSide: string;
  actualTeam: string | null;
  accuracy: ResearchUxAccuracy;
  confidencePercent: number | null;
  primary: ResearchUxCause | null;
  secondary: ResearchUxCause[];
  aiSummary: string;
  kind: "success" | "failure";
};

export type TopFailureReason = {
  rank: 1 | 2 | 3;
  medal: "🥇" | "🥈" | "🥉";
  code: string;
  label: string;
  count: number;
};

export type DailyResearchDashboardModel = {
  dateKst: string;
  totalGames: number;
  correct: number;
  incorrect: number;
  accuracyPercent: number | null;
  topFailureReasons: TopFailureReason[];
};

export type ResearchTimelinePoint = {
  dateKst: string;
  accuracyPercent: number | null;
  correct: number;
  incorrect: number;
  graded: number;
  href: string;
};

export type VersionIdentityModel = {
  predictionHash: string | null;
  researchVersion: string | null;
  reviewVersion: string | null;
  engineVersion: string | null;
};

export type MlbResearchUxView = {
  schemaVersion: typeof MLB_RESEARCH_UX_SCHEMA;
  dateKst: string;
  loaded: boolean;
  error: string | null;
  dashboard: DailyResearchDashboardModel | null;
  aiCommentary: string;
  cards: ResearchReviewCardModel[];
  timeline: ResearchTimelinePoint[];
  versions: VersionIdentityModel;
  sourcePaths: {
    daily: string | null;
    success: string | null;
    failure: string | null;
    prediction: string | null;
  };
};

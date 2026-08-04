/**
 * OS / Operation Memory view for Review & Scorecard Foundation.
 */
import {
  FOOTBALL_REVIEW_SCORECARD_FOUNDATION_VERSION,
  type FootballReviewScorecardOperationSlice,
} from "./types";

export type FootballReviewScorecardView = {
  foundationVersion: typeof FOOTBALL_REVIEW_SCORECARD_FOUNDATION_VERSION;
  dateKst: string;
  slice: FootballReviewScorecardOperationSlice;
  developer: {
    researchReviewLane: "RESEARCH_REVIEW";
    officialReviewLane: "OFFICIAL_REVIEW";
    mixForbidden: true;
    predictionFormulaConnected: false;
    engineImpact: "NONE";
    gradeMarket: "MONEYLINE_3WAY_1X2";
  };
};

/** Default: foundation contracts ready, no production graded samples. */
export function buildDefaultFootballReviewScorecardView(
  dateKst: string,
): FootballReviewScorecardView {
  const plainLanguage =
    "Football Review·Scorecard Foundation 계약이 준비됐습니다. Prediction/Engine은 연결되지 않았고, Research와 Official 표본은 분리됩니다.";

  const gate = {
    status: "WARNING" as const,
    stage: "FOUNDATION" as const,
    prediction: "NONE" as const,
    plainLanguage,
    progressPercent: null,
    researchReviewReady: true,
    officialReviewReady: true,
    scorecardReady: true,
  };

  return {
    foundationVersion: FOOTBALL_REVIEW_SCORECARD_FOUNDATION_VERSION,
    dateKst,
    slice: {
      reviewStage: "FOUNDATION",
      scorecardStage: "FOUNDATION",
      prediction: "NONE",
      plainLanguage,
      gate,
      sourceRefs: [
        "src/lib/football/review-scorecard-foundation-v0/",
        FOOTBALL_REVIEW_SCORECARD_FOUNDATION_VERSION,
      ],
    },
    developer: {
      researchReviewLane: "RESEARCH_REVIEW",
      officialReviewLane: "OFFICIAL_REVIEW",
      mixForbidden: true,
      predictionFormulaConnected: false,
      engineImpact: "NONE",
      gradeMarket: "MONEYLINE_3WAY_1X2",
    },
  };
}

export function getFootballReviewScorecardDeveloperSnapshot(dateKst: string) {
  const view = buildDefaultFootballReviewScorecardView(dateKst);
  return {
    foundationVersion: view.foundationVersion,
    reviewStage: view.slice.reviewStage,
    scorecardStage: view.slice.scorecardStage,
    prediction: view.slice.prediction,
    ...view.developer,
    plainLanguage: view.slice.plainLanguage,
  };
}

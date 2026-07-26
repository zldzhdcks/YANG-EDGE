/**
 * 예측 사후 리뷰 표시용 타입.
 * review JSON 스키마를 그대로 반영하며, 임의 값을 만들지 않는다.
 */

export type FeedbackVerdict =
  | "SIGNAL_WORKED"
  | "SIGNAL_FAILED"
  | "INCONCLUSIVE";

export type FeedbackResultStatus =
  | "graded"
  | "pending"
  | "postponed"
  | "cancelled"
  | "result-not-found";

export type FeedbackReviewItem = {
  gameId: string;
  league: string;
  match: string;
  matchDisplay: string | null;
  recommendedTeam: string;
  recommendedSide: "home" | "away" | "unknown";
  actual: {
    homeScore: number | null;
    awayScore: number | null;
    scoreline: string | null;
    winner: "home" | "away" | "draw" | null;
    winnerTeam: string | null;
    resultStatus: FeedbackResultStatus;
  };
  predictionCorrect: boolean | null;
  snapshot: {
    probability: number | null;
    edgeScore: number | null;
    confidence: number | null;
    recommendationGrade: string | null;
    marketProbability: number | null;
    valueEdge: number | null;
  };
  evidenceAtPrediction: {
    usedData: string[];
    missingData: string[];
    unavailableFactors: string[];
    dataAvailability: number | null;
    recentGameCounts: {
      home: number;
      away: number;
      minRequired: number;
    } | null;
    oddsMatched: boolean | null;
  };
  feedback: {
    verdict: FeedbackVerdict;
    hypotheses: string[];
    notes: string[];
  };
};

export type FeedbackReviewMeta = {
  version: string;
  dateKst: string;
  generatedAt: string | null;
  sourceSnapshot: string | null;
  sourceAnalysis: string | null;
  totalPredictions: number;
  gradedGames: number;
  signalWorked: number;
  signalFailed: number;
  inconclusive: number;
  liveAccuracyPercent: number | null;
  limitations: string[];
};

export type FeedbackDayReview = {
  meta: FeedbackReviewMeta;
  reviews: FeedbackReviewItem[];
};

export type FeedbackCenterData = {
  days: FeedbackDayReview[];
  /** 모든 날짜를 합친 요약 */
  summary: {
    totalPredictions: number;
    gradedGames: number;
    signalWorked: number;
    signalFailed: number;
    inconclusive: number;
    liveAccuracyPercent: number | null;
  };
};

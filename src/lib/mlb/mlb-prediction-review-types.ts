export const MLB_OFFICIAL_RESULTS_SCHEMA = "mlb-official-results-v1" as const;
export const MLB_GRADED_PREDICTIONS_SCHEMA = "mlb-graded-predictions-v1" as const;
export const MLB_SUCCESS_REVIEW_SCHEMA = "mlb-success-review-v1" as const;
export const MLB_FAILURE_REVIEW_SCHEMA = "mlb-failure-review-v1" as const;
export const MLB_DAILY_REVIEW_SUMMARY_SCHEMA =
  "mlb-daily-review-summary-v1" as const;
export const MLB_GRADING_POLICY_VERSION = "mlb-grading-v1" as const;

export type OfficialResultStatus =
  | "FINAL"
  | "NOT_FINAL"
  | "POSTPONED"
  | "CANCELLED"
  | "SUSPENDED"
  | "UNKNOWN";

export type MatchStatus =
  | "MATCHED"
  | "RESULT_NOT_FINAL"
  | "RESULT_MISSING"
  | "ID_MISMATCH"
  | "DUPLICATE_MATCH";

export type PredictionGrade =
  | "CORRECT"
  | "INCORRECT"
  | "PENDING"
  | "VOID"
  | "NO_PICK"
  | "BLOCKED"
  | "MATCH_ERROR";

export type ReviewAssessment =
  | "POSSIBLE_SUPPORT"
  | "CONSISTENT_WITH_HYPOTHESIS"
  | "INSUFFICIENT_EVIDENCE"
  | "CONFOUNDED"
  | "WEAK_SUPPORT"
  | "POSSIBLE"
  | "INVESTIGATE_MORE";

export type LeakageAuditStatus = "PASS" | "WARN" | "FAIL";

export type DailyReviewStatus =
  | "VALID_REVIEW"
  | "PARTIAL_REVIEW"
  | "AWAITING_RESULTS"
  | "RESEARCH_INVALID"
  | "EXECUTION_FAILED";

export type MlbOfficialResultGame = {
  gamePk: number;
  internalGameId: string;
  status: OfficialResultStatus;
  awayTeam: string;
  homeTeam: string;
  awayScore: number | null;
  homeScore: number | null;
  winner: "HOME" | "AWAY" | "DRAW" | null;
  resultTimestamp: string | null;
};

export type MlbOfficialResultsDocument = {
  schemaVersion: typeof MLB_OFFICIAL_RESULTS_SCHEMA;
  dateKst: string;
  generatedAt: string;
  provider: "mlb-stats-api";
  scheduleArtifact: string;
  resultHash: string;
  games: MlbOfficialResultGame[];
};

export type MlbGradedPredictionGame = {
  gamePk: number | null;
  gameId: string;
  matchStatus: MatchStatus;
  inputStatus: string;
  pick: "HOME" | "AWAY" | null;
  pickTeam: string | null;
  actualWinner: "HOME" | "AWAY" | "DRAW" | null;
  homeScore: number | null;
  awayScore: number | null;
  grade: PredictionGrade;
  predictionProbability: number | null;
  baselineStatus: string | null;
  inputWarnings: string[];
  warnings: string[];
};

export type MlbGradedPredictionsDocument = {
  schemaVersion: typeof MLB_GRADED_PREDICTIONS_SCHEMA;
  dateKst: string;
  generatedAt: string;
  predictionArtifact: string;
  predictionHash: string;
  resultArtifact: string;
  resultHash: string;
  gradingPolicyVersion: string;
  summary: {
    totalGames: number;
    eligiblePredictions: number;
    limitedInputPredictions: number;
    blocked: number;
    noPick: number;
    graded: number;
    correct: number;
    incorrect: number;
    pending: number;
    void: number;
    matchErrors: number;
    accuracy: {
      numerator: number;
      denominator: number;
      percent: number | null;
      status: "OK" | "NO_GRADED_SAMPLE";
      exclusionPolicy: string;
    };
    eligibleAccuracy: {
      numerator: number;
      denominator: number;
      percent: number | null;
      status: "OK" | "NO_GRADED_SAMPLE";
    };
    limitedInputAccuracy: {
      numerator: number;
      denominator: number;
      percent: number | null;
      status: "OK" | "NO_GRADED_SAMPLE";
    };
  };
  games: MlbGradedPredictionGame[];
};

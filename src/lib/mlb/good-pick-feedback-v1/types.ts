/**
 * MLB Good Pick Human Feedback Review v1 — presentation types only.
 * Does not change Engine / Prediction / weights / datasets.
 */

export const GOOD_PICK_FEEDBACK_SCHEMA =
  "mlb-good-pick-human-feedback-v1" as const;

export type SignalPolarity =
  | "POSITIVE"
  | "NEGATIVE"
  | "NEUTRAL"
  | "LIMITED"
  | "NOT_CONNECTED"
  | "NOT_AVAILABLE";

export type PreGameSignal = {
  id: string;
  label: string;
  polarity: SignalPolarity;
  plain: string;
};

export type PreGameRiskCode =
  | "LINEUP_MISSING"
  | "STARTER_LIMITED"
  | "BULLPEN_NOT_CONNECTED"
  | "MARKET_CONFLICT"
  | "INPUT_LIMITED"
  | "COIN_FLIP"
  | "LOW_CONFIDENCE"
  | "MODEL_UNCERTAIN"
  | "RESEARCH_ONLY_PASS";

export type ReviewCandidate = {
  code: string;
  label: string;
  role: "primary" | "secondary";
  plain: string;
};

export type GoodPickGameFeedback = {
  gameId: string;
  gamePk: number | null;
  matchupLine: string;
  homeTeam: string;
  awayTeam: string;
  pickTeam: string | null;
  pickSide: "HOME" | "AWAY" | null;
  modelProbabilityPercent: number | null;
  confidence: number | null;
  pickTier: "GOOD";
  researchOnly: boolean;
  /** BEFORE THE GAME */
  beforeSignals: PreGameSignal[];
  preGameRisks: { code: PreGameRiskCode; label: string }[];
  /** AFTER THE GAME */
  finalScore: string | null;
  homeScore: number | null;
  awayScore: number | null;
  winnerTeam: string | null;
  grade: "CORRECT" | "INCORRECT" | "PENDING" | "UNKNOWN";
  brier: number | null;
  logLoss: number | null;
  whyCorrect: ReviewCandidate[];
  whyIncorrect: ReviewCandidate[];
  primaryReviewCandidate: string | null;
  secondaryReviewCandidates: string[];
  whatWeLearned: string;
  detailHref: string | null;
};

export type GoodPickScoreboard = {
  goodPickCount: number;
  correct: number;
  incorrect: number;
  pending: number;
  accuracyPercent: number | null;
  rows: Array<{
    gameId: string;
    matchupLine: string;
    pickTeam: string | null;
    modelProbabilityPercent: number | null;
    confidence: number | null;
    resultLine: string;
    grade: string;
    primaryReviewCandidate: string | null;
  }>;
};

export type AllResearchScoreboard = {
  totalGames: number;
  graded: number;
  correct: number;
  incorrect: number;
  accuracyPercent: number | null;
  brier: number | null;
  logLoss: number | null;
  leakageStatus: string | null;
};

export type DailyLearningCard = {
  title: string;
  goodPickLine: string;
  topSuccessCandidate: string | null;
  topFailureCandidate: string | null;
  commonPreGameRisks: string[];
  researchQuestions: string[];
  plain: string;
};

export type GoodPickFeedbackView = {
  schemaVersion: typeof GOOD_PICK_FEEDBACK_SCHEMA;
  dateKst: string;
  loaded: boolean;
  error: string | null;
  statusCode: "OK" | "NO_PREGAME_SNAPSHOT" | "NO_RESULTS" | "ERROR";
  predictionHash: string | null;
  allResearch: AllResearchScoreboard | null;
  goodPickScoreboard: GoodPickScoreboard;
  games: GoodPickGameFeedback[];
  dailyLearning: DailyLearningCard | null;
  sourcePaths: string[];
};

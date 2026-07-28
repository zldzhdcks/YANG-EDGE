export const KBO_MARKET_RESULT_FEEDBACK_DATASET_ID =
  "kbo-market-result-feedback";
export const KBO_MARKET_RESULT_FEEDBACK_SCHEMA_VERSION =
  "kbo-market-result-feedback-v1";
export const KBO_MARKET_RESULT_FEEDBACK_BUILDER_VERSION =
  "kbo-market-result-feedback-builder-v1";

export type KboMarketFavoredSide = "HOME" | "AWAY" | "NONE";
export type KboMarketDirectionMatch = "MATCHED" | "NOT_MATCHED" | "UNKNOWN";
export type KboMarketDirectionAgreement =
  | "AGREED"
  | "CONFLICTED"
  | "UNKNOWN";

export type KboObservationStatus = "OBSERVATION_ONLY" | "INSUFFICIENT_SAMPLE";

export type KboPipelineReadinessStatus =
  | "READY"
  | "PARTIAL"
  | "NOT_IMPLEMENTED"
  | "FUTURE_GATED"
  | "LEGAL_REVIEW_REQUIRED";

export type KboMarketResultFeedbackRow = {
  internalGameId: string;
  providerGameId: string;
  awayTeam: string;
  homeTeam: string;
  startTimeKst: string;
  finalStatus: string;
  awayScore: number | null;
  homeScore: number | null;
  winnerSide: string | null;
  winnerTeam: string | null;
  domesticOperatorMarketId: string | null;
  domesticHomeOdds: number | null;
  domesticAwayOdds: number | null;
  domesticReviewStatus: string | null;
  domesticCapturedAt: string | null;
  domesticEnteredAt: string | null;
  domesticFavoredSide: KboMarketFavoredSide;
  domesticDirectionMatchedResult: KboMarketDirectionMatch;
  overseasHomeOdds: number | null;
  overseasAwayOdds: number | null;
  overseasProvider: string | null;
  overseasBookmakerPolicy: string | null;
  overseasCollectedAt: string | null;
  overseasMarketRuleStatus: string | null;
  overseasFavoredSide: KboMarketFavoredSide;
  overseasDirectionMatchedResult: KboMarketDirectionMatch;
  domesticOverseasDirectionAgreement: KboMarketDirectionAgreement;
  identityMappingStatus: string;
  warnings: string[];
  missing: string[];
};

export type KboMarketResultFeedbackSummary = {
  totalGames: number;
  finalGames: number;
  pendingGames: number;
  draws: number;
  domesticOddsAvailable: number;
  overseasOddsAvailable: number;
  bothOddsAvailable: number;
  domesticDirectionMatched: number;
  domesticDirectionNotMatched: number;
  overseasDirectionMatched: number;
  overseasDirectionNotMatched: number;
  domesticOverseasDirectionAgreed: number;
  domesticOverseasDirectionConflicted: number;
  observationStatus: KboObservationStatus;
};

export type KboMarketResultFeedbackPredictionBoundary = {
  predictionStatus: "NOT_IMPLEMENTED";
  predictionGrade: "NOT_APPLICABLE";
  worked: null;
  failed: null;
  confidence: null;
  edgeScore: null;
  learningImpact: "NONE";
};

export type KboMarketResultFeedbackPipelineReadiness = {
  scheduleResultIdentity: KboPipelineReadinessStatus;
  operatorMarket: KboPipelineReadinessStatus;
  overseasOdds: KboPipelineReadinessStatus;
  starter: KboPipelineReadinessStatus;
  bullpen: KboPipelineReadinessStatus;
  lineup: KboPipelineReadinessStatus;
  injury: KboPipelineReadinessStatus;
  weather: KboPipelineReadinessStatus;
  travel: KboPipelineReadinessStatus;
  prediction: KboPipelineReadinessStatus;
  grade: KboPipelineReadinessStatus;
  review: KboPipelineReadinessStatus;
  learning: KboPipelineReadinessStatus;
};

export type KboMarketResultFeedbackDocument = {
  meta: {
    datasetId: typeof KBO_MARKET_RESULT_FEEDBACK_DATASET_ID;
    schemaVersion: typeof KBO_MARKET_RESULT_FEEDBACK_SCHEMA_VERSION;
    builderVersion: typeof KBO_MARKET_RESULT_FEEDBACK_BUILDER_VERSION;
    dateKst: string;
    identityProvider: "API_BASEBALL";
    generatedAt: string;
    researchOnly: true;
    legalStatus: "INTERNAL_RESEARCH_ONLY";
    engineAdmission: "PROHIBITED";
    inputHashSha256: string;
    resultHashSha256: string;
    notes: string[];
  };
  identityValidation: {
    identityImmutableHash: string;
    status: "PASS" | "FAIL";
  };
  prediction: KboMarketResultFeedbackPredictionBoundary;
  summary: KboMarketResultFeedbackSummary;
  pipelineReadiness: KboMarketResultFeedbackPipelineReadiness;
  rows: KboMarketResultFeedbackRow[];
};

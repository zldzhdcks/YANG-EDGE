/**
 * MLB Research Scorecard v1 — observational, read-only.
 * Never mutates Prediction / Recommendation / Engine / historical artifacts.
 */

import type { SelectedPickProbabilityResolution } from "@/lib/mlb/daily-picks-v1/resolve-selected-pick-probability";

export const MLB_RESEARCH_SCORECARD_V1_SCHEMA =
  "mlb-research-scorecard-v1" as const;
export const MLB_RESEARCH_SCORECARD_V1_BUILDER =
  "research-scorecard-builder-v1" as const;

export type ScorecardFieldClass =
  | "PREGAME_INPUT"
  | "PREGAME_OBSERVATION"
  | "PREDICTION_OUTPUT"
  | "POSTGAME_RESULT"
  | "POSTGAME_REVIEW_TAG"
  | "DERIVED_RESEARCH_METRIC";

/** Conceptual class for every row field. Not duplicated onto each JSON key. */
export const SCORECARD_V1_FIELD_CLASS = {
  dateKst: "PREGAME_INPUT",
  gamePk: "PREGAME_INPUT",
  internalGameId: "PREGAME_INPUT",
  awayTeam: "PREGAME_INPUT",
  homeTeam: "PREGAME_INPUT",
  predictionAvailable: "PREDICTION_OUTPUT",
  predictionStatus: "PREDICTION_OUTPUT",
  selectedPick: "PREDICTION_OUTPUT",
  selectedPickSide: "PREDICTION_OUTPUT",
  selectedPickProbability: "PREDICTION_OUTPUT",
  selectedPickProbabilitySource: "PREDICTION_OUTPUT",
  inputStatus: "PREDICTION_OUTPUT",
  inputConfidence: "PREDICTION_OUTPUT",
  researchOnly: "PREDICTION_OUTPUT",
  officialPick: "PREDICTION_OUTPUT",
  recommendationAvailable: "PREDICTION_OUTPUT",
  recommendationTier: "PREDICTION_OUTPUT",
  recommendationResearchOnly: "PREDICTION_OUTPUT",
  recommendationSealed: "PREDICTION_OUTPUT",
  isGoodPick: "PREDICTION_OUTPUT",
  providerMarketAvailable: "PREGAME_INPUT",
  providerMarketFavoriteSide: "PREGAME_INPUT",
  providerMarketFavoriteTeam: "PREGAME_INPUT",
  koreanMarketObservationStatus: "PREGAME_OBSERVATION",
  koreanMarketFavoriteSide: "PREGAME_OBSERVATION",
  koreanMarketFavoriteTeam: "PREGAME_OBSERVATION",
  koreanMarketTimingRelativeToPrediction: "PREGAME_OBSERVATION",
  modelVsKoreanMarket: "DERIVED_RESEARCH_METRIC",
  starterAvailability: "PREGAME_INPUT",
  starterHomeStatus: "PREGAME_INPUT",
  starterAwayStatus: "PREGAME_INPUT",
  providerLineupStatus: "PREGAME_INPUT",
  expectedLineupObservationStatus: "PREGAME_OBSERVATION",
  expectedLineupStatus: "PREGAME_OBSERVATION",
  expectedLineupTimingRelativeToPrediction: "PREGAME_OBSERVATION",
  expectedLineupPostPredictionPregameObservation: "PREGAME_OBSERVATION",
  expectedLineupUsedByPrediction: "PREGAME_OBSERVATION",
  resultStatus: "POSTGAME_RESULT",
  actualWinnerSide: "POSTGAME_RESULT",
  predictionGrade: "POSTGAME_RESULT",
  predictionCorrect: "POSTGAME_RESULT",
  reviewTags: "POSTGAME_REVIEW_TAG",
  reviewTagDataClass: "POSTGAME_REVIEW_TAG",
} as const satisfies Record<string, ScorecardFieldClass>;

export type ObservationTiming =
  | "BEFORE_PREDICTION"
  | "AFTER_PREDICTION_BUT_BEFORE_GAME"
  | "LATE"
  | "UNKNOWN";

export type StarterAvailability = "BOTH_AVAILABLE" | "PARTIAL" | "MISSING";

export type FavoriteSide = "HOME" | "AWAY" | "TIE" | "NO_FAVORITE";

export type ModelVsKoreanMarket =
  | "ALIGNED"
  | "CONFLICT"
  | "NO_KOREAN_OBSERVATION"
  | "AMBIGUOUS";

export type ResultStatus = "FINAL" | "AWAITING" | "OTHER";

export type ScorecardSampleStatus =
  | "INSUFFICIENT_SAMPLE"
  | "EARLY_SAMPLE"
  | "DATA_COLLECTION"
  | "DATA_ACCUMULATION_CONTINUES"
  | "INVESTIGATE_MORE"
  | "NO_SAMPLE";

export type ReviewTagProvenance =
  | "PREEXISTING_WARNING"
  | "POSTGAME_DESCRIPTIVE"
  | "OUTCOME_DERIVED"
  | "UNKNOWN";

export type SelectedPickProbabilitySource =
  SelectedPickProbabilityResolution["source"];

export type MlbResearchScorecardRowV1 = {
  dateKst: string;
  gamePk: number;
  internalGameId: string;
  awayTeam: string;
  homeTeam: string;

  predictionAvailable: boolean;
  predictionStatus: string | null;
  selectedPick: string | null;
  selectedPickSide: "HOME" | "AWAY" | null;
  /** P(selected pick wins) as percent. Not inputConfidence. */
  selectedPickProbability: number | null;
  selectedPickProbabilitySource: SelectedPickProbabilitySource | null;
  inputStatus: string | null;
  /** Input/data quality 0–100. NOT win probability. */
  inputConfidence: number | null;
  researchOnly: boolean | null;
  officialPick: string | null;

  recommendationAvailable: boolean;
  recommendationTier: string | null;
  recommendationResearchOnly: boolean | null;
  recommendationSealed: boolean;
  isGoodPick: boolean;

  providerMarketAvailable: boolean;
  providerMarketFavoriteSide: FavoriteSide | null;
  providerMarketFavoriteTeam: string | null;

  koreanMarketObservationStatus:
    | "OBSERVED"
    | "NO_KOREAN_OBSERVATION";
  koreanMarketFavoriteSide: FavoriteSide | null;
  koreanMarketFavoriteTeam: string | null;
  koreanMarketTimingRelativeToPrediction: ObservationTiming | null;
  modelVsKoreanMarket: ModelVsKoreanMarket;

  starterAvailability: StarterAvailability;
  starterHomeStatus: string | null;
  starterAwayStatus: string | null;

  providerLineupStatus: string | null;

  expectedLineupObservationStatus: "OBSERVED" | "NOT_OBSERVED";
  expectedLineupStatus: "EXPECTED" | null;
  expectedLineupTimingRelativeToPrediction: ObservationTiming | null;
  expectedLineupPostPredictionPregameObservation: boolean;
  /** Always false in v1 — operator observation is not a Prediction input. */
  expectedLineupUsedByPrediction: false;

  resultStatus: ResultStatus;
  actualWinnerSide: "HOME" | "AWAY" | "DRAW" | null;
  predictionGrade: string | null;
  predictionCorrect: boolean | null;

  reviewTags: string[];
  reviewTagDataClass: "POSTGAME_REVIEW_TAG";
};

export type CountAccuracy = {
  n: number;
  correct: number;
  incorrect: number;
  accuracyPercent: number | null;
  sampleStatus: ScorecardSampleStatus;
};

export type CalibrationBucketMetric = {
  bucket: string;
  n: number;
  predictedAverage: number | null;
  actualWinRate: number | null;
  status: "OK" | "INSUFFICIENT_SAMPLE" | "EMPTY";
};

export type CalibrationDimension = {
  dimension: "CALIBRATION";
  gradedN: number;
  correct: number;
  incorrect: number;
  accuracyPercent: number | null;
  meanBrier: number | null;
  meanLogLoss: number | null;
  home: CountAccuracy;
  away: CountAccuracy;
  probabilityBuckets: CalibrationBucketMetric[];
  sampleStatus: ScorecardSampleStatus;
  note: string;
};

export type RecommendationSelectionDimension = {
  dimension: "RECOMMENDATION_SELECTION_VALUE";
  goodPick: CountAccuracy;
  nonGoodResearch: CountAccuracy;
  note: string;
};

export type StarterCompletenessBucket = CountAccuracy & {
  availability: StarterAvailability;
};

export type InputCompletenessDimension = {
  dimension: "INPUT_COMPLETENESS";
  starter: StarterCompletenessBucket[];
  note: string;
};

export type MarketGroupAccuracy = CountAccuracy & {
  group: "ALIGNED" | "CONFLICT";
};

export type MarketBenchmarkDimension = {
  dimension: "MARKET_BENCHMARK";
  koreanSource: "MANUAL_OBSERVATION";
  providerConfirmed: false;
  koreanUsedAsEngineInput: false;
  modelVsKorean: MarketGroupAccuracy[];
  koreanFavoriteBaseline: CountAccuracy;
  providerFavoriteBaseline: CountAccuracy;
  providerVsKorean: {
    SAME_FAVORITE: number;
    DIFFERENT_FAVORITE: number;
    NO_KOREAN_OBSERVATION: number;
    NO_PROVIDER_MARKET: number;
    AMBIGUOUS: number;
  };
  note: string;
};

export type ExpectedLineupCoverage = {
  observed: number;
  notObserved: number;
  expectedStatusCount: number;
  confirmedStatusCount: 0;
  timing: Record<ObservationTiming, number>;
  postPredictionPregameObservation: number;
  usedByPredictionCount: 0;
  note: string;
};

export type ReviewTagFrequency = {
  tag: string;
  winsWithTag: number;
  lossesWithTag: number;
  total: number;
  dataClass: "POSTGAME_REVIEW_TAG";
  provenance: ReviewTagProvenance;
};

export type MlbResearchScorecardV1 = {
  meta: {
    schemaVersion: typeof MLB_RESEARCH_SCORECARD_V1_SCHEMA;
    builderVersion: typeof MLB_RESEARCH_SCORECARD_V1_BUILDER;
    dateKst: string;
    /** Build provenance only. Excluded from scorecardHash. */
    generatedAt: string;
    researchOnly: true;
    engineAdmission: "PROHIBITED";
    engineConnected: false;
    autoApply: false;
    primaryDimensions: [
      "CALIBRATION",
      "RECOMMENDATION_SELECTION_VALUE",
      "INPUT_COMPLETENESS",
      "MARKET_BENCHMARK",
    ];
    /** Deterministic research-content hash. Excludes generatedAt. */
    scorecardHash: string;
    scheduleGames: number;
    awaitingResults: number;
    gradedResearchN: number;
    readOnly: true;
    writesHistoricalArtifacts: false;
  };
  rows: MlbResearchScorecardRowV1[];
  calibration: CalibrationDimension;
  recommendationSelection: RecommendationSelectionDimension;
  inputCompleteness: InputCompletenessDimension;
  marketBenchmark: MarketBenchmarkDimension;
  expectedLineupCoverage: ExpectedLineupCoverage;
  reviewTagQa: {
    dataClass: "POSTGAME_REVIEW_TAG";
    tags: ReviewTagFrequency[];
    note: string;
  };
  researchStatus: {
    overall: ScorecardSampleStatus;
    promotion: "PROHIBITED";
    allowedConclusions: ScorecardSampleStatus[];
    forbiddenConclusions: [
      "PROMISING",
      "READY_FOR_BACKTEST",
      "VERIFIED",
    ];
    note: string;
  };
};

export type MlbResearchScorecardCumulativeV1 = {
  meta: {
    schemaVersion: "mlb-research-scorecard-v1-cumulative";
    builderVersion: typeof MLB_RESEARCH_SCORECARD_V1_BUILDER;
    dates: string[];
    /** Build provenance only. Excluded from scorecardHash. */
    generatedAt: string;
    researchOnly: true;
    engineAdmission: "PROHIBITED";
    autoApply: false;
    outcomeDenominatorExcludesAwaiting: true;
    /** Deterministic research-content hash. Excludes generatedAt. */
    scorecardHash: string;
  };
  rowCount: number;
  awaitingExcludedFromOutcomes: number;
  calibration: CalibrationDimension;
  recommendationSelection: RecommendationSelectionDimension;
  inputCompleteness: InputCompletenessDimension;
  marketBenchmark: MarketBenchmarkDimension;
  expectedLineupCoverage: ExpectedLineupCoverage;
  reviewTagQa: MlbResearchScorecardV1["reviewTagQa"];
  researchStatus: MlbResearchScorecardV1["researchStatus"];
};

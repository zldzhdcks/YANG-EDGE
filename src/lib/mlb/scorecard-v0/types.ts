/**
 * MLB Prediction Scorecard v0 — types.
 * Additive postgame artifact; never mutates prediction snapshots.
 */

export const MLB_SCORECARD_V0_SCHEMA = "mlb-prediction-scorecard-v0" as const;
export const MLB_SCORECARD_V0_GRADE_VERSION = "mlb-scorecard-grade-v0" as const;

export type ScorecardMarketType = "MONEYLINE_2WAY";

export type GradeResult =
  | "CORRECT"
  | "INCORRECT"
  | "VOID"
  | "PENDING"
  | "NOT_GRADED";

export type MarketAgreementClass =
  | "MODEL_AND_MARKET_AGREE"
  | "MODEL_MARKET_DISAGREE"
  | "NEAR_EVEN"
  | "MARKET_MISSING";

export type ComponentAlignment =
  | "ALIGNED_CORRECT"
  | "ALIGNED_INCORRECT"
  | "NEUTRAL"
  | "DISABLED"
  | "MISSING"
  | "NOT_APPLICABLE";

export type AccuracySummary = {
  correct: number;
  incorrect: number;
  sampleCount: number;
  accuracy: number | null;
  status: "OK" | "NO_SAMPLE" | "N/A" | "INSUFFICIENT_SAMPLE";
};

export type ProbMetrics = {
  meanBrierScore: number | null;
  meanLogLoss: number | null;
  sampleCount: number;
};

export type CalibrationBucketRow = {
  bucket: string;
  sampleCount: number;
  predictedAverage: number | null;
  actualWinRate: number | null;
  calibrationGap: number | null;
  status: "INSUFFICIENT_SAMPLE" | "OBSERVATION_ONLY" | "EMPTY";
};

export type ConfidenceBucketRow = {
  bucket: string;
  samples: number;
  correct: number;
  incorrect: number;
  accuracy: number | null;
  meanBrier: number | null;
  meanLogLoss: number | null;
};

export type ScorecardGameGrade = {
  gamePk: number | null;
  gameId: string;
  marketType: ScorecardMarketType;
  homeTeam: string;
  awayTeam: string;
  commenceTimeUtc: string | null;
  resultStatus: string;
  actualWinner: "HOME" | "AWAY" | "DRAW" | null;
  homeScore: number | null;
  awayScore: number | null;
  officialStatus: string | null;
  inputQuality: string | null;
  blockedReasons: string[];
  confidence: number | null;
  modelHomeProbability: number | null;
  modelAwayProbability: number | null;
  selectedProbability: number | null;
  marketHomeProbability: number | null;
  marketAwayProbability: number | null;
  mostLikelySelection: "HOME" | "AWAY" | null;
  selectedSideEdge: number | null;
  valueSelection: "HOME" | "AWAY" | null;
  valueEdge: number | null;
  researchGrade: GradeResult;
  valueGrade: GradeResult;
  brierScore: number | null;
  logLoss: number | null;
  marketAgreement: MarketAgreementClass;
  schemaSource: "V0_MARKET_PREDICTIONS" | "LEGACY_ADAPTER";
  components: Array<{
    name: string;
    value: number | null;
    alignment: ComponentAlignment;
  }>;
  counterfactualBlocked: {
    applicable: boolean;
    hypotheticalSelection: "HOME" | "AWAY" | null;
    counterfactualGrade: GradeResult | null;
  };
};

export type MlbPredictionScorecardV0 = {
  meta: {
    schemaVersion: typeof MLB_SCORECARD_V0_SCHEMA;
    dateKst: string;
    generatedAt: string;
    modelVersion: string | null;
    modelStatus: string | null;
    gradeVersion: typeof MLB_SCORECARD_V0_GRADE_VERSION;
    predictionHashSha256: string | null;
    configHash: string | null;
    inputManifestHash: string | null;
    officialResultsHash: string | null;
    scorecardHash: string;
    totalGames: number;
    finalGames: number;
    pendingGames: number;
    voidGames: number;
    officialSampleCount: number;
    researchSampleCount: number;
    blockedCount: number;
    dryRun: boolean;
    allowPartialResults: boolean;
    conclusion: string;
  };
  officialPerformance: {
    officialPickCount: number;
    accuracy: AccuracySummary;
    note: string;
  };
  researchBaselinePerformance: AccuracySummary & ProbMetrics & {
    meanSelectedProbability: number | null;
  };
  mostLikelyPerformance: AccuracySummary & ProbMetrics & {
    meanSelectedProbability: number | null;
  };
  valueSelectionPerformance: AccuracySummary & {
    valueSelectionCount: number;
    averageValueEdge: number | null;
    negativeSelectedSideEdgeCount: number;
    realizedReturn: null;
    note: string;
  };
  selectedSideEdgeSplit: {
    positiveEdge: AccuracySummary;
    negativeOrZeroEdge: AccuracySummary;
  };
  probabilityMetrics: ProbMetrics;
  calibrationBuckets: CalibrationBucketRow[];
  confidenceBuckets: ConfidenceBucketRow[];
  marketAgreement: Record<
    MarketAgreementClass,
    {
      correct: number;
      incorrect: number;
      sampleCount: number;
      accuracy: number | null;
      meanModelProbability: number | null;
      meanMarketProbability: number | null;
      meanSelectedSideEdge: number | null;
      status: "INSUFFICIENT_SAMPLE" | "OBSERVATION_ONLY" | "EMPTY";
    }
  >;
  componentScorecards: Array<{
    name: string;
    sampleCount: number;
    directionalCorrect: number;
    directionalIncorrect: number;
    neutral: number;
    disabled: number;
    missing: number;
    averageMagnitude: number | null;
    status: "DIRECTIONAL_ASSOCIATION_ONLY" | "INSUFFICIENT_SAMPLE" | "DISABLED";
  }>;
  blockedPolicyReview: Array<{
    gamePk: number | null;
    gameId: string;
    blockedReasons: string[];
    hypotheticalSelection: "HOME" | "AWAY" | null;
    hypotheticalProbability: number | null;
    actualWinner: "HOME" | "AWAY" | "DRAW" | null;
    counterfactualGrade: GradeResult | null;
    includedInOfficialDenominator: false;
    includedInResearchDenominator: false;
  }>;
  homeAway: {
    modelHomeSelections: number;
    modelAwaySelections: number;
    actualHomeWinners: number;
    actualAwayWinners: number;
    modelHomeSelectionAccuracy: AccuracySummary;
    modelAwaySelectionAccuracy: AccuracySummary;
  };
  gameGrades: ScorecardGameGrade[];
  warnings: string[];
  limitations: string[];
};

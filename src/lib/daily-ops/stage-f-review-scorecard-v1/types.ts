/**
 * Daily Stage F Success/Failure Review + Scorecard v1.
 *
 * PASS-only days cannot reuse football pick-level scorecard
 * (assumes predictedSide) or the thin 2026-08-22 N/A close
 * (no operational process review). This extension reviews
 * process/coverage only. Prediction performance stays NOT_APPLICABLE.
 * Historical artifacts are not rewritten.
 */
export const DAILY_STAGE_F_SCHEMA =
  "yang-edge-daily-stage-f-success-failure-review-scorecard-v1" as const;

export const DAILY_STAGE_F_PREDICTION_PERFORMANCE_STATUS =
  "NO_GRADABLE_PREDICTIONS" as const;

export const DAILY_STAGE_F_METRIC_NA = "NOT_APPLICABLE" as const;

export type DailyStageFControlStatus =
  | "PASS"
  | "FAIL"
  | "BLOCKED"
  | "NOT_APPLICABLE";

export type DailyStageFRootCauseClass =
  | "MODEL_NOT_APPROVED"
  | "IDENTITY_COVERAGE"
  | "COMPETITION_REGISTRY"
  | "PROVIDER_COVERAGE"
  | "TIMING_CAPTURE"
  | "RESULT_COVERAGE";

export type DailyStageFCandidateKind = "FOLLOW_UP_CANDIDATE";

export type DailyStageFControlId =
  | "LOCKED_SCOPE_ACCOUNTABILITY"
  | "PREGAME_POSTGAME_SEPARATION"
  | "RETROACTIVE_PREDICTION_PROHIBITION"
  | "PASS_PRESERVATION"
  | "NO_FUZZY_IDENTITY_MATCHING"
  | "MARKET_ODDS_ISOLATION"
  | "RESULT_TO_PREGAME_FIREWALL"
  | "RESULT_TO_PREDICTION_FIREWALL"
  | "ENGINE_WEIGHT_IMMUTABILITY"
  | "TERMINAL_COVERAGE_GAPS_EXPLICIT"
  | "UNSUPPORTED_ROWS_IN_DENOMINATOR"
  | "NO_FABRICATED_SCORES"
  | "NO_FABRICATED_PREDICTION_PERFORMANCE"
  | "PROVIDER_NETWORK_DISCIPLINE"
  | "SEALED_ARTIFACT_INTEGRITY";

export type DailyStageFHygieneControl = {
  id: DailyStageFControlId;
  status: DailyStageFControlStatus;
  evidence: string[];
};

export type DailyStageFNaMetric = {
  value: null;
  semantics: typeof DAILY_STAGE_F_METRIC_NA;
};

export type DailyStageFGameRowV1 = {
  operatorGameId: string;
  sport: string;
  league: string;
  cState: string;
  eCloseClass: string;
  eResultState: string;
  predictionCreated: false;
  predictionPerformanceAssignment: typeof DAILY_STAGE_F_METRIC_NA;
  successFailureAssigned: false;
  primaryRootCauseClass: DailyStageFRootCauseClass;
  additionalRootCauseClasses: DailyStageFRootCauseClass[];
};

export type DailyStageFFutureCandidate = {
  kind: DailyStageFCandidateKind;
  id: string;
  title: string;
  evidence: string[];
  implemented: false;
  hypothesisValidated: false;
  enginePromotion: false;
  weightChange: false;
};

export type DailyStageFSuccessFailureReviewScorecardV1 = {
  schemaVersion: typeof DAILY_STAGE_F_SCHEMA;
  dateKst: "2026-08-26";
  mandatoryStage: "F_SUCCESS_FAILURE_REVIEW_SCORECARD";
  weight: 20;
  reviewRunAt: string;
  lockedScope: 26;
  scopeTotal: 26;
  accountedFor: 26;
  sources: {
    scopeArtifact: string;
    scopeHash: string;
    b1Artifact: string;
    b1Hash: string;
    b2Artifact: string;
    b2Hash: string;
    cArtifact: string;
    cHash: string;
    snapshotArtifact: string;
    snapshotHash: string;
    eArtifact: string;
    eHash: string;
  };
  architecture: {
    existingDailyStageFArtifact: string;
    existingDailyStageFSchema: "yang-edge-daily-stage-f-review-close-v1";
    existingCapableOfPassOnlyNa: true;
    existingCapableOfOperationalProcessReview: false;
    footballPickLevelScorecardApplied: false;
    mlbPickLevelScorecardApplied: false;
    passOnlyExtensionRequired: true;
    historicalArtifactsRewritten: false;
  };
  predictionPerformance: {
    status: typeof DAILY_STAGE_F_PREDICTION_PERFORMANCE_STATUS;
    predictionCount: 0;
    passCount: 26;
    gradedPredictionCount: 0;
    correct: 0;
    incorrect: 0;
    accuracy: DailyStageFNaMetric;
    hitRate: DailyStageFNaMetric;
    roi: DailyStageFNaMetric;
    yield: DailyStageFNaMetric;
    passAssignedSuccessFailureCount: 0;
    passHitMissCount: 0;
    passWinLossCount: 0;
    perGameSuccessFailureReviews: 0;
    hindsightCounterfactualGrading: false;
  };
  cStateCounts: {
    PREDICTION: 0;
    PASS_ENGINE_NOT_APPROVED: number;
    PASS_IDENTITY_REVIEW_REQUIRED: number;
    PASS_MISSED_PRE_GAME_WINDOW: number;
    PASS_PROVIDER_NOT_SUPPORTED: number;
  };
  resultCoverage: {
    operationallyClosedCount: number;
    finalResultCount: number;
    finalOfScope: string;
    operationallyClosedOfScope: string;
    fullFinalClaim: false;
    terminalCoverageGapCount: number;
    identityCoverageGapCount: number;
    unsupportedCoverageGapCount: number;
    activePendingCount: number;
    operationalCloseIsNotFullFinalCoverage: true;
    resultRequiresCanonical: false;
  };
  marketOddsIsolation: {
    marketBenchmarkOnly: true;
    predictionInput: false;
    engineInput: false;
    baseballMarketObservationCount: number;
    oddsGraded: false;
    hypotheticalYangPickFromOdds: false;
  };
  sportFindings: {
    baseball: {
      scopedCount: number;
      kboCount: number;
      npbCount: number;
      b1MatchedCount: number;
      b2OddsCollectedCount: number;
      passEngineNotApprovedCount: number;
      interpretation: "MODEL_RESEARCH_GOVERNANCE_BOTTLENECK";
      dataLossFailure: false;
      engineActivationRecommended: false;
    };
    football: {
      scopedCount: number;
      passIdentityReviewRequiredCount: number;
      resultIdentityUnresolvedTerminalCount: number;
      predictionIdentityEqualsResultIdentity: false;
      unregisteredCompetitionPassCount: number;
      registeredCompetitionIdentityConflictCount: number;
      exactResultLookupDespitePredictionIdentityGapCount: number;
    };
    volleyball: {
      scopedCount: number;
      passProviderNotSupportedCount: number;
      resultProviderUnsupportedTerminalCount: number;
      providerPurchased: false;
      providerImplemented: false;
    };
    missedPregameWindow: {
      officialCPassCount: number;
      operatorGameId: string | null;
      retroactiveRepair: false;
    };
  };
  researchProcessSuccesses: Array<{ id: string; statement: string; evidence: string[] }>;
  researchProcessGaps: Array<{
    id: string;
    statement: string;
    count: number;
    rootCauseClass: DailyStageFRootCauseClass;
    evidence: string[];
    notAPredictionFailure: true;
  }>;
  researchHygieneControls: DailyStageFHygieneControl[];
  futureResearchCandidates: DailyStageFFutureCandidate[];
  games: DailyStageFGameRowV1[];
  leakage: {
    retroactivePredictionAllowed: false;
    retroactivePredictionCreated: false;
    fuzzyMatchingUsed: false;
    engineModified: false;
    weightsModified: false;
    predictionModified: false;
    pregameArtifactsWritten: false;
    cArtifactMutated: false;
    eArtifactMutated: false;
    footballPickLevelScorecardApplied: false;
  };
  providerNetworkCallCount: 0;
  providerPredictionsEndpointUsed: false;
  validatedHypothesisCount: 0;
  enginePromotionCount: 0;
  credit: 0;
  officialMandatoryCompletionRemainsPct: 75;
  fStatus: "CANDIDATE_COMPLETE";
  stageResult: "COMPLETED_PROCESS_REVIEW_NO_GRADABLE_PREDICTIONS";
};

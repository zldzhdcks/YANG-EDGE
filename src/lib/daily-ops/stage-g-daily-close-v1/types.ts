/**
 * Daily Stage G Daily Close Audit + Git Sync v1.
 *
 * 2026-08-22 yang-edge-daily-close-v1 is a thin remote-seal receipt
 * and cannot represent 13/26 Result coverage, hash firewalls, or
 * leakage/git lineage. This extension is a repository-only close
 * audit. Historical artifacts are not rewritten.
 */
export const DAILY_STAGE_G_SCHEMA =
  "yang-edge-daily-stage-g-daily-close-git-sync-v1" as const;

export const DAILY_STAGE_G_METRIC_NA = "NOT_APPLICABLE" as const;

export type DailyStageGAuditStatus = "PASS" | "FAIL" | "INCOMPLETE";

export type DailyStageGSourceRef = {
  stage: "A" | "B1" | "B2" | "C" | "SNAPSHOT" | "E" | "F";
  path: string;
  expectedSha256: string;
  workingTreeSha256: string;
  matchesExpected: true;
  byteIdenticalToHead: true;
};

export type DailyStageGDailyCloseGitSyncV1 = {
  schemaVersion: typeof DAILY_STAGE_G_SCHEMA;
  dateKst: "2026-08-26";
  mandatoryStage: "G_DAILY_CLOSE";
  weight: 5;
  closeAuditRunAt: string;
  architecture: {
    existingDailyCloseArtifact: string;
    existingDailyCloseSchema: "yang-edge-daily-close-v1";
    existingCapableOfThisDayIntegrityAudit: false;
    extensionRequired: true;
    historicalArtifactsRewritten: false;
  };
  sources: DailyStageGSourceRef[];
  gitLineage: {
    head: string;
    originMain: string;
    headEqualsOriginMain: true;
    statusSbAtCandidateBuild: string;
    aCommit: string;
    b1Commit: string;
    b2Commit: string;
    cAndDEquivalentCommit: string;
    eCommit: string;
    fCommit: string;
    fParent: string;
    forceRewriteDetected: false;
  };
  dEvidence: {
    kind: "PREGAME_GIT_REMOTE_SEAL_EQUIVALENT";
    commit: string;
    message: "research: seal 2026-08-26 prediction pass snapshot";
    separateStageDArtifact: false;
  };
  credits: {
    A: { awarded: 10; of: 10 };
    B: { awarded: 20; of: 20 };
    C: { awarded: 20; of: 20 };
    D: { awarded: 10; of: 10 };
    E: { awarded: 15; of: 15 };
    F: { awarded: 20; of: 20 };
    G: { awarded: 0; of: 5 };
    preGTotal: 95;
    officialCompletionBeforeSeal: 95;
    targetCompletionAfterSeal: 100;
  };
  scope: {
    scopeTotal: 26;
    baseball: 11;
    kbo: 5;
    npb: 6;
    football: 14;
    volleyball: 1;
    mlb: 0;
    laterGamesAdded: false;
  };
  predictionPass: {
    predictionCount: 0;
    passCount: 26;
    passEngineNotApproved: 11;
    passIdentityReviewRequired: 13;
    passMissedPreGameWindow: 1;
    passProviderNotSupported: 1;
    passReasonTotal: 26;
    gradedPredictionCount: 0;
    predictionPerformanceStatus: "NO_GRADABLE_PREDICTIONS";
    predictionPerformanceSemantics: typeof DAILY_STAGE_G_METRIC_NA;
    accuracy: { value: null; semantics: typeof DAILY_STAGE_G_METRIC_NA };
    hitRate: { value: null; semantics: typeof DAILY_STAGE_G_METRIC_NA };
    roi: { value: null; semantics: typeof DAILY_STAGE_G_METRIC_NA };
    yield: { value: null; semantics: typeof DAILY_STAGE_G_METRIC_NA };
    passAssignedSuccessFailureCount: 0;
    passConvertedToGradedOutcome: 0;
    retroactivePrediction: false;
  };
  resultGrade: {
    operationallyClosedCount: 26;
    finalResultCount: 13;
    terminalCoverageGapCount: 13;
    identityCoverageGapCount: 12;
    unsupportedCoverageGapCount: 1;
    activePendingCount: 0;
    resultCoverage: "13_OF_26";
    fullFinalClaim: false;
    operationalCloseIsNotFullFinalCoverage: true;
    resultRequiresCanonical: false;
    fabricatedScoreCount: 0;
  };
  fReview: {
    hygieneControlCount: 15;
    hygieneAllPass: true;
    validatedHypothesisCreated: 0;
    enginePromotion: 0;
    hindsightRerun: false;
  };
  leakageAudit: {
    status: "PASS";
    resultMutatedScope: false;
    resultMutatedB1: false;
    resultMutatedB2: false;
    resultMutatedC: false;
    resultMutatedSnapshot: false;
    stageFMutatedPregame: false;
    stageFCreatedPrediction: false;
    postgameBecamePregameInput: false;
    passChangedAfterResult: false;
  };
  marketOddsFirewall: {
    status: "PASS";
    marketBenchmarkOnly: true;
    predictionInput: false;
    engineInput: false;
  };
  engineWeightAudit: {
    engineModified: false;
    weightsModified: false;
    interveningFoundationSeparatedFromDayPredictionInputs: true;
  };
  identityAudit: {
    fuzzyMatchingUsed: false;
    forcedCanonicalApproval: false;
    resultIdentityTerminalGapsRemain: 12;
    predictionIdentityEqualsResultIdentity: false;
    resultRequiresCanonical: false;
    identityRepairedInStageG: false;
  };
  providerNetworkCallCount: 0;
  providerPredictionsEndpointUsed: false;
  dayContribution: "OPERATIONS_AND_DATA_QUALITY_EVIDENCE_NOT_PREDICTION_ACCURACY";
  credit: 0;
  gStatus: "CANDIDATE_COMPLETE";
  stageResult: "READY_FOR_OWNER_REMOTE_SEAL";
};

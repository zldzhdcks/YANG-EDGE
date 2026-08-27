/**
 * Daily Stage E Result + Grade close contract.
 * Schema family remains yang-edge-daily-stage-e-result-grade-close-v1.
 * 2026-08-26 unsealed close uses terminal-coverage-gap-v2 metrics.
 * Historical 2026-08-22 artifacts are not rewritten.
 * PASS is never WIN/LOSS/HIT/MISS. Grade = NOT_GRADABLE when predictionCreated=false.
 */
export const DAILY_STAGE_E_RESULT_GRADE_SCHEMA =
  "yang-edge-daily-stage-e-result-grade-close-v1" as const;

export const DAILY_STAGE_E_CLOSE_CONTRACT_V2 =
  "yang-edge-daily-stage-e-terminal-coverage-gap-v2" as const;

export const DAILY_STAGE_E_GRADE_STATUS = "NOT_GRADABLE" as const;
export const DAILY_STAGE_E_GRADE_REASON = "NO_GRADABLE_PREDICTIONS" as const;

export type DailyStageEResultState =
  | "FINAL"
  | "LIVE"
  | "SCHEDULED"
  | "PENDING"
  | "POSTPONED"
  | "CANCELLED"
  | "ABANDONED"
  | "SUSPENDED"
  | "UNSUPPORTED"
  | "NOT_RESOLVED"
  | "IDENTITY_UNRESOLVED";

export type DailyStageEResultIdentityState =
  | "MATCHED"
  | "IDENTITY_UNRESOLVED"
  | "PROVIDER_NOT_SUPPORTED";

export type DailyStageECloseClass =
  | "PROVIDER_CONFIRMED_TERMINAL"
  | "ACTIVE_RESULT_PENDING"
  | "RESULT_IDENTITY_UNRESOLVED_TERMINAL"
  | "RESULT_PROVIDER_UNSUPPORTED_TERMINAL";

export type DailyStageECoverageGapClass =
  | "RESULT_IDENTITY_UNRESOLVED_TERMINAL"
  | "RESULT_PROVIDER_UNSUPPORTED_TERMINAL";

export type DailyStageEStageResult =
  | "PARTIAL_ACTIVE_RESULT_PENDING"
  | "COMPLETED_WITH_RESULT_COVERAGE_GAPS_AND_NOT_GRADABLE"
  | "COMPLETED_ALL_FINAL_NOT_GRADABLE";

export type StageECgame = {
  operatorGameId: string;
  sport: string;
  rawLeagueLabel: string;
  cState: string;
  independentPrediction?: { created?: boolean };
};

export type StageEB1Game = {
  operatorGameId: string;
  sport: string;
  providerFixtureId: string | null;
  providerHomeTeamId?: string | null;
  providerAwayTeamId?: string | null;
  status?: string;
  reasons?: string[];
  rawHome?: string;
  rawAway?: string;
  rawLeagueLabel?: string;
  displayedKickoffUtc?: string;
};

export type DailyStageEProviderCall = {
  provider: "API_BASEBALL" | "API_FOOTBALL" | "NONE";
  endpoint: string;
  purpose: string;
  sport: string;
  fixtureId: string | null;
  cacheMissReason: string | null;
  liveCall: boolean;
};

export type DailyStageEGameRowV1 = {
  operatorGameId: string;
  sport: string;
  league: string;
  cState: string;
  resultIdentityState: DailyStageEResultIdentityState;
  providerFixtureId: string | null;
  resultState: DailyStageEResultState;
  homeScore: number | null;
  awayScore: number | null;
  resultProvider: "API_BASEBALL" | "API_FOOTBALL" | null;
  resultObservedAt: string | null;
  providerStatusRaw: string | null;
  predictionCreated: false;
  gradeState: typeof DAILY_STAGE_E_GRADE_STATUS;
  predictionHit: null;
  gradeReason: typeof DAILY_STAGE_E_GRADE_REASON;
  closeClass: DailyStageECloseClass;
  exactResultLookupAvailable: boolean;
  coverageGapClass: DailyStageECoverageGapClass | null;
  coverageGapReasons: string[];
  coverageGapEvidence: string[];
  pregameIdentityProvenance: string[];
  fuzzyMatchingUsed: false;
};

export type DailyStageEResultCoverageV2 = {
  finalOfScope: string;
  operationallyClosedOfScope: string;
  fullFinalClaim: false | true;
  note: "OPERATIONAL_CLOSE_IS_NOT_FULL_FINAL_COVERAGE" | "FULL_FINAL_COVERAGE";
};

export type DailyStageEResultGradeCloseV1 = {
  schemaVersion: typeof DAILY_STAGE_E_RESULT_GRADE_SCHEMA;
  closeContractVersion: typeof DAILY_STAGE_E_CLOSE_CONTRACT_V2;
  dateKst: string;
  mandatoryStage: "E_RESULT_AND_GRADE";
  weight: 15;
  resultRunAt: string;
  lockedScope: 26;
  scopeTotal: 26;
  accountedFor: number;
  sourceCArtifact: string;
  sourceCHash: string;
  sourceSnapshotArtifact: string;
  sourceSnapshotHash: string;
  sourceB1Artifact: string;
  predictionCount: 0;
  passCount: 26;
  gradedPredictionCount: 0;
  gradedPredictions: 0;
  gradeStatus: typeof DAILY_STAGE_E_GRADE_STATUS;
  gradeReason: typeof DAILY_STAGE_E_GRADE_REASON;
  passConvertedToPredictionCount: 0;
  passHitMissCount: 0;
  passWinLossCount: 0;
  correct: 0;
  incorrect: 0;
  retroactivePredictionAllowed: false;
  retroactiveGradeFabricationAllowed: false;
  resultRequiresCanonical: false;
  fuzzyResultMatching: false;
  engineConnected: false;
  predictionConnected: false;
  marketOddsUsedForGrade: false;
  providerPredictionsEndpointUsed: false;
  playerContextP1EndpointsUsed: false;
  finalResultCount: number;
  pendingResultCount: number;
  unsupportedResultCount: number;
  unresolvedResultCount: number;
  postponedCancelledAbandonedCount: number;
  liveResultCount: number;
  scheduledResultCount: number;
  operationallyClosedCount: number;
  activePendingCount: number;
  terminalCoverageGapCount: number;
  identityCoverageGapCount: number;
  unsupportedCoverageGapCount: number;
  resultCoverage: DailyStageEResultCoverageV2;
  credit: 0;
  providerCalls: DailyStageEProviderCall[];
  providerLiveCallCount: number;
  games: DailyStageEGameRowV1[];
  sportCoverage: {
    KBO: { counted: number; final: number; pending: number };
    NPB: { counted: number; final: number; pending: number };
    FOOTBALL: { counted: number; final: number; pending: number };
    VOLLEYBALL: { counted: number; unsupported: number };
  };
  leakage: {
    pregameArtifactsWritten: false;
    predictionArtifactsWritten: false;
    engineConnected: false;
    cArtifactMutated: false;
  };
  stageResult: DailyStageEStageResult;
  eStatus: "CANDIDATE_COMPLETE" | "PARTIAL";
  officialMandatoryCompletionRemainsPct: 60;
};

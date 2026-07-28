export const BETMAN_DAILY_SLATE_SCHEMA_VERSION = "betman-daily-slate-v1";
export const BETMAN_FULL_SLATE_SCHEMA_VERSION = "betman-full-slate-v1";

export type BetmanDailySlateSourceType =
  | "OPERATOR_MANUAL"
  | "OCR_OPERATOR_REVIEWED";

export type BetmanDailySlateReviewStatus = "DRAFT" | "VERIFIED" | "REJECTED";

export type BetmanSupportedSport =
  | "BASEBALL"
  | "SOCCER"
  | "BASKETBALL"
  | "VOLLEYBALL";

export type BetmanUnsupportedSport = "TENNIS" | "OTHER";

export type BetmanOperatorHomeAwayStatus =
  | "VERIFIED"
  | "UNVERIFIED"
  | "NOT_APPLICABLE";

export type BetmanMarketSelectionCode =
  | "HOME"
  | "AWAY"
  | "DRAW"
  | "HOME_COVER"
  | "AWAY_COVER"
  | "UNDER"
  | "OVER";

export type BetmanMarketRuleStatus = "VERIFIED" | "UNVERIFIED";

export type BetmanMarketSelectionInput = {
  selectionCode: BetmanMarketSelectionCode;
  displayLabel: string;
  oddsDecimal: number | null;
  handicapLine: number | null;
  totalLine: number | null;
  reviewStatus: BetmanDailySlateReviewStatus;
};

export type BetmanSourceReference = {
  sourceType: string | null;
  sourceName: string | null;
  sourceUrl: string | null;
  sourceTitle: string | null;
  capturedBy: string | null;
  capturedAt: string | null;
  notes: string | null;
};

export type BetmanDailySlateGameInput = {
  operatorSlateGameId: string;
  sport: string;
  competitionNameRaw: string;
  competitionNameKo: string | null;
  operatorGameNumber: string | null;
  operatorMarketId: string | null;
  homeTeamRaw: string;
  awayTeamRaw: string;
  scheduledStartTimeKst: string;
  operatorHomeAwayStatus: BetmanOperatorHomeAwayStatus;
  marketTypeRaw: string | null;
  marketRuleStatus: BetmanMarketRuleStatus | null;
  marketSelections: BetmanMarketSelectionInput[];
  capturedAt: string | null;
  reviewStatus: BetmanDailySlateReviewStatus;
  sourceReference: BetmanSourceReference | null;
  providerGameId: string | null;
  providerFixtureId: string | null;
  manualIdentityReference: string | null;
  notes: string | null;
};

export type BetmanDailySlateInputV1 = {
  schemaVersion: typeof BETMAN_DAILY_SLATE_SCHEMA_VERSION;
  targetDateKst: string;
  sourceType: BetmanDailySlateSourceType;
  capturedAt: string | null;
  enteredAt: string | null;
  reviewedAt: string | null;
  reviewStatus: BetmanDailySlateReviewStatus;
  games: BetmanDailySlateGameInput[];
};

export type BetmanOperatorInputStatus =
  | "NOT_ENTERED"
  | "DRAFT"
  | "VERIFIED"
  | "REJECTED"
  | "BLOCKED";

export type BetmanIdentityMatchStatus =
  | "MATCHED"
  | "UNMATCHED"
  | "AMBIGUOUS"
  | "PROVIDER_NOT_IMPLEMENTED"
  | "PROVIDER_GAME_MISSING"
  | "TIME_MISMATCH"
  | "TEAM_MAPPING_MISSING";

export type BetmanAnalysisLevel =
  | "FULL_ANALYSIS"
  | "PARTIAL_ANALYSIS"
  | "MARKET_BASELINE_ONLY"
  | "IDENTITY_ONLY"
  | "BLOCKED";

export type BetmanFullSlateGameRow = {
  operatorSlateGameId: string;
  sport: BetmanSupportedSport | BetmanUnsupportedSport;
  supportedSport: boolean;
  competition: {
    nameRaw: string;
    nameKo: string | null;
    providerLeagueId: string | null;
  };
  internalGameId: string | null;
  providerGameId: string | null;
  awayTeam: string;
  homeTeam: string;
  startTimeKst: string;
  identityStatus: BetmanIdentityMatchStatus;
  analysisLevel: BetmanAnalysisLevel;
  predictionStatus: string;
  datasetStatus: Record<string, string>;
  marketStatus: {
    domesticOdds: string;
    overseasOdds: string;
    marketRuleStatus: BetmanMarketRuleStatus | null;
  };
  resultStatus: string | null;
  missingReasons: string[];
  blockingReasons: string[];
  sourceReferences: BetmanSourceReference[];
  predictedOutcome: string | null;
  modelProbabilities: Record<string, number | null> | null;
  confidence: number | null;
  risk: string | null;
  edgeScore: number | null;
  marketProbabilities: Record<string, number | null> | null;
};

export type BetmanCoverageSummary = {
  totalOperatorGames: number;
  supportedSportGames: number;
  unsupportedSportGames: number;
  baseballGames: number;
  soccerGames: number;
  basketballGames: number;
  volleyballGames: number;
  tennisExcludedGames: number;
  matchedGames: number;
  unmatchedGames: number;
  ambiguousGames: number;
  providerNotImplementedGames: number;
  fullAnalysisGames: number;
  partialAnalysisGames: number;
  marketBaselineGames: number;
  identityOnlyGames: number;
  blockedGames: number;
  predictionGeneratedGames: number;
  predictionMissingGames: number;
  oddsAvailableGames: number;
  oddsMissingGames: number;
  coverageRate: number | null;
  analysisCoverageRate: number | null;
  predictionCoverageRate: number | null;
};

export type BetmanFullSlateDocumentV1 = {
  meta: {
    schemaVersion: typeof BETMAN_FULL_SLATE_SCHEMA_VERSION;
    targetDateKst: string;
    generatedAt: string;
    operatorInputStatus: BetmanOperatorInputStatus;
    researchOnly: true;
    legalStatus: "INTERNAL_RESEARCH_ONLY";
    betmanScope: "MANUAL_SCOPE_ONLY";
    publicDisplay: "LEGAL_CLEARANCE_PENDING";
    commercialUse: "LEGAL_CLEARANCE_PENDING";
    inputHashSha256: string | null;
    resultHashSha256: string;
  };
  coverageSummary: BetmanCoverageSummary;
  sportCounts: Record<string, number>;
  games: BetmanFullSlateGameRow[];
  warnings: string[];
  blockingReasons: string[];
};

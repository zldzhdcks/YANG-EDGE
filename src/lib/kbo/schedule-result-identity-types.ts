/**
 * KBO Schedule / Result Identity Dataset v1 — research-only game identity.
 * Engine admission PROHIBITED. No Prediction / Starter / Bullpen / Lineup.
 */

export const KBO_SCHEDULE_RESULT_IDENTITY_DATASET_ID =
  "kbo-schedule-result-identity";
export const KBO_SCHEDULE_RESULT_IDENTITY_SCHEMA_VERSION =
  "kbo-schedule-result-identity-v1";
export const KBO_SCHEDULE_RESULT_IDENTITY_BUILDER_VERSION =
  "kbo-schedule-result-identity-builder-v1";

export type KboIdentityCollectionPhase =
  | "PRE_GAME_SCHEDULE_IDENTITY"
  | "POST_GAME_RESULT_IDENTITY";

export type KboIdentityProviderId = "THESPORTSDB" | "API_BASEBALL";

export type KboBetmanScopeReference = "MATCHED" | "UNMATCHED" | "NOT_CHECKED";

export type KboTeamMappingStatus = "MATCHED" | "UNMATCHED";

export type KboGameStatus =
  | "SCHEDULED"
  | "LIVE"
  | "FINAL"
  | "DRAW"
  | "POSTPONED"
  | "CANCELLED"
  | "NO_GAME"
  | "SUSPENDED"
  | "INCONCLUSIVE"
  | "UNKNOWN";

export type KboResultStatus =
  | "PENDING"
  | "GRADED"
  | "DRAW"
  | "VOID"
  | "INCONCLUSIVE";

export type KboResultWinner = "HOME" | "AWAY" | "DRAW" | "NONE";

export type KboScheduleChangeReason = "PROVIDER_UPDATE" | "UNKNOWN";

export type KboScheduleChangeEvent =
  | "START_TIME_CHANGED"
  | "POSTPONED"
  | "CANCELLED"
  | "NO_GAME"
  | "SUSPENDED"
  | "VENUE_CHANGED"
  | "UNKNOWN_CHANGE";

export type KboTeamIdentity = {
  providerName: string;
  canonicalNameKo: string | null;
  canonicalNameEn: string | null;
  canonicalTeamId: string | null;
  mappingStatus: KboTeamMappingStatus;
};

export type KboScheduleChangeRecord = {
  event: KboScheduleChangeEvent;
  previousStartTimeKst: string | null;
  currentStartTimeKst: string | null;
  previousVenueName: string | null;
  currentVenueName: string | null;
  detectedAt: string;
  reason: KboScheduleChangeReason;
};

export type KboTimeIntegrity = {
  providerStartTime: string | null;
  startTimeKst: string | null;
  firstObservedAt: string;
  lastObservedAt: string;
  cutoffTime: string | null;
  scheduleChanges: KboScheduleChangeRecord[];
};

export type KboResultIdentity = {
  resultStatus: KboResultStatus;
  homeScore: number | null;
  awayScore: number | null;
  winner: KboResultWinner | null;
};

export type KboProviderRef = {
  id: KboIdentityProviderId;
  leagueId: string;
  legalStatus: "INTERNAL_RESEARCH_ONLY" | "NEEDS_LEGAL_REVIEW";
  publicDisplay: "UNCONFIRMED";
  commercialUse: "UNCONFIRMED";
};

export type KboProviderCrosswalkRef = {
  providerId: KboIdentityProviderId;
  providerGameId: string;
  providerHomeTeamId: string | null;
  providerAwayTeamId: string | null;
  providerStartTime: string | null;
  mappingStatus: "MATCHED" | "AMBIGUOUS" | "UNMATCHED" | "NOT_CHECKED";
  mappingEvidence: string;
  observedAt: string;
};

export type KboScheduleResultIdentityRow = {
  internalGameId: string;
  primaryProvider?: KboIdentityProviderId;
  sport: "baseball";
  league: "KBO";
  season: string | null;
  dateKst: string;
  homeTeam: KboTeamIdentity;
  awayTeam: KboTeamIdentity;
  homeTeamId: string | null;
  awayTeamId: string | null;
  venueName: string | null;
  provider: KboProviderRef;
  providerGameId: string;
  providerStatusRaw: string | null;
  gameStatus: KboGameStatus;
  betmanScopeReference: KboBetmanScopeReference;
  providerRefs?: KboProviderCrosswalkRef[];
  collectionPhase: KboIdentityCollectionPhase;
  time: KboTimeIntegrity;
  result: KboResultIdentity;
  generatedAt: string;
};

export type KboScheduleResultIdentityDocument = {
  meta: {
    datasetId: typeof KBO_SCHEDULE_RESULT_IDENTITY_DATASET_ID;
    schemaVersion: typeof KBO_SCHEDULE_RESULT_IDENTITY_SCHEMA_VERSION;
    builderVersion: typeof KBO_SCHEDULE_RESULT_IDENTITY_BUILDER_VERSION;
    status: "COLLECTING";
    engineAdmission: "PROHIBITED";
    engineConnected: false;
    researchOnly: true;
    dateKst: string;
    collectionPhase: KboIdentityCollectionPhase | "MIXED";
    generatedAt: string;
    inputHashSha256: string;
    resultHashSha256: string;
    legalStatus: "INTERNAL_RESEARCH_ONLY";
    publicDisplay: "UNCONFIRMED";
    commercialUse: "UNCONFIRMED";
    sourceCutoff: string | null;
    notes: string[];
  };
  cacheUsage: {
    rawHit: number;
    rawMiss: number;
    networkCalls: number;
  };
  warnings: string[];
  missing: string[];
  summary: {
    providerGamesFetched: number;
    datasetGamesCreated: number;
    missingProviderGameId: number;
    teamMappingsMatched: number;
    teamMappingsUnmatched: number;
    scheduled: number;
    live: number;
    final: number;
    draw: number;
    postponed: number;
    cancelled: number;
    noGame: number;
    suspended: number;
    unknown: number;
    scheduleChanges: number;
  };
  rows: KboScheduleResultIdentityRow[];
};

export type BuildKboScheduleResultIdentityResult = {
  document: KboScheduleResultIdentityDocument;
  usage: import("./kbo-cache-types").KboCacheUsageStats;
};

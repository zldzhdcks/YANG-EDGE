/**
 * MLB Injury Dataset v1 — research-only pre-game roster / transaction context.
 * Engine admission PROHIBITED. No Injury Score. No expectedReturn / severity inference.
 */

export const INJURY_DATASET_ID = "mlb-injury";
export const INJURY_SCHEMA_VERSION = "mlb-injury-dataset-v1";
export const INJURY_BUILDER_VERSION = "injury-dataset-builder-v1";

export const INJURY_COLLECTION_PHASE = "PRE_GAME_ROSTER" as const;

export const INJURY_PROVIDER_ID = "mlb-stats-api" as const;

export type InjuryDataSource =
  | "mlb-stats-api-40man"
  | "mlb-stats-api-40man+transactions";

export type InjuryDatasetRow = {
  schemaVersion: typeof INJURY_SCHEMA_VERSION;
  builderVersion: typeof INJURY_BUILDER_VERSION;
  generatedAt: string;
  gameDate: string;
  gameId: string;
  gamePk: number;
  teamId: number;
  teamName: string;
  side: "home" | "away";
  collectionPhase: typeof INJURY_COLLECTION_PHASE;
  cutoffTime: string | null;
  researchOnly: true;
  legalStatus: "INTERNAL_RESEARCH_ONLY";
  engineUseAllowed: false;
  playerId: number;
  playerName: string;
  rosterStatusCode: string;
  rosterStatusDescription: string | null;
  injuryListed: true;
  injuryNote: string | null;
  transactionType: string | null;
  transactionDate: string | null;
  source: InjuryDataSource;
  missing: string[];
  warnings: string[];
  inputHash: string;
  resultHash: string;
};

export type InjuryDatasetDocument = {
  meta: {
    datasetId: typeof INJURY_DATASET_ID;
    schemaVersion: typeof INJURY_SCHEMA_VERSION;
    builderVersion: typeof INJURY_BUILDER_VERSION;
    status: "COLLECTING";
    engineAdmission: "PROHIBITED";
    engineConnected: false;
    engineUseAllowed: false;
    researchOnly: true;
    dateKst: string;
    generatedAt: string;
    predictionHashSha256: string;
    predictionUnchanged: true;
    inputHashSha256: string;
    resultHashSha256: string;
    provider: {
      id: typeof INJURY_PROVIDER_ID;
      displayName: "MLB Stats API";
    };
    legal: {
      mlbStatsSource: "INTERNAL_RESEARCH_ONLY";
      publicRuntimeUseAllowed: false;
      commercialRuntimeUseAllowed: false;
      rawResponseInResearchCacheOnly: true;
      mlbHtmlCrawling: false;
      sportsDataIoScrambled: false;
      lineupAbsenceInference: false;
    };
    notes: string[];
  };
  cacheUsage: {
    rawHit: number;
    rawMiss: number;
    derivedHit: number;
    derivedMiss: number;
    networkCalls: number;
  };
  summary: {
    totalGames: number;
    teamsOnSlate: number;
    rosterCollected: number;
    transactionsInWindow: number;
    injuryListedRows: number;
    rowsWithTransaction: number;
  };
  rows: InjuryDatasetRow[];
};

export type BuildInjuryDatasetResult = {
  document: InjuryDatasetDocument;
  usage: import("./research-stats-cache").CacheUsageStats;
};

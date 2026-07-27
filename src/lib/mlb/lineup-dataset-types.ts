/**
 * MLB Lineup Dataset v1 — research-only types.
 * Engine admission PROHIBITED. No Lineup Score.
 */

export const LINEUP_DATASET_ID = "mlb-lineup";
export const LINEUP_SCHEMA_VERSION = "mlb-lineup-dataset-v1";
export const LINEUP_BUILDER_VERSION = "lineup-dataset-builder-v1";

export type LineupSide = "home" | "away";
export type LineupType = "ACTUAL_STARTING";
export type LineupCollectionPhase = "POST_GAME";
export type LineupStatus = "COMPLETE" | "INCOMPLETE";
export type PreGameLineupStatus = "NOT_COLLECTED";

export type LineupBatterRow = {
  slot: number;
  playerId: number;
  playerName: string;
  defensivePosition: string | null;
  isDh: boolean;
  isSubstitute: false;
};

export type LineupSubstituteRow = {
  slot: number | null;
  playerId: number;
  playerName: string;
  defensivePosition: string | null;
  battingOrderCode: string;
  isSubstitute: true;
};

export type LineupDatasetRow = {
  schemaVersion: typeof LINEUP_SCHEMA_VERSION;
  builderVersion: typeof LINEUP_BUILDER_VERSION;
  generatedAt: string;
  gameDate: string;
  gameId: string;
  gamePk: number;
  teamId: number;
  teamName: string;
  opponentTeamId: number;
  opponentTeamName: string;
  side: LineupSide;
  lineupType: LineupType;
  collectionPhase: LineupCollectionPhase;
  /** Pre-game snapshot never backfilled from post-game boxscore. */
  preGameStatus: PreGameLineupStatus;
  sourceTimestamp: string | null;
  cutoffTime: string | null;
  lineupStatus: LineupStatus;
  battingOrder: LineupBatterRow[];
  /** Separated replacements — not a v1 analysis variable. */
  substitutes: LineupSubstituteRow[];
  missingFields: string[];
  warnings: string[];
  researchOnly: true;
  legalStatus: "INTERNAL_RESEARCH_ONLY";
  engineUseAllowed: false;
  inputHash: string;
  resultHash: string;
};

export type LineupDatasetDocument = {
  meta: {
    datasetId: typeof LINEUP_DATASET_ID;
    schemaVersion: typeof LINEUP_SCHEMA_VERSION;
    builderVersion: typeof LINEUP_BUILDER_VERSION;
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
    legal: {
      mlbStatsSource: "INTERNAL_RESEARCH_ONLY";
      publicRuntimeUseAllowed: false;
      commercialRuntimeUseAllowed: false;
      rawResponseInResearchCacheOnly: true;
      mlbHtmlCrawling: false;
      sportsDataIoScrambled: false;
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
    teamLineups: number;
    completeLineups: number;
    incompleteLineups: number;
    totalStarters: number;
    battingSlotDuplicates: number;
    battingSlotMissing: number;
    substitutesSeparated: number;
    startersMarkedSubstitute: number;
    preGameStatus: PreGameLineupStatus;
    postGameStatuses: Record<LineupStatus, number>;
    battingSideCollected: 0;
    peopleApiCalls: 0;
  };
  rows: LineupDatasetRow[];
};

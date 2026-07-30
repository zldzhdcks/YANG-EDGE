/**
 * MLB Lineup Dataset v1 — research-only types.
 * Engine admission PROHIBITED. No Lineup Score.
 *
 * Schedule-first independent intake: Prediction Snapshot is not an input.
 */

export const LINEUP_DATASET_ID = "mlb-lineup";
export const LINEUP_SCHEMA_VERSION = "mlb-lineup-dataset-v1";
export const LINEUP_BUILDER_VERSION = "lineup-dataset-builder-v1";

export type LineupSide = "home" | "away";
export type LineupType = "ACTUAL_STARTING";
export type LineupCollectionPhase = "POST_GAME" | "PRE_GAME";
export type LineupStatus = "COMPLETE" | "INCOMPLETE";
export type PreGameLineupStatus = "NOT_COLLECTED";

/** Per-game (and per-team row) collection status for independent intake. */
export type LineupCollectionStatus =
  | "CONFIRMED"
  | "PARTIAL"
  | "NOT_RELEASED"
  | "NOT_COLLECTED"
  | "PROVIDER_ERROR"
  | "MATCH_NOT_FOUND"
  | "INVALID_RESPONSE";

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
  /** Alias for schedule-first consumers. */
  internalGameId?: string;
  gamePk: number;
  teamId: number;
  teamName: string;
  opponentTeamId: number;
  opponentTeamName: string;
  side: LineupSide;
  startTimeKst?: string | null;
  lineupType: LineupType;
  collectionPhase: LineupCollectionPhase;
  /** Pre-game snapshot never backfilled from post-game boxscore. */
  preGameStatus: PreGameLineupStatus;
  /** Independent intake status (additive). */
  collectionStatus?: LineupCollectionStatus;
  reason?: string | null;
  /** Official confirmed lineup when true. */
  confirmed?: boolean;
  /** mlb-statsapi-boxscore | mlb-statsapi-schedule-lineups | null */
  lineupSource?: string | null;
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
    /** Schedule artifact path (additive). */
    scheduleSource?: string;
    /** Lineup data source label (additive). */
    lineupSource?: string;
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
    /** Additive independent-intake counters (game-level). */
    confirmedGames?: number;
    partialGames?: number;
    notReleasedGames?: number;
    notCollectedGames?: number;
    collectionStatus?: Record<LineupCollectionStatus, number>;
  };
  rows: LineupDatasetRow[];
};

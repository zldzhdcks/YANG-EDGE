/**
 * MLB Odds History Dataset v1 — research-only pre-game market snapshot.
 * Engine admission PROHIBITED. No Closing/Post-game odds. No Odds Score.
 *
 * Independent intake (v1): Schedule artifact + authorized Odds Provider.
 * Prediction Snapshot is optional supplemental metadata only.
 */

export const ODDS_HISTORY_DATASET_ID = "mlb-odds-history";
export const ODDS_HISTORY_SCHEMA_VERSION = "mlb-odds-history-dataset-v1";
export const ODDS_HISTORY_BUILDER_VERSION = "odds-history-dataset-builder-v1";

export const ODDS_HISTORY_COLLECTION_PHASE = "PRE_GAME_MARKET" as const;

export const ODDS_HISTORY_PROVIDER_ID = "the-odds-api" as const;

export type OddsHistoryMovement =
  | "UP"
  | "DOWN"
  | "UNCHANGED"
  | "NOT_COLLECTED";

/** Primary row marketType kept for backward compatibility (moneyline/h2h). */
export type OddsHistoryMarketType = "h2h";

export type OddsHistoryBookmakerLabel = "AGGREGATE_BEST";

export type OddsHistoryJoinQuality =
  | "MATCHED"
  | "MISSING_ODDS"
  | "TIMELINE_ONLY";

/** Per-game collection status for independent intake. */
export type OddsCollectionStatus =
  | "COLLECTED"
  | "PARTIAL"
  | "NOT_COLLECTED"
  | "PROVIDER_ERROR"
  | "MATCH_NOT_FOUND"
  | "INVALID_RESPONSE";

export type OddsNormalizedMarketType =
  | "moneyline"
  | "run_line"
  | "total";

export type OddsNormalizedMarket = {
  marketType: OddsNormalizedMarketType;
  selection: string;
  priceAmerican: number | null;
  priceDecimal: number | null;
  point: number | null;
  bookmaker: string | null;
  capturedAt: string | null;
  status: "COLLECTED" | "NOT_COLLECTED";
  reason: string | null;
};

export type OddsHistoryProviderSnapshot = {
  id: typeof ODDS_HISTORY_PROVIDER_ID | "NOT_COLLECTED";
  displayName: string;
  sportKey: string | null;
};

export type OddsHistoryDatasetRow = {
  schemaVersion: typeof ODDS_HISTORY_SCHEMA_VERSION;
  builderVersion: typeof ODDS_HISTORY_BUILDER_VERSION;
  generatedAt: string;
  gameDate: string;
  gameId: string;
  /** Alias for consumers expecting internalGameId naming. */
  internalGameId?: string;
  homeTeam: string;
  awayTeam: string;
  startTimeKst?: string | null;
  baselinePick: string | null;
  collectionPhase: typeof ODDS_HISTORY_COLLECTION_PHASE;
  cutoffTime: string | null;
  researchOnly: true;
  legalStatus: "REFERENCE_ODDS_RESEARCH_ONLY";
  engineUseAllowed: false;
  joinQuality: OddsHistoryJoinQuality;
  /** Independent intake status (backward-compatible additive). */
  collectionStatus?: OddsCollectionStatus;
  /** Human-readable reason / notes for collectionStatus. */
  reason?: string | null;
  openingOdds: number | null;
  latestOdds: number | null;
  marketProbability: number | null;
  provider: OddsHistoryProviderSnapshot;
  bookmaker: OddsHistoryBookmakerLabel | null;
  marketType: OddsHistoryMarketType;
  movement: OddsHistoryMovement;
  capturedAt: string | null;
  oddsEventId: string | null;
  bookmakerCount: number | null;
  /** Normalized moneyline / run_line / total (additive). */
  markets?: OddsNormalizedMarket[];
  missing: string[];
  warnings: string[];
  inputHash: string;
  resultHash: string;
};

export type OddsHistoryDatasetDocument = {
  meta: {
    datasetId: typeof ODDS_HISTORY_DATASET_ID;
    schemaVersion: typeof ODDS_HISTORY_SCHEMA_VERSION;
    builderVersion: typeof ODDS_HISTORY_BUILDER_VERSION;
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
    /** Provider display (additive). */
    provider?: string;
    legal: {
      oddsSource: "REFERENCE_ODDS_PROVIDER";
      publicRuntimeUseAllowed: false;
      commercialRuntimeUseAllowed: false;
      rawResponseInResearchCacheOnly: true;
      closingOddsCollected: false;
      postGameOddsCollected: false;
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
    openingCollected: number;
    latestCollected: number;
    marketProbabilityCollected: number;
    /** Additive independent-intake counters. */
    collectedGames?: number;
    partialGames?: number;
    notCollectedGames?: number;
    movement: Record<OddsHistoryMovement, number>;
    joinQuality: Record<OddsHistoryJoinQuality, number>;
    collectionStatus?: Record<OddsCollectionStatus, number>;
  };
  rows: OddsHistoryDatasetRow[];
};

export type BuildOddsHistoryDatasetResult = {
  document: OddsHistoryDatasetDocument;
  usage: import("./research-stats-cache").CacheUsageStats;
};

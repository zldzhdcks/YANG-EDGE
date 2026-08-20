/**
 * MLB Batter Dataset v0 — pregame research intake.
 * Engine admission PROHIBITED. Independent model sample stays 0.
 * Market / odds are not inputs.
 */
export const BATTER_DATASET_ID = "mlb-batter";
export const BATTER_SCHEMA_VERSION = "mlb-batter-dataset-v0";
export const BATTER_BUILDER_VERSION = "batter-dataset-builder-v0";

export type BatterBats = "L" | "R" | "S" | "UNKNOWN";

export type BatterLineupStatus = "CONFIRMED" | "EXPECTED" | "UNAVAILABLE";

export type BatterRowStatus =
  | "READY"
  | "PARTIAL"
  | "IDENTITY_MISSING"
  | "STATS_MISSING"
  | "LINEUP_NOT_CONFIRMED"
  | "CUTOFF_UNSAFE"
  | "PROVIDER_ERROR";

export type BatterReconstructionSafety =
  | "PREGAME_SAFE"
  | "HISTORICAL_RECONSTRUCTION_UNSAFE"
  | "NOT_BACKFILLABLE_V0";

export type BatterCountingStats = {
  gamesPlayed: number | null;
  plateAppearances: number | null;
  atBats: number | null;
  hits: number | null;
  doubles: number | null;
  triples: number | null;
  homeRuns: number | null;
  runs: number | null;
  rbi: number | null;
  baseOnBalls: number | null;
  strikeOuts: number | null;
  hitByPitch: number | null;
  sacFlies: number | null;
  totalBases: number | null;
};

export type BatterRateStats = {
  avg: number | null;
  obp: number | null;
  slg: number | null;
  ops: number | null;
  babip: number | null;
};

export type BatterSampleSize = {
  games: number | null;
  pa: number | null;
  ab: number | null;
};

export type BatterDerivedMeta = {
  derived: boolean;
  formula: string | null;
  sourceInputs: string[];
  denominator: string | null;
};

export type BatterSlotRow = {
  battingOrder: number;
  playerId: number | null;
  playerName: string | null;
  position: string | null;
  bats: BatterBats;
  primaryPosition: string | null;
  lineupStatus: BatterLineupStatus;
  lineupObservedAt: string | null;
  lineupSource: string | null;
  rowStatus: BatterRowStatus;
  sampleSize: BatterSampleSize;
  counting: BatterCountingStats;
  rates: BatterRateStats;
  countingDerived: BatterDerivedMeta;
  ratesDerived: BatterDerivedMeta;
  statsThroughDate: string | null;
  latestIncludedGameDate: string | null;
  statsSource: string | null;
  recentCondition: null;
  splits: null;
  advanced: null;
  warnings: string[];
};

export type BatterSideBlock = {
  teamId: number | null;
  teamName: string | null;
  lineupStatus: BatterLineupStatus;
  batters: BatterSlotRow[];
};

export type BatterGameRow = {
  schemaVersion: typeof BATTER_SCHEMA_VERSION;
  builderVersion: typeof BATTER_BUILDER_VERSION;
  gameId: string;
  gamePk: number;
  commenceTimeUtc: string;
  officialDate: string | null;
  capturedAt: string;
  cutoffStatus: BatterReconstructionSafety;
  statsThroughDate: string | null;
  home: BatterSideBlock;
  away: BatterSideBlock;
  warnings: string[];
  researchOnly: true;
  engineUseAllowed: false;
  predictionInputAllowed: false;
};

export type BatterDatasetDocument = {
  meta: {
    datasetId: typeof BATTER_DATASET_ID;
    schemaVersion: typeof BATTER_SCHEMA_VERSION;
    builderVersion: typeof BATTER_BUILDER_VERSION;
    dateKst: string;
    generatedAt: string;
    capturedAt: string;
    researchOnly: true;
    engineUseAllowed: false;
    predictionInputAllowed: false;
    engineAdmission: "PROHIBITED";
    independentModelSample: 0;
    marketDataAllowed: false;
    koreanMarketInput: false;
    overseasMarketInput: false;
    provider: "mlb-stats-api";
    leakagePolicy: "SAME_DAY_GAME_RESULT_EXCLUDED";
    reconstructionSafety: BatterReconstructionSafety;
    allowNetwork: boolean;
    networkCalls: number;
    uniquePlayerIds: number;
    providerFetchesAttempted: number;
    providerFetchesDeduped: number;
    deterministic: true;
    sourceArtifacts: string[];
    sourceArtifactHashes: Record<string, string>;
    predictionHashSha256: string;
    predictionUnchanged: true;
    inputHashSha256: string;
    datasetHashSha256: string;
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
    confirmedGames: number;
    expectedOnlyGames: number;
    unavailableGames: number;
    totalBatterSlots: number;
    joinedPlayerIds: number;
    batsResolved: number;
    statsReady: number;
    partial: number;
    blocked: number;
    identityMissing: number;
    statsMissing: number;
    cutoffUnsafe: number;
    providerError: number;
  };
  games: BatterGameRow[];
};

export function emptyCounting(): BatterCountingStats {
  return {
    gamesPlayed: null,
    plateAppearances: null,
    atBats: null,
    hits: null,
    doubles: null,
    triples: null,
    homeRuns: null,
    runs: null,
    rbi: null,
    baseOnBalls: null,
    strikeOuts: null,
    hitByPitch: null,
    sacFlies: null,
    totalBases: null,
  };
}

export function emptyRates(): BatterRateStats {
  return {
    avg: null,
    obp: null,
    slg: null,
    ops: null,
    babip: null,
  };
}

export function emptySampleSize(): BatterSampleSize {
  return { games: null, pa: null, ab: null };
}

export function emptyDerived(): BatterDerivedMeta {
  return {
    derived: false,
    formula: null,
    sourceInputs: [],
    denominator: null,
  };
}

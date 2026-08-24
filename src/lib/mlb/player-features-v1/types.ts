/**
 * MLB Pregame Player Feature Dataset v1 — research sidecar only.
 *
 * Identity (lineup / starter) is not Player Strength.
 * Engine admission PROHIBITED. Independent model sample stays 0.
 * Market / odds / win probability are not inputs.
 */
export const PLAYER_FEATURES_DATASET_ID = "mlb-pregame-player-features" as const;
export const PLAYER_FEATURES_SCHEMA_VERSION =
  "mlb-pregame-player-feature-dataset-v1" as const;
export const PLAYER_FEATURES_BUILDER_VERSION = "player-features-builder-v1" as const;
export const PLAYER_FEATURES_TEMPORAL_POLICY = "OFFICIAL_DATE_MINUS_ONE_DAY" as const;

export type HandCode = "L" | "R" | "S" | "UNKNOWN";
export type TeamSide = "home" | "away";
export type PlayerRole = "BATTER" | "STARTER";

export type LineupIdentityStatus =
  | "CONFIRMED"
  | "PARTIAL"
  | "UNAVAILABLE";

export type FeatureGameStatus =
  | "READY"
  | "PARTIAL"
  | "BLOCKED_POST_CUTOFF"
  | "BLOCKED_NO_CONFIRMED_LINEUP"
  | "SKIPPED_DRY_RUN"
  | "CACHE_MISS";

export type ProvenanceClass =
  | "TRUE_LIVE_PREGAME_CAPTURE"
  | "HISTORICAL_POINT_IN_TIME_RECONSTRUCTION"
  | "UNKNOWN"
  | "NOT_PROVABLE";

export type Availability =
  | "COLLECTED"
  | "NOT_COLLECTED"
  | "NOT_AVAILABLE"
  | "NOT_PROVABLE";

export type SampleReliability =
  | "INSUFFICIENT"
  | "LOW"
  | "MODERATE"
  | "HIGH";

export type RecentWindowId = "LAST_14_DAYS" | "LAST_30_DAYS";
export type PlatoonSplitId = "VS_LHP" | "VS_RHP";

export type DerivedRate = {
  value: number | null;
  formula: string;
  numerator: number | null;
  denominator: number | null;
  numeratorField: string;
  denominatorField: string;
  sampleSize: number | null;
  parentAvailable: boolean;
};

export type CountingBlock = {
  pa: number | null;
  ab: number | null;
  h: number | null;
  doubles: number | null;
  triples: number | null;
  hr: number | null;
  bb: number | null;
  so: number | null;
  tb: number | null;
  gamesPlayed: number | null;
};

export type RateBlock = {
  avg: number | null;
  obp: number | null;
  slg: number | null;
  ops: number | null;
  babip: number | null;
  iso: DerivedRate;
};

export type DerivedRateBlock = {
  kRate: DerivedRate;
  bbRate: DerivedRate;
  hrRate: DerivedRate;
};

export type FeatureWindow = {
  windowId: "SEASON_TO_DATE" | RecentWindowId;
  windowStartDate: string | null;
  windowEndDate: string;
  counting: CountingBlock;
  rates: RateBlock;
  derived: DerivedRateBlock;
  sampleSizePa: number | null;
  reliability: SampleReliability;
  latestIncludedGameDate: string | null;
  excludedTargetGame: number;
  excludedOnOrAfterOfficialDate: number;
  availability: Availability;
};

export type PlatoonSplit = {
  splitId: PlatoonSplitId;
  pa: number | null;
  avg: number | null;
  obp: number | null;
  slg: number | null;
  ops: number | null;
  babip: number | null;
  hr: number | null;
  bb: number | null;
  so: number | null;
  sampleSizePa: number | null;
  reliability: SampleReliability;
  availability: Availability;
  dateBounded: boolean;
};

export type BatterFeatureRow = {
  dateKst: string;
  gamePk: number;
  officialDate: string | null;
  homeTeam: string;
  awayTeam: string;
  teamSide: TeamSide;
  commenceTimeUtc: string;
  cutoffTime: string;
  playerId: number;
  playerName: string | null;
  role: "BATTER";
  battingOrder: number;
  bats: HandCode;
  defensivePosition: string | null;
  seasonToDate: FeatureWindow;
  last14Days: FeatureWindow;
  last30Days: FeatureWindow;
  platoon: {
    vsLhp: PlatoonSplit;
    vsRhp: PlatoonSplit;
    opponentStarterThrows: HandCode;
    selectedPlatoonSplit: PlatoonSplitId | null;
    numericMatchupAdjustment: null;
  };
  advanced: {
    woba: { value: null; availability: Availability };
    wrcPlus: { value: null; availability: Availability };
  };
  provenance: RowProvenance;
  warnings: string[];
};

export type PitchArsenalPitch = {
  pitchType: string | null;
  usagePct: number | null;
  averageSpeed: number | null;
  count: number | null;
};

export type StarterFeatureRow = {
  dateKst: string;
  gamePk: number;
  officialDate: string | null;
  homeTeam: string;
  awayTeam: string;
  teamSide: TeamSide;
  commenceTimeUtc: string;
  cutoffTime: string;
  playerId: number | null;
  playerName: string | null;
  role: "STARTER";
  throws: HandCode;
  starterStatus: "PROBABLE" | "CONFIRMED" | "MISSING";
  seasonToDate: {
    ip: number | null;
    era: number | null;
    whip: number | null;
    so: number | null;
    bb: number | null;
    hr: number | null;
    bf: number | null;
    gamesStarted: number | null;
    derived: {
      kRate: DerivedRate;
      bbRate: DerivedRate;
      kMinusBbRate: DerivedRate;
      hr9: DerivedRate;
    };
    sampleSizeBf: number | null;
    sampleSizeIp: number | null;
    reliability: SampleReliability;
    latestIncludedGameDate: string | null;
    excludedTargetGame: number;
    excludedOnOrAfterOfficialDate: number;
    availability: Availability;
  };
  advanced: {
    fip: { value: null; availability: Availability };
    xfip: { value: null; availability: Availability };
  };
  pitchArsenal: {
    pitches: PitchArsenalPitch[];
    availability: Availability;
    provenanceClass: ProvenanceClass;
    reason: string;
  };
  provenance: RowProvenance;
  warnings: string[];
};

export type RowProvenance = {
  provider: "mlb-stats-api";
  queryFamily: string;
  statsWindowEndDate: string;
  gameCutoff: string;
  capturedAt: string | null;
  cacheRel: string | null;
  evidenceHash: string | null;
  suppliedBy: "NETWORK" | "CACHE" | "INJECTED" | "NONE";
  provenanceClass: ProvenanceClass;
  preGameSafe: boolean;
};

export type SideFeatureBlock = {
  teamName: string;
  lineupStatus: LineupIdentityStatus;
  batters: BatterFeatureRow[];
  starter: StarterFeatureRow;
};

export type PlayerFeatureGame = {
  gamePk: number;
  officialDate: string | null;
  commenceTimeUtc: string;
  cutoffStatus: "BEFORE_CUTOFF" | "POST_CUTOFF";
  homeTeam: string;
  awayTeam: string;
  away: SideFeatureBlock;
  home: SideFeatureBlock;
  featureStatus: FeatureGameStatus;
  blockers: string[];
  lineupReference: string | null;
  lineupObservationId: string | null;
  lineupPayloadHash: string | null;
};

export type FeatureCatalogEntry = {
  featureId: string;
  group: "BATTER" | "STARTER" | "DATASET";
  implemented: boolean;
  availability: Availability;
  notes: string;
};

export type PlayerFeatureDatasetDocument = {
  schemaVersion: typeof PLAYER_FEATURES_SCHEMA_VERSION;
  datasetId: typeof PLAYER_FEATURES_DATASET_ID;
  builderVersion: typeof PLAYER_FEATURES_BUILDER_VERSION;
  dateKst: string;
  generatedAt: string;
  researchOnly: true;
  marketDataAllowed: false;
  predictionInputAllowed: false;
  engineUseAllowed: false;
  engineAdmission: "PROHIBITED";
  independentModelSample: 0;
  playerStrengthGenerated: false;
  winProbabilityGenerated: false;
  bullpenImplemented: false;
  temporalPolicy: typeof PLAYER_FEATURES_TEMPORAL_POLICY;
  providerSummary: {
    provider: "mlb-stats-api";
    featureFetchAttempts: number;
    networkCalls: number;
    cacheHits: number;
    cacheMisses: number;
    injectedLookups: number;
  };
  scheduleReference: string;
  lineupReference: string;
  starterReference: string;
  games: PlayerFeatureGame[];
  featureCatalog: FeatureCatalogEntry[];
  deferredFeatures: string[];
  provenance: {
    liveVsHistorical: "LIVE_SAFE_INFRASTRUCTURE_ONLY";
    historicalBackfill: false;
    unknownNeverPromotedToPreGameSafe: true;
  };
  datasetHash: string;
};

export type PlayerFeatureManifestV1 = {
  schemaVersion: "mlb-pregame-player-feature-manifest-v1";
  dateKst: string;
  generatedAt: string;
  datasetRel: string;
  datasetHash: string;
  writeOnce: true;
  dryRun: boolean;
  cacheOnly: boolean;
  games: number;
  blockedPostCutoff: number;
  blockedNoConfirmedLineup: number;
  featureFetchAttempts: number;
  networkCalls: number;
  written: boolean;
  skippedExisting: boolean;
  researchOnly: true;
  engineAdmission: "PROHIBITED";
  independentModelSample: 0;
  notes: string[];
};

export type ScheduleGameLite = {
  gameId: string;
  gamePk: number;
  homeTeam: string;
  awayTeam: string;
  commenceTimeUtc: string;
  officialDate: string | null;
};

export type IdentityBatter = {
  battingOrder: number;
  playerId: number;
  playerName: string | null;
  defensivePosition: string | null;
  bats: HandCode;
};

export type IdentityPitcher = {
  playerId: number | null;
  playerName: string | null;
  throws: HandCode;
  starterStatus: "PROBABLE" | "CONFIRMED" | "MISSING";
};

export type GameIdentity = {
  gamePk: number;
  lineupStatus: LineupIdentityStatus;
  collectionPhase: "PRE_GAME" | "POST_GAME_OR_LATE" | "UNKNOWN" | null;
  home: { teamName: string; batters: IdentityBatter[] };
  away: { teamName: string; batters: IdentityBatter[] };
  homeStarter: IdentityPitcher;
  awayStarter: IdentityPitcher;
  lineupObservationId: string | null;
  lineupPayloadHash: string | null;
  lineupRel: string | null;
};

export type PlayerFeatureStatLookup = {
  person?: (playerId: number) => unknown | null;
  hittingGameLog?: (playerId: number) => unknown | null;
  pitchingGameLog?: (playerId: number) => unknown | null;
  hittingSplits?: (playerId: number) => unknown | null;
  hittingSplitsDateBounded?: (playerId: number) => boolean;
};

/**
 * MLB lineup refresh v1 — immutable payload blobs + observation events.
 * Research sidecar. Prediction does not read this. Engine admission PROHIBITED.
 *
 * CONTENT IDENTITY = payloadHash of the provider body.
 * OBSERVATION IDENTITY = observationId of a specific refresh event.
 */
export const LINEUP_REFRESH_SCHEMA = "mlb-lineup-refresh-v1" as const;
export const LINEUP_PAYLOAD_SCHEMA = "mlb-lineup-payload-v1" as const;
export const LINEUP_OBSERVATION_SCHEMA = "mlb-lineup-observation-v1" as const;
export const LINEUP_RAW_SNAPSHOT_SCHEMA = LINEUP_OBSERVATION_SCHEMA;
export const LINEUP_REFRESH_MANIFEST_SCHEMA =
  "mlb-lineup-refresh-manifest-v1" as const;
export const BATTER_PREGAME_GAME_SCHEMA = "mlb-batter-pregame-game-v1" as const;
export const BATTER_PREGAME_MANIFEST_SCHEMA =
  "mlb-batter-pregame-manifest-v1" as const;

export const LINEUP_REFRESH_MODE = "PRE_GAME_REFRESH" as const;
export const LINEUP_CACHE_POLICY = "IMMUTABLE_APPEND_ONLY" as const;

/**
 * Deterministic latest-admissible rule (observations, not unique payloads):
 * 1. Candidates must be collectionPhase=PRE_GAME (positive temporal proof).
 * 2. eventTime = valid sourceTimestamp if present, else capturedAt.
 * 3. Latest eventTime wins (ISO string DESC).
 * 4. Tie-break observationId DESC (stable).
 *
 * Mixed sourceTimestamp availability: each observation uses its own eventTime.
 * A capture-only PRE_GAME at 10:20 beats a source-stamped PRE_GAME at 10:00.
 * Lineup shape never manufactures PRE_GAME.
 */
export const LATEST_ADMISSIBLE_PREGAME_SNAPSHOT_RULE =
  "PRE_GAME observations only; eventTime=sourceTimestamp if valid else capturedAt; latest eventTime DESC; then observationId DESC";

export type LineupRefreshCollectionStatus =
  | "CONFIRMED"
  | "PARTIAL"
  | "NOT_RELEASED"
  | "PROVIDER_ERROR";

export type LineupRefreshCollectionPhase =
  | "PRE_GAME"
  | "POST_GAME_OR_LATE"
  | "UNKNOWN";

export type LineupRefreshTemporalProof =
  | "SOURCE_TIMESTAMP"
  | "CAPTURE_TIMESTAMP"
  | "NONE";

export type LineupRefreshSkipReason =
  | "POST_CUTOFF_SKIPPED"
  | "DRY_RUN"
  | "NO_PROVIDER"
  | "CACHE_ONLY"
  | "FETCH_FAILED"
  | "IDEMPOTENT_EXACT_DUPLICATE";

export type LineupPayloadBlobV1 = {
  schemaVersion: typeof LINEUP_PAYLOAD_SCHEMA;
  payloadHash: string;
  provider: "mlb-stats-api";
  researchOnly: true;
  body: unknown;
};

export type LineupObservationV1 = {
  schemaVersion: typeof LINEUP_OBSERVATION_SCHEMA;
  observationId: string;
  dateKst: string;
  gamePk: number;
  internalGameId: string | null;
  homeTeam: string | null;
  awayTeam: string | null;
  provider: "mlb-stats-api";
  source: "INTERNAL_RESEARCH_ONLY";
  endpoint: string;
  lineupSource: "mlb-statsapi-boxscore";
  capturedAt: string;
  fetchedAt: string;
  sourceTimestamp: string | null;
  temporalProof: LineupRefreshTemporalProof;
  payloadHash: string;
  payloadRel: string;
  hash: string;
  httpStatus: number;
  ok: boolean;
  refreshMode: typeof LINEUP_REFRESH_MODE;
  cachePolicy: typeof LINEUP_CACHE_POLICY;
  cutoffTime: string | null;
  collectionPhase: LineupRefreshCollectionPhase;
  beforeCutoff: boolean | null;
  collectionStatus: LineupRefreshCollectionStatus;
  confirmed: boolean;
  homeComplete: boolean;
  awayComplete: boolean;
  homeStarterCount: number;
  awayStarterCount: number;
  playerIds: number[];
  warnings: string[];
  researchOnly: true;
  engineUseAllowed: false;
  predictionInputAllowed: false;
  engineAdmission: "PROHIBITED";
  marketDataAllowed: false;
  independentModelSample: 0;
  /** Hydrated from the payload blob when listing. Not stored on the observation file. */
  body?: unknown;
};

/** Hydrated observation used by resolver / batter capture / lineup dataset. */
export type LineupRawSnapshotV1 = LineupObservationV1 & { body: unknown };

export type LineupSelectedSnapshotV1 = {
  gamePk: number;
  selected: boolean;
  observationId: string | null;
  payloadHash: string | null;
  capturedAt: string | null;
  fetchedAt: string | null;
  sourceTimestamp: string | null;
  temporalProof: LineupRefreshTemporalProof | null;
  collectionPhase: LineupRefreshCollectionPhase | null;
  collectionStatus: LineupRefreshCollectionStatus | null;
  confirmed: boolean;
  playerIdCount: number;
  why: string;
  blocker: string | null;
};

export type LineupGameRefreshRowV1 = {
  gamePk: number;
  internalGameId: string | null;
  cutoffTime: string | null;
  beforeCutoffAtRun: boolean;
  refreshAttempted: boolean;
  providerCalled: boolean;
  skipReason: LineupRefreshSkipReason | null;
  observationWritten: boolean;
  payloadWritten: boolean;
  identicalPayload: boolean;
  exactDuplicateSkip: boolean;
  observationCount: number;
  uniquePayloadCount: number;
  selected: LineupSelectedSnapshotV1;
  batterCapture: "WRITTEN" | "SKIPPED_SEALED" | "NOT_ELIGIBLE" | "DRY_RUN";
  /** Compat */
  newSnapshot: boolean;
  duplicatePayload: boolean;
  snapshotCount: number;
};

export type LineupRefreshManifestSummaryV1 = {
  scheduleGames: number;
  games: number;
  refreshAttempts: number;
  providerCalls: number;
  observationsWritten: number;
  identicalPayloadObservations: number;
  uniquePayloadCount: number;
  idempotentExactDuplicateSkips: number;
  postCutoffSkips: number;
  providerDisabledSkips: number;
  batterCapturesWritten: number;
  batterCaptureExistingSkips: number;
  gamesBeforeCutoff: number;
  gamesAfterCutoff: number;
  confirmedGames: number;
  partialGames: number;
  notReleasedGames: number;
  unknownTemporalStates: number;
  gamesWithAdmissiblePregameSnapshot: number;
  gamesWithBatterCaptureComplete: number;
  blockedGames: number;
  /** Compat aliases */
  beforeCutoff: number;
  refreshAttempted: number;
  newRawSnapshots: number;
  lineupObservationsCaptured: number;
  duplicatePayloads: number;
  providerConfirmed: number;
  pregameAdmissibleConfirmed: number;
  partial: number;
  unavailable: number;
  unknownTimestampBlocked: number;
  postCutoffSkipped: number;
  skippedAlreadySealedGames: number;
};

export type LineupRefreshBlockedReasonV1 = {
  gamePk: number;
  reason: string;
};

export type LineupRefreshManifestV1 = {
  schemaVersion: typeof LINEUP_REFRESH_MANIFEST_SCHEMA;
  dateKst: string;
  generatedAt: string;
  refreshMode: typeof LINEUP_REFRESH_MODE;
  cachePolicy: typeof LINEUP_CACHE_POLICY;
  resolverRule: typeof LATEST_ADMISSIBLE_PREGAME_SNAPSHOT_RULE;
  observationIdFormula: "sha256(gamePk + canonicalCapturedAt + payloadHash + provider)";
  researchOnly: true;
  engineUseAllowed: false;
  predictionInputAllowed: false;
  engineAdmission: "PROHIBITED";
  marketDataAllowed: false;
  independentModelSample: 0;
  predictionExecuted: false;
  dryRun: boolean;
  noProvider: boolean;
  cacheOnly: boolean;
  summary: LineupRefreshManifestSummaryV1;
  blockedReasons: LineupRefreshBlockedReasonV1[];
  games: LineupGameRefreshRowV1[];
};

export type BatterPregameSlotV1 = {
  battingOrder: number;
  playerId: number | null;
  playerName: string | null;
  position: string | null;
  bats: "L" | "R" | "S" | "UNKNOWN";
  statsThroughDate: string;
  statsSource: string | null;
  latestIncludedGameDate: string | null;
  counting: {
    gamesPlayed: number | null;
    plateAppearances: number | null;
    atBats: number | null;
    hits: number | null;
    homeRuns: number | null;
  };
  rates: {
    avg: number | null;
    obp: number | null;
    slg: number | null;
    ops: number | null;
  };
  warnings: string[];
};

export type BatterPregameGameCaptureV1 = {
  schemaVersion: typeof BATTER_PREGAME_GAME_SCHEMA;
  dateKst: string;
  gamePk: number;
  internalGameId: string | null;
  captureId: string;
  lineupObservationId: string;
  lineupSnapshotRel: string;
  lineupPayloadHash: string;
  sourceTimestamp: string | null;
  capturedAt: string;
  cutoffTime: string;
  statsThroughDate: string;
  capturedBeforeGame: boolean;
  collectionPhase: "PRE_GAME";
  collectionStatus: "CONFIRMED";
  temporalProof: Exclude<LineupRefreshTemporalProof, "NONE">;
  playerIds: number[];
  home: { teamName: string | null; batters: BatterPregameSlotV1[] };
  away: { teamName: string | null; batters: BatterPregameSlotV1[] };
  hash: string;
  researchOnly: true;
  engineUseAllowed: false;
  predictionInputAllowed: false;
  engineAdmission: "PROHIBITED";
  marketDataAllowed: false;
  koreanMarketInput: false;
  overseasMarketInput: false;
  independentModelSample: 0;
};

export type BatterCaptureV1 = BatterPregameGameCaptureV1;

export type BatterPregameManifestV1 = {
  schemaVersion: typeof BATTER_PREGAME_MANIFEST_SCHEMA;
  dateKst: string;
  generatedAt: string;
  dailyBatterDatasetFrozen: boolean;
  dailyBatterDatasetRel: string;
  captures: Array<{
    gamePk: number;
    captureId: string;
    rel: string;
    skippedSealed: boolean;
  }>;
  notes: string[];
  researchOnly: true;
  engineAdmission: "PROHIBITED";
  predictionInputAllowed: false;
};

export type BatterCaptureManifestV1 = BatterPregameManifestV1;

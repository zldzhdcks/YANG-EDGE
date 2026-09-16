/**
 * Football Pregame Player / Availability / XI Foundation v1 — types.
 *
 * DATA FOUNDATION ONLY. Not a Prediction engine. Not XI strength.
 * Provider raw ≠ YANG research. No Date.now() in normalizers.
 */
import type { FootballIdentityGateResult } from "../foundation/types";

export const FOOTBALL_PLAYER_XI_FOUNDATION_VERSION =
  "football-pregame-player-xi-foundation-v1" as const;

export const FOOTBALL_PLAYER_XI_PROVIDER = "api-football" as const;

export type FootballPlayerIdentityStatus =
  | "MATCHED"
  | "PROVIDER_ID_ONLY"
  | "PLAYER_IDENTITY_REVIEW_REQUIRED"
  | "PLAYER_ID_UNRESOLVED";

export const FOOTBALL_V4_PUBLIC_DISPLAY_RIGHTS = "UNRESOLVED" as const;

export type FootballV4PublicDisplayRights = typeof FOOTBALL_V4_PUBLIC_DISPLAY_RIGHTS;

export type FootballV4TemporalStatus =
  | "TEMPORAL_VERIFIED"
  | "TEMPORAL_PARTIAL"
  | "TEMPORAL_EVIDENCE_MISSING"
  | "POST_KICKOFF_OBSERVATION";

export type FootballXiAvailabilityStatus =
  | "CONFIRMED_XI"
  | "PREDICTED_XI"
  | "PARTIAL_XI"
  | "NOT_AVAILABLE"
  | "UNCLASSIFIED_PROVIDER_LINEUP";

export type FootballPlayerIdentityV1 = {
  provider: typeof FOOTBALL_PLAYER_XI_PROVIDER;
  providerPlayerId: string | null;
  providerTeamId: string | null;
  canonicalTeamId: string | null;
  /**
   * YANG canonical player ID. Never silently copied from providerPlayerId.
   * MATCHED is allowed only when a real mapping supplies this value.
   */
  canonicalPlayerId: string | null;
  playerName: string | null;
  providerReportedPlayerName: string | null;
  identityStatus: FootballPlayerIdentityStatus;
};

export type FootballAvailabilityStatus =
  | "AVAILABLE"
  | "OUT"
  | "DOUBTFUL"
  | "QUESTIONABLE"
  | "SUSPENDED"
  | "UNKNOWN";

export type FootballObservationPhase =
  | "PRE_GAME"
  | "POST_KICKOFF_INVALID_FOR_PREGAME";

export type FootballLineupObservationType =
  | "CONFIRMED"
  | "UNCLASSIFIED_PROVIDER_LINEUP";

export type FootballExpectedXiSourceType =
  | "OFFICIAL_PROVIDER_EXPECTED"
  | "LICENSED_PROVIDER_EXPECTED"
  | "MANUAL_OPERATOR_EXPECTED";

export type FootballDatasetQuality =
  | "COMPLETE"
  | "PARTIAL"
  | "EMPTY_PROVIDER_RESPONSE"
  | "NOT_AVAILABLE"
  | "IDENTITY_BLOCKED"
  | "POST_KICKOFF_ONLY";

export type FootballAttachmentKind =
  | "OPERATOR_GAME_ATTACHED"
  | "PROVIDER_FIXTURE_RESEARCH_ONLY";

export type FootballRawObservationKind = "INJURIES" | "LINEUPS";

export type FootballRawPointInTimeObservationV1 = {
  schemaVersion: "yang-edge-football-raw-observation-v1";
  observationId: string;
  kind: FootballRawObservationKind;
  provider: typeof FOOTBALL_PLAYER_XI_PROVIDER;
  endpoint: "/injuries" | "/fixtures/lineups";
  providerFixtureId: string;
  observedAt: string;
  fixtureKickoff: string;
  isBeforeKickoff: boolean;
  pregameEligible: boolean;
  observationPhase: FootballObservationPhase;
  /** Local collector/fetch clock. Not a provider publication time. */
  providerFetchedAt?: string | null;
  /** Provider publication clock. Absent on API-Football lineup/injury payloads. */
  providerPublishedAt?: string | null;
  snapshotCreatedAt?: string | null;
  temporalStatus?: FootballV4TemporalStatus;
  appendOnly: true;
  overwriteForbidden: true;
  predictionInput: false;
  engineInput: false;
  /** Existing sealed raw files omit this. New Phase 0 writers must set false. */
  engineAdmission?: false;
  researchOnly: true;
  PUBLIC_DISPLAY_RIGHTS?: FootballV4PublicDisplayRights;
  /** Synthetic test data must set this true and must not be stored as research evidence. */
  syntheticTestData: boolean;
  raw: unknown;
};

export type FootballAvailabilityRowV1 = {
  schemaVersion: "yang-edge-football-availability-row-v1";
  observationId: string;
  providerFixtureId: string;
  providerTeamId: string | null;
  canonicalTeamId: string | null;
  player: FootballPlayerIdentityV1;
  availabilityStatus: FootballAvailabilityStatus;
  reasonRaw: string | null;
  reasonNormalized: string | null;
  typeRaw: string | null;
  observedAt: string;
  fixtureKickoff: string;
  isBeforeKickoff: boolean;
  pregameEligible: boolean;
  observationPhase: FootballObservationPhase;
  sourceProvider: typeof FOOTBALL_PLAYER_XI_PROVIDER;
  sourceArtifactHash: string;
  attachmentKind: FootballAttachmentKind;
  operatorGameAttached: boolean;
  identityGate: Pick<
    FootballIdentityGateResult,
    "verdict" | "reasonCodes" | "predictionAllowed"
  >;
  predictionInput: false;
  engineInput: false;
  engineAdmission: false;
  researchOnly: true;
  PUBLIC_DISPLAY_RIGHTS: FootballV4PublicDisplayRights;
};

export type FootballXiPlayerV1 = {
  player: FootballPlayerIdentityV1;
  number: number | null;
  position: string | null;
  grid: string | null;
};

export type FootballXiTeamObservationV1 = {
  providerFixtureId: string;
  providerTeamId: string | null;
  canonicalTeamId: string | null;
  formation: string | null;
  coach: {
    providerCoachId: string | null;
    coachName: string | null;
  };
  startingXI: FootballXiPlayerV1[];
  substitutes: FootballXiPlayerV1[];
  lineupObservationType: FootballLineupObservationType;
  attachmentKind: FootballAttachmentKind;
  operatorGameAttached: boolean;
};

export type FootballXiObservationV1 = {
  schemaVersion: "yang-edge-football-xi-observation-v1";
  observationId: string;
  observedAt: string;
  fixtureKickoff: string;
  isBeforeKickoff: boolean;
  pregameEligible: boolean;
  observationPhase: FootballObservationPhase;
  providerFetchedAt: string | null;
  providerPublishedAt: string | null;
  snapshotCreatedAt: string | null;
  temporalStatus: FootballV4TemporalStatus;
  strictReplayEligible: boolean;
  sourceProvider: typeof FOOTBALL_PLAYER_XI_PROVIDER;
  sourceArtifactHash: string;
  teams: FootballXiTeamObservationV1[];
  identityGate: Pick<
    FootballIdentityGateResult,
    "verdict" | "reasonCodes" | "predictionAllowed"
  >;
  predictionInput: false;
  engineInput: false;
  engineAdmission: false;
  researchOnly: true;
  PUBLIC_DISPLAY_RIGHTS: FootballV4PublicDisplayRights;
};

/**
 * Expected XI contract only. Do not fabricate rows in v1.
 * MODEL_INFERRED_EXPECTED_XI is prohibited.
 */
export type FootballExpectedXiContractV1 = {
  schemaVersion: "yang-edge-football-expected-xi-contract-v1";
  sourceType: FootballExpectedXiSourceType;
  observedAt: string;
  sourceStatus: "NOT_COLLECTED_IN_V1";
  providerFixtureId: string;
  providerTeamId: string | null;
  canonicalTeamId: string | null;
  expectedStarters: FootballXiPlayerV1[];
  evidenceProvenance: string;
  predictionInput: false;
  engineInput: false;
  engineAdmission: false;
};

/**
 * Player Feature Dataset boundary. Do not calculate features in v1.
 */
export type FootballPlayerFeatureContractV1 = {
  schemaVersion: "yang-edge-football-player-feature-contract-v1";
  providerPlayerId: string | null;
  canonicalPlayerId: null;
  providerTeamId: string | null;
  canonicalTeamId: string | null;
  position: string | null;
  seasonMinutes: null;
  starts: null;
  recentMinutes: null;
  availability: FootballAvailabilityStatus | null;
  role: null;
  playerScore: null;
  impactScore: null;
  featureWeights: null;
  filled: false;
  predictionInput: false;
  engineInput: false;
  engineAdmission: false;
};

export type FootballAvailabilityNormalizeMeta = {
  observationId: string;
  observedAt: string;
  fixtureKickoff: string;
  providerFixtureId: string;
  sourceArtifactHash: string;
  identityGate: FootballIdentityGateResult;
  /** Local fetch clock only. Not providerPublishedAt. */
  providerFetchedAt?: string | null;
  providerPublishedAt?: string | null;
  snapshotCreatedAt?: string | null;
  homeProviderTeamId?: string | null;
  awayProviderTeamId?: string | null;
  homeProviderTeamName?: string | null;
  awayProviderTeamName?: string | null;
};

export type FootballLineupNormalizeMeta = FootballAvailabilityNormalizeMeta & {
  /**
   * Collector-supplied. Default unproven → UNCLASSIFIED_PROVIDER_LINEUP.
   * Do not treat /fixtures/lineups as EXPECTED_XI.
   */
  lineupSemantic?: "OFFICIAL_CONFIRMED" | "UNPROVEN";
};

export type FootballAvailabilityDatasetV1 = {
  schemaVersion: "yang-edge-football-availability-dataset-v1";
  foundationVersion: typeof FOOTBALL_PLAYER_XI_FOUNDATION_VERSION;
  observationId: string;
  sourceArtifactHash: string;
  rows: FootballAvailabilityRowV1[];
  quality: FootballDatasetQuality;
  counts: {
    rawRows: number;
    normalizedRows: number;
    unknownPlayerIdentityRows: number;
    unknownAvailabilityRows: number;
    teamsObserved: number;
  };
  engineConnected: false;
  predictionConnected: false;
  predictionInput: false;
  engineInput: false;
  engineAdmission: false;
  PUBLIC_DISPLAY_RIGHTS: FootballV4PublicDisplayRights;
};

export type FootballXiDatasetV1 = {
  schemaVersion: "yang-edge-football-xi-dataset-v1";
  foundationVersion: typeof FOOTBALL_PLAYER_XI_FOUNDATION_VERSION;
  observationId: string;
  sourceArtifactHash: string;
  observation: FootballXiObservationV1;
  quality: FootballDatasetQuality;
  xiAvailabilityStatus: FootballXiAvailabilityStatus;
  counts: {
    rawRows: number;
    normalizedRows: number;
    unknownPlayerIdentityRows: number;
    teamsObserved: number;
    startingPlayersObserved: number;
    substitutesObserved: number;
  };
  engineConnected: false;
  predictionConnected: false;
  predictionInput: false;
  engineInput: false;
  engineAdmission: false;
  PUBLIC_DISPLAY_RIGHTS: FootballV4PublicDisplayRights;
};

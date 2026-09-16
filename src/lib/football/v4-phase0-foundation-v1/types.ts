/**
 * Football V4 Phase 0 data-foundation types.
 *
 * RESEARCH ONLY. engineAdmission is always false.
 * No player scores, no prediction types, no public UI wiring.
 */
import type { FootballPlayerSeasonDatasetV1, FootballSquadSnapshotV1 } from "../player-context-foundation-v1/types";
import type {
  FootballAvailabilityDatasetV1,
  FootballPlayerIdentityStatus,
  FootballV4PublicDisplayRights,
  FootballV4TemporalStatus,
  FootballXiDatasetV1,
} from "../pregame-player-xi-foundation-v1/types";

export const FOOTBALL_V4_PHASE0_FOUNDATION_VERSION =
  "football-v4-phase0-foundation-v1" as const;

export const FOOTBALL_V4_PHASE0_SNAPSHOT_SCHEMA =
  "yang-edge-football-v4-phase0-player-context-snapshot-v1" as const;

export type FootballV4SectionStatus = "AVAILABLE" | "PARTIAL" | "NOT_AVAILABLE";

export type FootballV4CoverageState = "READY" | "PARTIAL" | "MISSING" | "BLOCKED";

export type FootballV4SectionEnvelope<T> = {
  status: FootballV4SectionStatus;
  dataset: T | null;
};

export type FootballV4PlayerContextSnapshotV1 = {
  schemaVersion: typeof FOOTBALL_V4_PHASE0_SNAPSHOT_SCHEMA;
  foundationVersion: typeof FOOTBALL_V4_PHASE0_FOUNDATION_VERSION;
  observedAt: string;
  /** Local collector/fetch clock. Not provider publication time. */
  providerFetchedAt: string | null;
  /** Absent on API-Football lineup/injury payloads. Do not invent. */
  providerPublishedAt: string | null;
  snapshotCreatedAt: string | null;
  providerFixtureId: string | null;
  providerTeamId: string | null;
  season: number | null;
  source: "api-football" | "replay" | "synthetic-test";
  lineup: FootballV4SectionEnvelope<FootballXiDatasetV1>;
  injury: FootballV4SectionEnvelope<FootballAvailabilityDatasetV1>;
  playerSeason: FootballV4SectionEnvelope<FootballPlayerSeasonDatasetV1>;
  squad: FootballV4SectionEnvelope<FootballSquadSnapshotV1>;
  identityStatus: FootballPlayerIdentityStatus | "MIXED" | "NOT_AVAILABLE";
  temporalStatus: FootballV4TemporalStatus;
  coverage: FootballV4CoverageReportV1;
  engineInput: false;
  engineAdmission: false;
  researchOnly: true;
  predictionInput: false;
  PUBLIC_DISPLAY_RIGHTS: FootballV4PublicDisplayRights;
};

export type FootballV4CoverageReportV1 = {
  lineupCoverage: FootballV4CoverageState;
  injuryCoverage: FootballV4CoverageState;
  identityCoverage: FootballV4CoverageState;
  temporalCoverage: FootballV4CoverageState;
  contextCoverage: FootballV4CoverageState;
  engineAdmission: false;
  playerImpactScore: null;
  playerStrengthScore: null;
  lineupStrength: null;
  injuryPenalty: null;
  goalkeeperWeight: null;
  starPlayerWeight: null;
  availabilityWeight: null;
};

export type FootballV4PersistPlanV1 = {
  relativePath: string;
  payload: FootballV4PlayerContextSnapshotV1;
  appendOnly: true;
  overwriteForbidden: true;
  writeExecuted: false;
  skippedReason: "EXECUTE_WRITE_NOT_REQUESTED" | "OVERWRITE_FORBIDDEN";
};

export type FootballV4PersistResultV1 =
  | FootballV4PersistPlanV1
  | {
      relativePath: string;
      payload: FootballV4PlayerContextSnapshotV1;
      appendOnly: true;
      overwriteForbidden: true;
      writeExecuted: true;
    };

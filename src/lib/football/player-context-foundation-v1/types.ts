/**
 * Football Player Stats + Squad + Coach Data Foundation v1 — types.
 *
 * DATA FOUNDATION ONLY. Not Prediction. Not Engine. Not tactics scoring.
 * Provider raw ≠ YANG research. No Date.now() in normalizers.
 */
import type { FootballIdentityGateResult } from "../foundation/types";
import type { FootballPlayerIdentityStatus, FootballPlayerIdentityV1 } from "../pregame-player-xi-foundation-v1/types";

export const FOOTBALL_PLAYER_CONTEXT_FOUNDATION_VERSION =
  "football-player-stats-squad-coach-foundation-v1" as const;

export const FOOTBALL_PLAYER_CONTEXT_PROVIDER = "api-football" as const;

export const FOOTBALL_PLAYER_CONTEXT_SCHEMA_VERSION =
  "yang-edge-football-raw-player-context-observation-v1" as const;

export type FootballPlayerContextKind = "PLAYERS" | "SQUADS" | "COACHES";

export type FootballPlayerContextEndpoint =
  | "/players"
  | "/players/squads"
  | "/coachs";

export type FootballPlayerContextObservationPhase =
  | "PRE_GAME"
  | "POST_KICKOFF_INVALID_FOR_PREGAME"
  | "RESEARCH_WITHOUT_TARGET_FIXTURE";

export type FootballPlayerContextDatasetQuality =
  | "COMPLETE"
  | "PARTIAL"
  | "EMPTY_PROVIDER_RESPONSE"
  | "IDENTITY_BLOCKED"
  | "POST_KICKOFF_ONLY"
  | "TRUNCATED_PAGINATION";

export type FootballCoachIdentityStatus =
  | "MATCHED"
  | "PROVIDER_ID_ONLY"
  | "COACH_IDENTITY_REVIEW_REQUIRED";

export type FootballPagingMetaV1 = {
  current: number;
  total: number;
  pagesFetched: number;
  truncated: boolean;
  complete: boolean;
  pagingPresent: boolean;
  maxPages: number;
  reason: string | null;
};

export type FootballRawPlayerContextObservationV1 = {
  schemaVersion: typeof FOOTBALL_PLAYER_CONTEXT_SCHEMA_VERSION;
  observationId: string;
  kind: FootballPlayerContextKind;
  provider: typeof FOOTBALL_PLAYER_CONTEXT_PROVIDER;
  endpoint: FootballPlayerContextEndpoint;
  providerTeamId: string | null;
  leagueId: string | null;
  season: number | null;
  observedAt: string;
  query: Record<string, string>;
  paging: FootballPagingMetaV1 | null;
  rawResponse: unknown;
  researchOnly: true;
  predictionInput: false;
  engineInput: false;
  overwriteForbidden: true;
  appendOnly: true;
  syntheticTestData: boolean;
  schemaValidationResearchOnly: boolean;
};

export type FootballPlayerSeasonStatV1 = {
  schemaVersion: "yang-edge-football-player-season-stat-v1";
  observationId: string;
  observedAt: string;
  identity: FootballPlayerIdentityV1;
  providerPlayerId: string | null;
  providerTeamId: string | null;
  canonicalTeamId: string | null;
  playerName: string | null;
  leagueId: string | null;
  leagueName: string | null;
  season: number | null;
  statisticsTeamId: string | null;
  statisticsTeamName: string | null;
  profile: {
    age: number | null;
    nationality: string | null;
    height: string | null;
    weight: string | null;
    injured: boolean | null;
    photo: string | null;
    firstname: string | null;
    lastname: string | null;
  };
  games: {
    appearances: number | null;
    starts: number | null;
    minutes: number | null;
    number: number | null;
    position: string | null;
    rating: number | null;
    captain: boolean | null;
  };
  substitutes: {
    in: number | null;
    out: number | null;
    bench: number | null;
  };
  shots: {
    total: number | null;
    onTarget: number | null;
  };
  goals: {
    total: number | null;
    conceded: number | null;
    assists: number | null;
    saves: number | null;
  };
  passes: {
    total: number | null;
    key: number | null;
    accuracy: number | null;
  };
  tackles: {
    total: number | null;
    blocks: number | null;
    interceptions: number | null;
  };
  duels: {
    total: number | null;
    won: number | null;
  };
  dribbles: {
    attempts: number | null;
    success: number | null;
    past: number | null;
  };
  fouls: {
    drawn: number | null;
    committed: number | null;
  };
  cards: {
    yellow: number | null;
    yellowRed: number | null;
    red: number | null;
  };
  penalty: {
    won: number | null;
    committed: number | null;
    scored: number | null;
    missed: number | null;
    saved: number | null;
  };
  pregameEligible: boolean;
  observationPhase: FootballPlayerContextObservationPhase;
  operatorGameAttached: boolean;
  canonicalTeamAttached: boolean;
  predictionInput: false;
  engineInput: false;
  researchOnly: true;
};

export type FootballPlayerSeasonDatasetV1 = {
  schemaVersion: "yang-edge-football-player-season-dataset-v1";
  foundationVersion: typeof FOOTBALL_PLAYER_CONTEXT_FOUNDATION_VERSION;
  observationId: string;
  observedAt: string;
  sourceArtifactHash: string;
  rows: FootballPlayerSeasonStatV1[];
  quality: FootballPlayerContextDatasetQuality;
  counts: {
    rawPlayerItems: number;
    normalizedRows: number;
    unknownPlayerIdentityRows: number;
    multiContextPlayers: number;
  };
  paging: FootballPagingMetaV1 | null;
  identityGate: Pick<
    FootballIdentityGateResult,
    "verdict" | "reasonCodes" | "predictionAllowed"
  > | null;
  engineConnected: false;
  predictionConnected: false;
  predictionInput: false;
  engineInput: false;
  researchOnly: true;
};

export type FootballSquadPlayerV1 = {
  providerPlayerId: string | null;
  canonicalPlayerId: null;
  name: string | null;
  age: number | null;
  number: number | null;
  position: string | null;
  photo: string | null;
  identityStatus: FootballPlayerIdentityStatus;
  /** Squad membership is not XI evidence. */
  impliesStarter: false;
  impliesAvailability: false;
  impliesExpectedXi: false;
};

export type FootballSquadSnapshotV1 = {
  schemaVersion: "yang-edge-football-squad-snapshot-v1";
  foundationVersion: typeof FOOTBALL_PLAYER_CONTEXT_FOUNDATION_VERSION;
  observationId: string;
  providerTeamId: string | null;
  canonicalTeamId: string | null;
  canonicalTeamAttached: boolean;
  operatorGameAttached: boolean;
  observedAt: string;
  teamName: string | null;
  players: FootballSquadPlayerV1[];
  quality: FootballPlayerContextDatasetQuality;
  /** Current roster at observedAt. Not historical-as-of unless captured then. */
  rosterSemantics: "CURRENT_AT_OBSERVED_AT";
  impliesStarter: false;
  impliesAvailability: false;
  impliesExpectedXi: false;
  pregameEligible: boolean;
  observationPhase: FootballPlayerContextObservationPhase;
  identityGate: Pick<
    FootballIdentityGateResult,
    "verdict" | "reasonCodes" | "predictionAllowed"
  > | null;
  engineConnected: false;
  predictionConnected: false;
  predictionInput: false;
  engineInput: false;
  researchOnly: true;
};

export type FootballCoachCareerRowV1 = {
  providerTeamId: string | null;
  teamName: string | null;
  start: string | null;
  end: string | null;
};

export type FootballCoachIdentityV1 = {
  provider: typeof FOOTBALL_PLAYER_CONTEXT_PROVIDER;
  providerCoachId: string | null;
  canonicalCoachId: null;
  name: string | null;
  firstname: string | null;
  lastname: string | null;
  identityStatus: FootballCoachIdentityStatus;
};

export type FootballCoachProfileV1 = {
  identity: FootballCoachIdentityV1;
  age: number | null;
  nationality: string | null;
  photo: string | null;
  birth: {
    date: string | null;
    place: string | null;
    country: string | null;
  };
  currentProviderTeamId: string | null;
  currentTeamName: string | null;
  career: FootballCoachCareerRowV1[];
  /** P1 collects profile/history only. */
  tacticalScore: null;
  coachStrengthScore: null;
  formationScore: null;
  managerRating: null;
};

export type FootballCoachSnapshotV1 = {
  schemaVersion: "yang-edge-football-coach-snapshot-v1";
  foundationVersion: typeof FOOTBALL_PLAYER_CONTEXT_FOUNDATION_VERSION;
  observationId: string;
  providerTeamId: string | null;
  canonicalTeamId: string | null;
  canonicalTeamAttached: boolean;
  operatorGameAttached: boolean;
  observedAt: string;
  coaches: FootballCoachProfileV1[];
  /**
   * Set only when exactly one coach is present.
   * Multiple coaches are preserved in `coaches` — no arbitrary first-row pick.
   */
  coach: FootballCoachProfileV1 | null;
  quality: FootballPlayerContextDatasetQuality;
  pregameEligible: boolean;
  observationPhase: FootballPlayerContextObservationPhase;
  identityGate: Pick<
    FootballIdentityGateResult,
    "verdict" | "reasonCodes" | "predictionAllowed"
  > | null;
  engineConnected: false;
  predictionConnected: false;
  predictionInput: false;
  engineInput: false;
  researchOnly: true;
};

/**
 * Future-facing research projection. May populate research fields.
 * Never admitted to Engine / Prediction in P1.
 */
export type FootballPlayerContextFeatureContractV1 = {
  schemaVersion: "yang-edge-football-player-context-feature-contract-v1";
  providerPlayerId: string | null;
  canonicalPlayerId: null;
  providerTeamId: string | null;
  canonicalTeamId: string | null;
  position: string | null;
  seasonMinutes: number | null;
  starts: number | null;
  goals: number | null;
  assists: number | null;
  rating: number | null;
  squadMembership: boolean | null;
  availability: null;
  playerScore: null;
  impactScore: null;
  tacticalScore: null;
  featureWeights: null;
  researchProjectionFilled: boolean;
  researchOnly: true;
  predictionInput: false;
  engineInput: false;
  admittedToEngine: false;
};

export type FootballPlayerContextNormalizeMeta = {
  sourceArtifactHash: string;
  identityGate?: FootballIdentityGateResult | null;
  fixtureKickoff?: string | null;
};

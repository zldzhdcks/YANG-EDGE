/**
 * MLB Expected Lineup Observation v0
 * Operator research observation — NOT confirmed lineup, NOT Engine input.
 */

export const MLB_EXPECTED_LINEUP_OBSERVATION_SCHEMA =
  "mlb-expected-lineup-observation-v0" as const;

export type MlbLineupObservationStatus =
  | "EXPECTED"
  | "CONFIRMED"
  | "NOT_AVAILABLE";

export type MlbExpectedLineupSourceType = "MANUAL_OBSERVATION";

export type MlbExpectedLineupJoinStatus =
  | "MATCHED"
  | "AMBIGUOUS"
  | "NOT_MATCHED";

export type MlbExpectedLineupCutoffLabel =
  | "PRE_GAME_OBSERVATION"
  | "LATE_OBSERVATION"
  | "UNKNOWN";

export type MlbExpectedBatterV0 = {
  battingOrder: number;
  displayName: string;
  position: string | null;
  bats: string | null;
  /** Never invent — null when unknown. */
  providerPlayerId: null;
};

export type MlbExpectedLineupGameV0 = {
  gamePk: number;
  internalGameId: string;
  awayTeam: string;
  homeTeam: string;
  firstPitchAt: string | null;
  joinStatus: MlbExpectedLineupJoinStatus;
  lineupStatus: "EXPECTED";
  awayLineup: MlbExpectedBatterV0[];
  homeLineup: MlbExpectedBatterV0[];
  observedAt: string | null;
  isBeforeFirstPitch: boolean | null;
  cutoffLabel: MlbExpectedLineupCutoffLabel | null;
};

export type MlbExpectedLineupObservationV0 = {
  schemaVersion: typeof MLB_EXPECTED_LINEUP_OBSERVATION_SCHEMA;
  dateKst: string;
  league: "MLB";
  observationType: "EXPECTED_LINEUP";
  sourceType: MlbExpectedLineupSourceType;
  sourceLabel: string;
  /** Always EXPECTED for this mission — never auto-promote to CONFIRMED. */
  lineupStatus: "EXPECTED";
  observedAt: string;
  enteredBy: "OPERATOR";
  note: string;
  expectedLineupHash: string;
  games: MlbExpectedLineupGameV0[];
  summary: {
    scheduleGames: number;
    matchedGames: number;
    teamLineups: number;
    expectedBattingSlots: number;
    expectedGames: number;
    confirmedGames: number;
    missingGames: number;
    preGameObservations: number;
    lateObservations: number;
    joinErrors: number;
  };
};

export type MlbExpectedLineupDraftBatter = {
  battingOrder: number;
  displayName: string;
  position?: string | null;
  bats?: string | null;
};

export type MlbExpectedLineupDraftGame = {
  gamePk: number;
  awayLineup: MlbExpectedLineupDraftBatter[];
  homeLineup: MlbExpectedLineupDraftBatter[];
};

export type MlbExpectedLineupGameDetailPanel = {
  available: boolean;
  lineupStatus: "EXPECTED" | "NOT_AVAILABLE";
  providerLineupStatus: string;
  operatorObservationStatus: string;
  disclaimer: string;
  observedAt: string | null;
  isBeforeFirstPitch: boolean | null;
  cutoffLabel: string | null;
  awayTeam: string;
  homeTeam: string;
  awayLineup: MlbExpectedBatterV0[];
  homeLineup: MlbExpectedBatterV0[];
};

/**
 * NPB Manual Starter Intake v0 — types.
 * Operator overlay only. Does not change Engine / Prediction / weights.
 */

export const NPB_STARTER_CONFIRMATION_SCHEMA =
  "npb-starter-confirmation-v1" as const;

export type NpbStarterSourceType = "MANUAL_VERIFIED";

export type NpbStarterVerificationStatus = "CONFIRMED";

export type NpbStarterHandedness = "R" | "L" | "UNKNOWN";

export type NpbGameJoinStatus = "MATCHED" | "AMBIGUOUS" | "NOT_MATCHED";

export type NpbStarterUiStatus =
  | "CONFIRMED"
  | "MISSING"
  | "LATE"
  | "JOIN_ERROR";

export type NpbStarterSideV1 = {
  displayName: string;
  originalName: string;
  normalizedName: string;
  handedness: NpbStarterHandedness;
  providerPlayerId: null;
  verificationStatus: NpbStarterVerificationStatus;
  sourceType: NpbStarterSourceType;
};

export type NpbStarterGameV1 = {
  internalGameId: string;
  awayTeam: string;
  homeTeam: string;
  awayTeamCanonicalId: string | null;
  homeTeamCanonicalId: string | null;
  firstPitchAt: string | null;
  joinStatus: NpbGameJoinStatus;
  awayStarter: NpbStarterSideV1 | null;
  homeStarter: NpbStarterSideV1 | null;
  verifiedAt: string | null;
  isBeforeFirstPitch: boolean | null;
  cutoffLabel: "PRE_GAME_VERIFIED" | "LATE_OPERATOR_INPUT" | "UNKNOWN" | null;
  uiStatus: NpbStarterUiStatus;
};

export type NpbStarterConfirmationV1 = {
  schemaVersion: typeof NPB_STARTER_CONFIRMATION_SCHEMA;
  dateKst: string;
  league: "NPB";
  sourceType: NpbStarterSourceType;
  sourceLabel: string;
  verifiedAt: string;
  enteredBy: "OPERATOR";
  games: NpbStarterGameV1[];
  summary: {
    scheduleGames: number;
    matchedGames: number;
    confirmedStarters: number;
    missingStarters: number;
    lateGames: number;
    joinErrors: number;
    preGameVerifiedStarters: number;
  };
};

export type NpbStarterIntakeDraftSide = {
  originalName: string;
  displayName?: string | null;
  handedness?: NpbStarterHandedness | null;
};

export type NpbStarterIntakeDraftGame = {
  internalGameId: string;
  awayStarter: NpbStarterIntakeDraftSide | null;
  homeStarter: NpbStarterIntakeDraftSide | null;
};

export type NpbStarterResearchOverlay = {
  dateKst: string;
  sourceType: NpbStarterSourceType;
  sourceLabel: "MANUAL VERIFIED";
  availableStarters: number;
  totalStarterSlots: number;
  line: string;
  games: Array<{
    internalGameId: string;
    homeStarter: string | null;
    awayStarter: string | null;
    status: NpbStarterUiStatus;
    preGameVerified: boolean;
  }>;
};

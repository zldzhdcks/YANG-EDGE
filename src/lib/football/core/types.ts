/**
 * Football Core v1 — schedule / identity types.
 * Prediction / Engine / Scorecard are not part of this layer.
 */

export const FOOTBALL_SCHEDULE_V1_SCHEMA = "football-schedule-v1" as const;
export const FOOTBALL_SCHEDULE_V1_BUILDER =
  "football-schedule-builder-v1" as const;
export const FOOTBALL_CORE_IDENTITY_VERSION = "football-core-identity-v1" as const;

export type FootballProviderId = "api-football";

export type FootballLegalStatus = "NEEDS_LEGAL_REVIEW";

export type FootballCompetitionType =
  | "LEAGUE"
  | "CUP"
  | "CONTINENTAL"
  | "INTERNATIONAL";

export type FootballMatchFormat =
  | "LEAGUE_MATCH"
  | "GROUP_STAGE"
  | "KNOCKOUT"
  | "TWO_LEG_TIE"
  | "UNKNOWN";

export type FootballScheduleStatus =
  | "SCHEDULED"
  | "LIVE"
  | "FINISHED"
  | "POSTPONED"
  | "CANCELLED"
  | "ABANDONED"
  | "SUSPENDED"
  | "UNKNOWN";

export type FootballIdentityRowStatus =
  | "MATCHED"
  | "IDENTITY_REVIEW_REQUIRED"
  | "IDENTITY_BLOCKED";

export type FootballPredictionEligibility =
  | "ELIGIBLE_FORMAT"
  | "NOT_SUPPORTED_FORMAT"
  | "IDENTITY_BLOCKED"
  | "COMPETITION_BLOCKED"
  | "UNKNOWN";

export type FootballTeamIdentityStatus =
  | "MATCHED"
  | "IDENTITY_REVIEW_REQUIRED";

/** v1 canonical IDs are seeded from api-football team ids. */
export type FootballIdentityScope = "PROVIDER_SEEDED_V1";

export type FootballScheduleRowV1 = {
  dateKst: string;
  matchId: string;
  provider: FootballProviderId;
  providerMatchId: string;
  competitionId: string;
  seasonId: string | null;
  competitionType: FootballCompetitionType;
  matchFormat: FootballMatchFormat;
  homeTeamId: string | null;
  awayTeamId: string | null;
  homeProviderTeamId: string;
  awayProviderTeamId: string;
  homeTeamName: string;
  awayTeamName: string;
  kickoffTimeUtc: string | null;
  status: FootballScheduleStatus;
  venue: string | null;
  identityStatus: FootballIdentityRowStatus;
  identityReasons: string[];
  predictionEligibility: FootballPredictionEligibility;
  researchOnly: true;
};

export type FootballScheduleArtifactV1 = {
  meta: {
    schemaVersion: typeof FOOTBALL_SCHEDULE_V1_SCHEMA;
    builderVersion: typeof FOOTBALL_SCHEDULE_V1_BUILDER;
    identityVersion: typeof FOOTBALL_CORE_IDENTITY_VERSION;
    dateKst: string;
    generatedAt: string;
    provider: FootballProviderId;
    researchOnly: true;
    legalStatus: FootballLegalStatus;
    scheduleGames: number;
    identityMatched: number;
    identityBlocked: number;
    formatEligible: number;
    formatNotSupported: number;
    droppedUnregisteredCompetition: number;
    artifactHash: string;
  };
  rows: FootballScheduleRowV1[];
};

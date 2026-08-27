/**
 * Football Identity Foundation v0 — shared types.
 * Research SoT for Schedule/Odds/Lineup/Prediction/Result/Review/Scorecard.
 * No Prediction / Engine / Provider calls.
 */

export const FOOTBALL_IDENTITY_VERSION = "football-identity-v0" as const;

export type FootballProviderId = "api-football";

export type CompetitionType =
  | "LEAGUE"
  | "CUP"
  | "CONTINENTAL"
  | "INTERNATIONAL";

export type CompetitionRegistryStatus =
  | "ACTIVE"
  | "DISABLED"
  | "RESEARCH_ONLY";

export type FootballFoundationStage =
  | "NOT_STARTED"
  | "FOUNDATION"
  | "READY"
  | "BLOCKED";

/** Same vocabulary as YANG EDGE OS / MLB. */
export type FootballOsLevel = "READY" | "WARNING" | "BLOCKED" | "OFF";

export type FootballCompetition = {
  competitionId: string;
  provider: FootballProviderId;
  providerCompetitionId: string;
  officialName: string;
  displayName: string;
  country: string;
  /** Research-tracked season tag; match.season is authoritative per fixture */
  season: string | null;
  competitionType: CompetitionType;
  status: CompetitionRegistryStatus;
  betmanSupported: boolean;
  researchSupported: boolean;
  /** Exact OWNER-approved operator screenshot labels. Not a new competition. */
  operatorDisplayAliases?: string[];
};

export type FootballTeam = {
  provider: FootballProviderId;
  providerTeamId: string;
  officialName: string;
  displayName: string;
  country: string;
  aliases: string[];
  active: boolean;
};

export type FootballMatchStatus =
  | "SCHEDULED"
  | "LIVE"
  | "FINISHED"
  | "POSTPONED"
  | "ABANDONED"
  | "CANCELLED"
  | "UNKNOWN";

export type FootballMatchIdentityInput = {
  provider: FootballProviderId;
  fixtureId: string;
  competitionId: string;
  season: string;
  kickoffUtc: string;
  homeTeamId: string;
  awayTeamId: string;
  neutralVenue: boolean;
  status: FootballMatchStatus;
};

export type FootballMatchIdentity = {
  matchId: string;
  fixtureId: string;
  provider: FootballProviderId;
  competitionId: string;
  season: string;
  kickoffUtc: string;
  kickoffKst: string;
  homeTeamId: string;
  awayTeamId: string;
  neutralVenue: boolean;
  status: FootballMatchStatus;
  identityHash: string;
  identityVersion: typeof FOOTBALL_IDENTITY_VERSION;
};

export type FootballIdentityGateVerdict = "PASS" | "FAIL";

export type FootballIdentityGateResult = {
  verdict: FootballIdentityGateVerdict;
  reasonCodes: string[];
  matchId: string | null;
  identityHash: string | null;
  /** FAIL ⇒ Prediction 생성 금지 */
  predictionAllowed: false | true;
};

export type FootballScheduleArtifactV1 = {
  schemaVersion: "football-schedule-v1";
  revision: string;
  generatedAt: string;
  sourceProvider: FootballProviderId;
  identityVersion: typeof FOOTBALL_IDENTITY_VERSION;
  dateKst: string;
  matches: FootballMatchIdentity[];
};

export type FootballIdentityOperationSlice = {
  stage: FootballFoundationStage;
  osLevel: FootballOsLevel;
  label: string;
  plainLanguage: string;
  competitionCount: number;
  teamCount: number;
  /** Never a fabricated progress percent */
  progressPercent: null;
  risksTop: { id: string; title: string; severity: string }[];
  sourceRefs: string[];
};

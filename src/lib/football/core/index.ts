export {
  FOOTBALL_CORE_IDENTITY_VERSION,
  FOOTBALL_SCHEDULE_V1_BUILDER,
  FOOTBALL_SCHEDULE_V1_SCHEMA,
  type FootballCompetitionType,
  type FootballIdentityRowStatus,
  type FootballIdentityScope,
  type FootballLegalStatus,
  type FootballMatchFormat,
  type FootballPredictionEligibility,
  type FootballProviderId,
  type FootballScheduleArtifactV1,
  type FootballScheduleRowV1,
  type FootballScheduleStatus,
  type FootballTeamIdentityStatus,
} from "./types";

export {
  assembleFootballScheduleArtifact,
  buildFootballScheduleV1,
  finalizeFootballScheduleDocument,
  rejoinFootballScheduleArtifact,
  rejoinFootballScheduleV1,
} from "./build-schedule";
export { computeFootballScheduleArtifactHash, omitVolatileScheduleMeta } from "./hash";
export { footballScheduleV1Rel } from "./paths";
export { normalizeFootballScheduleStatus } from "./status";
export {
  resolveMatchFormat,
  resolvePredictionEligibility,
} from "./match-format";
export {
  canonicalizeKickoffTimeUtc,
  isCanonicalUtcIso,
  resolveFixtureKickoffUtc,
} from "./kickoff";
export {
  rejoinFootballScheduleRow,
  resolveScheduleIdentityFields,
} from "./identity";
export {
  assertTeamCatalogIntegrity,
  FOOTBALL_BLOCKED_PROVIDER_TEAM_IDS,
  FOOTBALL_IDENTITY_SCOPE_V1,
  FOOTBALL_TEAM_CATALOG_V1,
  FOOTBALL_TEAM_CONFLICTS_V1,
  getMatchedTeam,
  resolveProviderTeam,
  type FootballTeamCatalogEntry,
} from "./team-catalog";
export {
  FOOTBALL_SLATE_2026_08_12_TEAMS,
  FOOTBALL_SLATE_2026_08_14_TEAMS,
} from "./team-catalog-slate-2026-08";
export {
  assertResearchFixtureInput,
  normalizeFixtureToScheduleRow,
} from "./normalize";

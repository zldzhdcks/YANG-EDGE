/**
 * Football Competition Profiles v1 — configuration, not Engines.
 * Provider competition IDs are copied only from existing repo sources:
 * - src/constants/football-leagues.ts (UI whitelist, API-Football league id)
 * - src/lib/football/foundation/competition-registry.ts
 * Season year is NOT hardcoded here. Fixture.league.season is authoritative.
 */
import type {
  FootballCompetitionType,
  FootballLegalStatus,
  FootballMatchFormat,
} from "../core/types";

export const FOOTBALL_COMPETITION_PROFILE_VERSION =
  "football-competition-profile-v1" as const;

export type FootballSeasonCalendar = "EUROPEAN_SPLIT" | "CALENDAR_YEAR";

export type FootballCompetitionResearchStatus =
  | "RESEARCH_ONLY"
  | "IDENTITY_REVIEW_REQUIRED"
  | "DISABLED";

export type FootballCompetitionProfile = {
  competitionId: string;
  canonicalName: string;
  displayNameKo: string;
  country: string;
  provider: "api-football";
  providerCompetitionId: string;
  competitionType: FootballCompetitionType;
  defaultMatchFormat: FootballMatchFormat;
  seasonCalendar: FootballSeasonCalendar;
  /** Never used as schedule seasonId. Fixture payload is SoT. */
  seasonIdAuthoritative: "FIXTURE";
  researchStatus: FootballCompetitionResearchStatus;
  legalStatus: FootballLegalStatus;
  supportedMarkets: ["MONEYLINE_3WAY_1X2"];
  predictionEligibility:
    | "ELIGIBLE_FORMAT"
    | "NOT_SUPPORTED_FORMAT";
  researchOnly: true;
  idSources: string[];
};

function profile(
  row: Omit<
    FootballCompetitionProfile,
    | "provider"
    | "supportedMarkets"
    | "researchOnly"
    | "seasonIdAuthoritative"
    | "legalStatus"
  > & { legalStatus?: FootballLegalStatus },
): FootballCompetitionProfile {
  return {
    ...row,
    provider: "api-football",
    seasonIdAuthoritative: "FIXTURE",
    legalStatus: row.legalStatus ?? "NEEDS_LEGAL_REVIEW",
    supportedMarkets: ["MONEYLINE_3WAY_1X2"],
    researchOnly: true,
  };
}

const ID_SOURCES = [
  "src/constants/football-leagues.ts",
  "src/lib/football/foundation/competition-registry.ts",
];

/**
 * MLS is in the UI whitelist but was missing from foundation registry v0.
 * providerCompetitionId 253 is verified from football-leagues.ts only.
 */
export const FOOTBALL_COMPETITION_PROFILES_V1: FootballCompetitionProfile[] = [
  profile({
    competitionId: "fb-comp-api-football-39",
    canonicalName: "Premier League",
    displayNameKo: "프리미어리그",
    country: "England",
    providerCompetitionId: "39",
    competitionType: "LEAGUE",
    defaultMatchFormat: "LEAGUE_MATCH",
    seasonCalendar: "EUROPEAN_SPLIT",
    researchStatus: "RESEARCH_ONLY",
    predictionEligibility: "ELIGIBLE_FORMAT",
    idSources: ID_SOURCES,
  }),
  profile({
    competitionId: "fb-comp-api-football-140",
    canonicalName: "La Liga",
    displayNameKo: "라리가",
    country: "Spain",
    providerCompetitionId: "140",
    competitionType: "LEAGUE",
    defaultMatchFormat: "LEAGUE_MATCH",
    seasonCalendar: "EUROPEAN_SPLIT",
    researchStatus: "RESEARCH_ONLY",
    predictionEligibility: "ELIGIBLE_FORMAT",
    idSources: ID_SOURCES,
  }),
  profile({
    competitionId: "fb-comp-api-football-135",
    canonicalName: "Serie A",
    displayNameKo: "세리에 A",
    country: "Italy",
    providerCompetitionId: "135",
    competitionType: "LEAGUE",
    defaultMatchFormat: "LEAGUE_MATCH",
    seasonCalendar: "EUROPEAN_SPLIT",
    researchStatus: "RESEARCH_ONLY",
    predictionEligibility: "ELIGIBLE_FORMAT",
    idSources: ID_SOURCES,
  }),
  profile({
    competitionId: "fb-comp-api-football-78",
    canonicalName: "Bundesliga",
    displayNameKo: "분데스리가",
    country: "Germany",
    providerCompetitionId: "78",
    competitionType: "LEAGUE",
    defaultMatchFormat: "LEAGUE_MATCH",
    seasonCalendar: "EUROPEAN_SPLIT",
    researchStatus: "RESEARCH_ONLY",
    predictionEligibility: "ELIGIBLE_FORMAT",
    idSources: ID_SOURCES,
  }),
  profile({
    competitionId: "fb-comp-api-football-61",
    canonicalName: "Ligue 1",
    displayNameKo: "리그 1",
    country: "France",
    providerCompetitionId: "61",
    competitionType: "LEAGUE",
    defaultMatchFormat: "LEAGUE_MATCH",
    seasonCalendar: "EUROPEAN_SPLIT",
    researchStatus: "RESEARCH_ONLY",
    predictionEligibility: "ELIGIBLE_FORMAT",
    idSources: ID_SOURCES,
  }),
  profile({
    competitionId: "fb-comp-api-football-292",
    canonicalName: "K League 1",
    displayNameKo: "K리그1",
    country: "South-Korea",
    providerCompetitionId: "292",
    competitionType: "LEAGUE",
    defaultMatchFormat: "LEAGUE_MATCH",
    seasonCalendar: "CALENDAR_YEAR",
    researchStatus: "RESEARCH_ONLY",
    predictionEligibility: "ELIGIBLE_FORMAT",
    idSources: ID_SOURCES,
  }),
  profile({
    competitionId: "fb-comp-api-football-98",
    canonicalName: "J1 League",
    displayNameKo: "J1리그",
    country: "Japan",
    providerCompetitionId: "98",
    competitionType: "LEAGUE",
    defaultMatchFormat: "LEAGUE_MATCH",
    seasonCalendar: "CALENDAR_YEAR",
    researchStatus: "RESEARCH_ONLY",
    predictionEligibility: "ELIGIBLE_FORMAT",
    idSources: ID_SOURCES,
  }),
  profile({
    competitionId: "fb-comp-api-football-253",
    canonicalName: "Major League Soccer",
    displayNameKo: "MLS",
    country: "USA",
    providerCompetitionId: "253",
    competitionType: "LEAGUE",
    defaultMatchFormat: "LEAGUE_MATCH",
    seasonCalendar: "CALENDAR_YEAR",
    researchStatus: "RESEARCH_ONLY",
    predictionEligibility: "ELIGIBLE_FORMAT",
    idSources: ["src/constants/football-leagues.ts"],
  }),
  profile({
    competitionId: "fb-comp-api-football-2",
    canonicalName: "UEFA Champions League",
    displayNameKo: "UEFA 챔피언스리그",
    country: "Europe",
    providerCompetitionId: "2",
    competitionType: "CONTINENTAL",
    defaultMatchFormat: "UNKNOWN",
    seasonCalendar: "EUROPEAN_SPLIT",
    researchStatus: "RESEARCH_ONLY",
    predictionEligibility: "NOT_SUPPORTED_FORMAT",
    idSources: ID_SOURCES,
  }),
  profile({
    competitionId: "fb-comp-api-football-3",
    canonicalName: "UEFA Europa League",
    displayNameKo: "UEFA 유로파리그",
    country: "Europe",
    providerCompetitionId: "3",
    competitionType: "CONTINENTAL",
    defaultMatchFormat: "UNKNOWN",
    seasonCalendar: "EUROPEAN_SPLIT",
    researchStatus: "RESEARCH_ONLY",
    predictionEligibility: "NOT_SUPPORTED_FORMAT",
    idSources: ID_SOURCES,
  }),
];

export function listCompetitionProfiles(): FootballCompetitionProfile[] {
  return FOOTBALL_COMPETITION_PROFILES_V1.slice();
}

export function getCompetitionProfileById(
  competitionId: string,
): FootballCompetitionProfile | null {
  return (
    FOOTBALL_COMPETITION_PROFILES_V1.find(
      (c) => c.competitionId === competitionId,
    ) ?? null
  );
}

export function getCompetitionProfileByProviderId(
  provider: string,
  providerCompetitionId: string,
): FootballCompetitionProfile | null {
  return (
    FOOTBALL_COMPETITION_PROFILES_V1.find(
      (c) =>
        c.provider === provider &&
        c.providerCompetitionId === String(providerCompetitionId),
    ) ?? null
  );
}

export function isCompetitionProfiled(
  provider: string,
  providerCompetitionId: string,
): boolean {
  return getCompetitionProfileByProviderId(provider, providerCompetitionId) != null;
}

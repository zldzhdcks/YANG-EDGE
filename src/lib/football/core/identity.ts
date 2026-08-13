import {
  getCompetitionProfileById,
  type FootballCompetitionProfile,
} from "../competition/profiles";
import { resolveFixtureKickoffUtc } from "./kickoff";
import { resolveMatchFormat, resolvePredictionEligibility } from "./match-format";
import { resolveProviderTeam } from "./team-catalog";
import type {
  FootballIdentityRowStatus,
  FootballMatchFormat,
  FootballPredictionEligibility,
  FootballProviderId,
  FootballScheduleRowV1,
} from "./types";

export function resolveScheduleIdentityFields(input: {
  provider: FootballProviderId;
  homeProviderTeamId: string;
  awayProviderTeamId: string;
  seasonId: string | null;
  kickoffTimeUtc: string | null;
  matchFormat: FootballMatchFormat;
  profile: Pick<
    FootballCompetitionProfile,
    "researchStatus" | "predictionEligibility"
  >;
}): {
  homeTeamId: string | null;
  awayTeamId: string | null;
  identityStatus: FootballIdentityRowStatus;
  identityReasons: string[];
  predictionEligibility: FootballPredictionEligibility;
} {
  const home = resolveProviderTeam(input.provider, input.homeProviderTeamId);
  const away = resolveProviderTeam(input.provider, input.awayProviderTeamId);
  const reasons = [...home.reasons, ...away.reasons];

  if (input.seasonId == null) {
    reasons.push("SEASON_MISSING");
  }
  if (!input.kickoffTimeUtc) {
    reasons.push("KICKOFF_MISSING");
  }

  const identityOk =
    home.status === "MATCHED" &&
    away.status === "MATCHED" &&
    input.seasonId != null &&
    Boolean(input.kickoffTimeUtc);

  return {
    homeTeamId: home.canonicalTeamId,
    awayTeamId: away.canonicalTeamId,
    identityStatus: identityOk ? "MATCHED" : "IDENTITY_REVIEW_REQUIRED",
    identityReasons: reasons,
    predictionEligibility: resolvePredictionEligibility({
      identityOk,
      matchFormat: input.matchFormat,
      profile: input.profile,
    }),
  };
}

/**
 * Re-resolve identity and competition-profile eligibility.
 * Preserves matchId. Canonicalizes kickoff instant to UTC ISO. Does not
 * change provider IDs or competition identity.
 */
export function rejoinFootballScheduleRow(
  row: FootballScheduleRowV1,
  dateKst: string,
): FootballScheduleRowV1 {
  if (row.dateKst !== dateKst) {
    throw new Error(
      `FIXTURE_DATE_KST_MISMATCH: row=${row.dateKst} requested=${dateKst} matchId=${row.matchId}`,
    );
  }
  const profile = getCompetitionProfileById(row.competitionId);
  if (!profile) {
    throw new Error(`COMPETITION_PROFILE_MISSING: ${row.competitionId}`);
  }
  const kickoffTimeUtc = resolveFixtureKickoffUtc({
    rawDate: row.kickoffTimeUtc,
    dateKst,
    fixtureId: row.providerMatchId,
  });
  const matchFormat = resolveMatchFormat(profile);
  const identity = resolveScheduleIdentityFields({
    provider: row.provider,
    homeProviderTeamId: row.homeProviderTeamId,
    awayProviderTeamId: row.awayProviderTeamId,
    seasonId: row.seasonId,
    kickoffTimeUtc,
    matchFormat,
    profile,
  });
  return {
    ...row,
    kickoffTimeUtc,
    matchFormat,
    ...identity,
  };
}

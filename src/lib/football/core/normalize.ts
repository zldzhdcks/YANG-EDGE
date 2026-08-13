import { buildFootballMatchId } from "@/lib/football/foundation/match-identity";
import { getCompetitionProfileByProviderId } from "../competition/profiles";
import { resolveScheduleIdentityFields } from "./identity";
import { resolveFixtureKickoffUtc } from "./kickoff";
import { resolveMatchFormat } from "./match-format";
import { normalizeFootballScheduleStatus } from "./status";
import type { FootballScheduleRowV1 } from "./types";
import type { FixtureRaw } from "../types";

export function assertResearchFixtureInput(raw: unknown): FixtureRaw {
  if (raw == null || typeof raw !== "object") {
    throw new Error("FIXTURE_ROOT_INVALID: fixture must be an object");
  }
  const rec = raw as Record<string, unknown>;
  if ("aiAnalysisAvailable" in rec && !("fixture" in rec)) {
    throw new Error(
      "DUMMY_PRODUCT_GAMES_NOT_RESEARCH: constants/games.ts rows cannot become schedule data",
    );
  }
  if (!rec.fixture || typeof rec.fixture !== "object") {
    throw new Error("FIXTURE_ROOT_INVALID: missing fixture object");
  }
  return raw as FixtureRaw;
}

export function normalizeFixtureToScheduleRow(input: {
  fixture: FixtureRaw;
  dateKst: string;
  provider: "api-football";
}): FootballScheduleRowV1 | { drop: "UNREGISTERED_COMPETITION" } {
  const fx = assertResearchFixtureInput(input.fixture);
  const providerMatchId = String(fx.fixture?.id ?? "").trim();
  if (!providerMatchId) {
    throw new Error("FIXTURE_ID_REQUIRED");
  }

  const providerCompetitionId = String(fx.league?.id ?? "").trim();
  const profile = getCompetitionProfileByProviderId(
    input.provider,
    providerCompetitionId,
  );
  if (!profile) {
    return { drop: "UNREGISTERED_COMPETITION" };
  }

  const homeProviderTeamId = String(fx.teams?.home?.id ?? "").trim();
  const awayProviderTeamId = String(fx.teams?.away?.id ?? "").trim();
  if (!homeProviderTeamId || !awayProviderTeamId) {
    throw new Error(
      `PROVIDER_TEAM_ID_MISSING: fixture=${providerMatchId}`,
    );
  }

  const seasonRaw = fx.league?.season;
  const seasonId =
    typeof seasonRaw === "number" && Number.isFinite(seasonRaw)
      ? String(seasonRaw)
      : null;

  const kickoffTimeUtc = resolveFixtureKickoffUtc({
    rawDate: fx.fixture?.date,
    dateKst: input.dateKst,
    fixtureId: providerMatchId,
  });
  const matchFormat = resolveMatchFormat(profile);
  const identity = resolveScheduleIdentityFields({
    provider: input.provider,
    homeProviderTeamId,
    awayProviderTeamId,
    seasonId,
    kickoffTimeUtc,
    matchFormat,
    profile,
  });

  const venueName = fx.fixture?.venue?.name?.trim() || null;

  return {
    dateKst: input.dateKst,
    matchId: buildFootballMatchId(input.provider, providerMatchId),
    provider: input.provider,
    providerMatchId,
    competitionId: profile.competitionId,
    seasonId,
    competitionType: profile.competitionType,
    matchFormat,
    homeProviderTeamId,
    awayProviderTeamId,
    homeTeamName: String(fx.teams?.home?.name ?? "").trim(),
    awayTeamName: String(fx.teams?.away?.name ?? "").trim(),
    kickoffTimeUtc,
    status: normalizeFootballScheduleStatus(fx.fixture?.status?.short),
    venue: venueName,
    researchOnly: true,
    ...identity,
  };
}

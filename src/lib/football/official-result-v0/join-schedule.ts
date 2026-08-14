/**
 * Exact identity join: Schedule row ↔ API-Football fixture.
 * Provider team IDs only. No display-name / fuzzy join. No home/away auto-correct.
 */
import { getCompetitionProfileByProviderId } from "../competition/profiles";
import { canonicalizeKickoffTimeUtc } from "../core/kickoff";
import type { FootballScheduleRowV1 } from "../core/types";
import type { FixtureRaw } from "../types";

export type ProviderScheduleJoinResult = {
  ok: boolean;
  orientation: "MATCHED" | "REVERSED_SUSPECTED" | "MISMATCH";
  reasonCodes: string[];
};

export function joinProviderFixtureToScheduleRow(
  fixture: FixtureRaw,
  row: FootballScheduleRowV1,
): ProviderScheduleJoinResult {
  const reasonCodes: string[] = [];
  const fixtureId = String(fixture.fixture?.id ?? "").trim();
  if (fixtureId !== String(row.providerMatchId)) {
    reasonCodes.push("FIXTURE_ID_MISMATCH");
  }

  const homeProvider = String(fixture.teams?.home?.id ?? "").trim();
  const awayProvider = String(fixture.teams?.away?.id ?? "").trim();
  if (!homeProvider || !awayProvider) {
    reasonCodes.push("PROVIDER_TEAM_ID_MISSING");
  }

  const homeMatch = homeProvider === row.homeProviderTeamId;
  const awayMatch = awayProvider === row.awayProviderTeamId;
  const reversed =
    homeProvider === row.awayProviderTeamId &&
    awayProvider === row.homeProviderTeamId;

  let orientation: ProviderScheduleJoinResult["orientation"] = "MATCHED";
  if (homeMatch && awayMatch) {
    orientation = "MATCHED";
  } else if (reversed) {
    orientation = "REVERSED_SUSPECTED";
    reasonCodes.push("REVERSED_RESULT_SUSPECTED");
  } else {
    orientation = "MISMATCH";
    reasonCodes.push("HOME_AWAY_MISMATCH");
  }

  const providerCompetitionId = String(fixture.league?.id ?? "").trim();
  if (providerCompetitionId) {
    const profile = getCompetitionProfileByProviderId(
      "api-football",
      providerCompetitionId,
    );
    if (!profile) {
      reasonCodes.push("COMPETITION_PROFILE_MISSING");
    } else if (profile.competitionId !== row.competitionId) {
      reasonCodes.push("COMPETITION_ID_MISMATCH");
    }
  } else {
    reasonCodes.push("PROVIDER_COMPETITION_ID_MISSING");
  }

  const rawDate =
    typeof fixture.fixture?.date === "string"
      ? fixture.fixture.date.trim()
      : "";
  const scheduleKickoff =
    typeof row.kickoffTimeUtc === "string" ? row.kickoffTimeUtc.trim() : "";
  if (!rawDate) {
    reasonCodes.push("PROVIDER_KICKOFF_MISSING");
  }
  if (!scheduleKickoff) {
    reasonCodes.push("SCHEDULE_KICKOFF_MISSING");
  }
  if (rawDate && scheduleKickoff) {
    try {
      const providerKickoff = canonicalizeKickoffTimeUtc(rawDate);
      if (providerKickoff !== row.kickoffTimeUtc) {
        reasonCodes.push("KICKOFF_MISMATCH");
      }
    } catch {
      reasonCodes.push("PROVIDER_KICKOFF_INVALID");
    }
  }

  const ok = reasonCodes.length === 0 && orientation === "MATCHED";
  if (!ok && !reasonCodes.includes("IDENTITY_UNRESOLVED")) {
    reasonCodes.push("IDENTITY_UNRESOLVED");
  }
  return { ok, orientation, reasonCodes };
}

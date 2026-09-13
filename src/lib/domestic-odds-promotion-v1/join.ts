import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { instantToKst } from "../datetime/kst";
import { findCompetitionByOperatorLabel } from "../football/foundation/competition-registry";
import type { FootballScheduleArtifactV1 } from "../football/core/types";
import { footballScheduleV1Rel } from "../football/core/paths";
import { mlbScheduleArtifactRel } from "../mlb/build-mlb-schedule-artifact";
import type { MlbScheduleArtifactDocument } from "../mlb/mlb-schedule-artifact-types";
import { TEAM_ALIASES } from "../teams/team-aliases";
import { normalizeTeamName } from "../teams/normalize-team-name";
import type { JoinStatusV1, StructuredOddsRowV1 } from "./types";

function resolveApprovedAlias(label: string, league: string, sport: string) {
  const n = normalizeTeamName(label);
  if (!n) return null;
  return (
    TEAM_ALIASES.find((a) => {
      if (a.league !== league || a.sport !== sport) return false;
      if (normalizeTeamName(a.displayName) === n) return true;
      return a.originalNames.some((name) => normalizeTeamName(name) === n);
    }) ?? null
  );
}

function aliasMatchesScheduleTeam(
  alias: NonNullable<ReturnType<typeof resolveApprovedAlias>>,
  teamName: string,
  providerTeamId: string,
) {
  const names = [alias.displayName, ...alias.originalNames].map((n) =>
    normalizeTeamName(n),
  );
  if (names.includes(normalizeTeamName(teamName))) return true;
  return (alias.externalIds ?? []).some(
    (ext) => ext.provider === "api-football" && ext.id === String(providerTeamId),
  );
}

export function loadFootballScheduleIfPresent(
  cwd: string,
  dateKst: string,
): FootballScheduleArtifactV1 | null {
  const rel = footballScheduleV1Rel(dateKst);
  const abs = path.join(cwd, rel);
  if (!existsSync(abs)) return null;
  return JSON.parse(readFileSync(abs, "utf8")) as FootballScheduleArtifactV1;
}

export function loadMlbScheduleIfPresent(
  cwd: string,
  dateKst: string,
): MlbScheduleArtifactDocument | null {
  const rel = mlbScheduleArtifactRel(dateKst);
  const abs = path.join(cwd, rel);
  if (!existsSync(abs)) return null;
  return JSON.parse(readFileSync(abs, "utf8")) as MlbScheduleArtifactDocument;
}

export function joinStructuredOddsRow(
  row: StructuredOddsRowV1,
  input: {
    footballSchedule: FootballScheduleArtifactV1 | null;
    mlbSchedule: MlbScheduleArtifactDocument | null;
  },
): StructuredOddsRowV1 {
  if (row.extractionStatus === "SOURCE_UNREADABLE") {
    return {
      ...row,
      joinStatus: "SOURCE_UNREADABLE",
      canonicalFixtureId: null,
      predictionInputAllowed: false,
      rejectionReason: uniqueReasons(row.rejectionReason, ["SOURCE_UNREADABLE"]),
    };
  }
  if (row.targetDateKst && row.targetDateKst !== row.operatingDateKst) {
    return {
      ...row,
      joinStatus: "EXCLUDED_NON_TARGET_DATE",
      canonicalFixtureId: null,
      predictionInputAllowed: false,
      rejectionReason: uniqueReasons(row.rejectionReason, [
        "EXCLUDED_NON_TARGET_DATE",
      ]),
    };
  }
  const league = row.competitionRawLabel ?? "";
  if (league === "KBO" || league === "NPB") {
    const home = resolveApprovedAlias(row.homeRawName ?? "", league, "baseball");
    const away = resolveApprovedAlias(row.awayRawName ?? "", league, "baseball");
    const joinStatus: JoinStatusV1 =
      home && away
        ? "TEAM_ALIAS_MATCHED_NO_SCHEDULE"
        : "IDENTITY_REVIEW_REQUIRED";
    return {
      ...row,
      joinStatus,
      canonicalFixtureId: null,
      rejectionReason: uniqueReasons(row.rejectionReason, [
        joinStatus === "TEAM_ALIAS_MATCHED_NO_SCHEDULE"
          ? `${league}_ALIAS_PAIR_NO_DAILY_SCHEDULE_ARTIFACT`
          : "OPERATOR_LABEL_NOT_IN_APPROVED_ALIAS",
      ]),
    };
  }
  if (league === "MLB") {
    const home = resolveApprovedAlias(row.homeRawName ?? "", "MLB", "baseball");
    const away = resolveApprovedAlias(row.awayRawName ?? "", "MLB", "baseball");
    if (!home || !away) {
      return withJoin(row, "IDENTITY_REVIEW_REQUIRED", null, [
        "OPERATOR_LABEL_NOT_IN_APPROVED_ALIAS",
      ]);
    }
    if (!input.mlbSchedule) {
      return withJoin(row, "TEAM_ALIAS_MATCHED_NO_SCHEDULE", null, [
        "MLB_SCHEDULE_ARTIFACT_MISSING",
      ]);
    }
    const hits = input.mlbSchedule.games.filter((g) => {
      if (g.startTimeKst !== row.displayedStartKst) return false;
      return (
        (g.homeTeam === home.displayName && g.awayTeam === away.displayName) ||
        (g.homeTeam === away.displayName && g.awayTeam === home.displayName)
      );
    });
    if (hits.length !== 1) {
      return withJoin(row, "IDENTITY_REVIEW_REQUIRED", null, [
        hits.length === 0 ? "SCHEDULE_NOT_FOUND" : "AMBIGUOUS_SCHEDULE_HITS",
      ]);
    }
    return withJoin(row, "SCHEDULE_MATCHED", String(hits[0]!.gamePk), [
      "EXACT_REGISTERED_ALIAS",
      "EXACT_SCHEDULE_TIME",
    ]);
  }

  const competition = findCompetitionByOperatorLabel(league);
  if (!competition) {
    return withJoin(row, "COMPETITION_REVIEW_REQUIRED", null, [
      "UNREGISTERED_COMPETITION",
      `SCREENSHOT_LEAGUE_${league}_NOT_IN_COMPETITION_REGISTRY`,
    ]);
  }
  const home = resolveApprovedAlias(
    row.homeRawName ?? "",
    competition.displayName,
    "football",
  );
  const away = resolveApprovedAlias(
    row.awayRawName ?? "",
    competition.displayName,
    "football",
  );
  if (!home || !away) {
    return withJoin(row, "IDENTITY_REVIEW_REQUIRED", null, [
      "OPERATOR_LABEL_NOT_IN_APPROVED_ALIAS",
    ]);
  }
  if (!input.footballSchedule) {
    return withJoin(row, "TEAM_ALIAS_MATCHED_NO_SCHEDULE", null, [
      "FOOTBALL_SCHEDULE_ARTIFACT_MISSING",
    ]);
  }
  const hits = input.footballSchedule.rows.filter((g) => {
    if (g.competitionId !== competition.competitionId) return false;
    if (!aliasMatchesScheduleTeam(home, g.homeTeamName, g.homeProviderTeamId)) {
      return false;
    }
    if (!aliasMatchesScheduleTeam(away, g.awayTeamName, g.awayProviderTeamId)) {
      return false;
    }
    const kst = g.kickoffTimeUtc
      ? instantToKst(g.kickoffTimeUtc)?.time ?? null
      : null;
    return kst === row.displayedStartKst;
  });
  if (hits.length !== 1) {
    return withJoin(row, "IDENTITY_REVIEW_REQUIRED", null, [
      hits.length === 0 ? "SCHEDULE_NOT_FOUND" : "AMBIGUOUS_SCHEDULE_HITS",
    ]);
  }
  return withJoin(row, "SCHEDULE_MATCHED", hits[0]!.matchId, [
    "EXACT_REGISTERED_ALIAS",
    "EXACT_HOME_AWAY_PAIR",
    "EXACT_SCHEDULED_KST_TIME",
  ]);
}

function uniqueReasons(current: string[], extra: string[]): string[] {
  return [...new Set([...current, ...extra])];
}

function withJoin(
  row: StructuredOddsRowV1,
  joinStatus: JoinStatusV1,
  canonicalFixtureId: string | null,
  extra: string[],
): StructuredOddsRowV1 {
  return {
    ...row,
    joinStatus,
    canonicalFixtureId,
    predictionInputAllowed: false,
    rejectionReason: uniqueReasons(row.rejectionReason, extra),
  };
}

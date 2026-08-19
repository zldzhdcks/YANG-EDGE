/**
 * Provider fixture identity for Official Result eligibility.
 * Canonical catalog IDs are not part of this contract.
 */
import { isCanonicalUtcIso } from "../core/kickoff";
import type { FootballScheduleRowV1 } from "../core/types";

export function hasCompleteProviderFixtureIdentity(
  row: Pick<
    FootballScheduleRowV1,
    | "provider"
    | "providerMatchId"
    | "competitionId"
    | "seasonId"
    | "homeProviderTeamId"
    | "awayProviderTeamId"
    | "kickoffTimeUtc"
  >,
): boolean {
  if (row.provider !== "api-football") return false;
  if (!String(row.providerMatchId ?? "").trim()) return false;
  if (!String(row.competitionId ?? "").trim()) return false;
  if (row.seasonId == null || !String(row.seasonId).trim()) return false;
  if (!String(row.homeProviderTeamId ?? "").trim()) return false;
  if (!String(row.awayProviderTeamId ?? "").trim()) return false;
  const kickoff =
    typeof row.kickoffTimeUtc === "string" ? row.kickoffTimeUtc.trim() : "";
  if (!kickoff || !isCanonicalUtcIso(kickoff)) return false;
  return true;
}

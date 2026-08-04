/**
 * Join Football Result to Identity Foundation.
 * Never auto-correct home/away reverse.
 */
import type { FootballMatchIdentity } from "../foundation/types";
import type { FootballResultInputV0 } from "./types";

export type FootballResultIdentityJoinResult = {
  ok: boolean;
  orientation: "MATCHED" | "REVERSED_SUSPECTED" | "MISMATCH";
  reasonCodes: string[];
  audit: string[];
};

export function joinResultToIdentity(
  row: Pick<
    FootballResultInputV0,
    | "matchId"
    | "identityHash"
    | "provider"
    | "fixtureId"
    | "competitionId"
    | "season"
    | "homeTeamId"
    | "awayTeamId"
  >,
  identity: FootballMatchIdentity,
): FootballResultIdentityJoinResult {
  const reasonCodes: string[] = [];
  const audit: string[] = [];

  if (row.provider !== identity.provider) reasonCodes.push("PROVIDER_MISMATCH");
  if (String(row.fixtureId) !== String(identity.fixtureId)) {
    reasonCodes.push("FIXTURE_ID_MISMATCH");
  }
  if (row.matchId !== identity.matchId) reasonCodes.push("MATCH_ID_MISMATCH");
  if (row.identityHash !== identity.identityHash) {
    reasonCodes.push("IDENTITY_HASH_MISMATCH");
  }
  if (row.competitionId !== identity.competitionId) {
    reasonCodes.push("COMPETITION_ID_MISMATCH");
  }
  if (row.season !== identity.season) reasonCodes.push("SEASON_MISMATCH");

  const homeMatch = row.homeTeamId === identity.homeTeamId;
  const awayMatch = row.awayTeamId === identity.awayTeamId;
  const reversed =
    row.homeTeamId === identity.awayTeamId &&
    row.awayTeamId === identity.homeTeamId;

  let orientation: FootballResultIdentityJoinResult["orientation"] = "MATCHED";
  if (homeMatch && awayMatch) {
    orientation = "MATCHED";
    audit.push("ORIENTATION_MATCHED");
  } else if (reversed) {
    orientation = "REVERSED_SUSPECTED";
    reasonCodes.push("REVERSED_RESULT_SUSPECTED");
    audit.push("AUTO_CORRECT_FORBIDDEN");
  } else {
    orientation = "MISMATCH";
    reasonCodes.push("HOME_AWAY_MISMATCH");
  }

  const ok = reasonCodes.length === 0 && orientation === "MATCHED";
  if (!ok) reasonCodes.push("IDENTITY_UNRESOLVED");

  return { ok, orientation, reasonCodes, audit };
}

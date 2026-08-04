/**
 * Join odds row to Football Match Identity.
 * Never auto-approve home/away reverse; never match by displayName.
 */
import type { FootballMatchIdentity } from "../foundation/types";
import type {
  FootballOddsIdentityJoin,
  FootballOddsIdentityJoinResult,
  FootballOneXTwoOddsRow,
} from "./types";

export function joinOddsRowToIdentity(
  row: Pick<
    FootballOneXTwoOddsRow,
    | "matchId"
    | "identityHash"
    | "provider"
    | "fixtureId"
    | "competitionId"
    | "homeTeamId"
    | "awayTeamId"
    | "commenceTime"
  >,
  identity: FootballMatchIdentity,
): FootballOddsIdentityJoinResult {
  const audit: string[] = [];
  const reasonCodes: string[] = [];

  if (row.provider !== identity.provider) {
    reasonCodes.push("PROVIDER_MISMATCH");
  }
  if (String(row.fixtureId) !== String(identity.fixtureId)) {
    reasonCodes.push("FIXTURE_ID_MISMATCH");
  }
  if (row.matchId !== identity.matchId) {
    reasonCodes.push("MATCH_ID_MISMATCH");
  }
  if (row.identityHash !== identity.identityHash) {
    reasonCodes.push("IDENTITY_HASH_MISMATCH");
  }
  if (row.competitionId !== identity.competitionId) {
    reasonCodes.push("COMPETITION_ID_MISMATCH");
  }

  const homeMatch = row.homeTeamId === identity.homeTeamId;
  const awayMatch = row.awayTeamId === identity.awayTeamId;
  const reversed =
    row.homeTeamId === identity.awayTeamId &&
    row.awayTeamId === identity.homeTeamId;

  let orientation: FootballOddsIdentityJoinResult["orientation"] = "MATCHED";

  if (homeMatch && awayMatch) {
    orientation = "MATCHED";
    audit.push("ORIENTATION_MATCHED");
  } else if (reversed) {
    orientation = "REVERSED_SUSPECTED";
    reasonCodes.push("HOME_AWAY_REVERSED_NOT_AUTO_APPROVED");
    audit.push(
      "ORIENTATION_REVERSED_SUSPECTED — explicit mapping required; auto-correct forbidden",
    );
  } else {
    orientation = "MISMATCH";
    reasonCodes.push("HOME_AWAY_MISMATCH");
    audit.push("ORIENTATION_MISMATCH");
  }

  const commenceRow = Date.parse(row.commenceTime);
  const commenceId = Date.parse(identity.kickoffUtc);
  if (
    !Number.isNaN(commenceRow) &&
    !Number.isNaN(commenceId) &&
    commenceRow !== commenceId
  ) {
    reasonCodes.push("COMMENCE_TIME_MISMATCH");
    audit.push(
      `commenceTime row=${row.commenceTime} identity.kickoffUtc=${identity.kickoffUtc}`,
    );
  }

  const ok = reasonCodes.length === 0 && orientation === "MATCHED";
  if (!ok && !reasonCodes.includes("IDENTITY_UNRESOLVED")) {
    reasonCodes.push("IDENTITY_UNRESOLVED");
  }

  return { ok, orientation, reasonCodes, audit };
}

export function identityJoinFromMatch(
  identity: FootballMatchIdentity,
): FootballOddsIdentityJoin {
  return {
    matchId: identity.matchId,
    identityHash: identity.identityHash,
    provider: identity.provider,
    fixtureId: identity.fixtureId,
    competitionId: identity.competitionId,
    homeTeamId: identity.homeTeamId,
    awayTeamId: identity.awayTeamId,
    commenceTime: identity.kickoffUtc,
  };
}

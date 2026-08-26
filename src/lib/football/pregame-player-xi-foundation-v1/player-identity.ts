/**
 * Football player identity v1.
 * Provider player ID is preserved. It is never a YANG canonical player ID.
 * No fuzzy name matching. No global player registry in v1 ⇒ MATCHED is unused.
 */
import type { FootballPlayerIdentityV1 } from "./types";

export function resolveFootballPlayerIdentity(input: {
  providerPlayerId: string | number | null | undefined;
  providerTeamId: string | number | null | undefined;
  canonicalTeamId: string | null;
  playerName: string | null | undefined;
}): FootballPlayerIdentityV1 {
  const providerPlayerId =
    input.providerPlayerId == null || String(input.providerPlayerId).trim() === ""
      ? null
      : String(input.providerPlayerId).trim();
  const providerTeamId =
    input.providerTeamId == null || String(input.providerTeamId).trim() === ""
      ? null
      : String(input.providerTeamId).trim();
  const name =
    input.playerName == null || String(input.playerName).trim() === ""
      ? null
      : String(input.playerName).trim();

  let identityStatus: FootballPlayerIdentityV1["identityStatus"] =
    "PLAYER_IDENTITY_REVIEW_REQUIRED";
  if (providerPlayerId) {
    identityStatus = "PROVIDER_ID_ONLY";
  }

  return {
    provider: "api-football",
    providerPlayerId,
    providerTeamId,
    canonicalTeamId: input.canonicalTeamId,
    canonicalPlayerId: null,
    playerName: name,
    providerReportedPlayerName: name,
    identityStatus,
  };
}

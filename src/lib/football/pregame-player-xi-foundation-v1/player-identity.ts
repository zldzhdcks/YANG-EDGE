/**
 * Football player identity v1.
 * Provider player ID is preserved. It is never a YANG canonical player ID.
 * No fuzzy name matching. MATCHED only when a caller supplies a real mapping.
 */
import type {
  FootballPlayerIdentityStatus,
  FootballPlayerIdentityV1,
} from "./types";

function asNullableId(value: string | number | null | undefined): string | null {
  if (value == null || String(value).trim() === "") return null;
  return String(value).trim();
}

function asNullableName(value: string | null | undefined): string | null {
  if (value == null || String(value).trim() === "") return null;
  return String(value).trim();
}

export function isFootballPlayerIdentityIncomplete(
  status: FootballPlayerIdentityStatus,
): boolean {
  return (
    status === "PLAYER_IDENTITY_REVIEW_REQUIRED" ||
    status === "PLAYER_ID_UNRESOLVED"
  );
}

/**
 * Resolve player identity from provider fields.
 *
 * MATCHED is never auto-generated. canonicalPlayerId is never copied from
 * providerPlayerId. playerName is display-only.
 */
export function resolveFootballPlayerIdentity(input: {
  providerPlayerId: string | number | null | undefined;
  providerTeamId: string | number | null | undefined;
  canonicalTeamId: string | null;
  playerName: string | null | undefined;
  canonicalPlayerId?: string | null;
  /**
   * Must be explicitly true when a real canonical registry mapping exists.
   * Default false — do not promote PROVIDER_ID_ONLY to MATCHED.
   */
  canonicalMappingPresent?: boolean;
  identityReviewRequired?: boolean;
}): FootballPlayerIdentityV1 {
  const providerPlayerId = asNullableId(input.providerPlayerId);
  const providerTeamId = asNullableId(input.providerTeamId);
  const name = asNullableName(input.playerName);
  const suppliedCanonical = asNullableId(input.canonicalPlayerId ?? null);

  let identityStatus: FootballPlayerIdentityStatus;
  let canonicalPlayerId: string | null = null;

  if (input.identityReviewRequired === true) {
    identityStatus = "PLAYER_IDENTITY_REVIEW_REQUIRED";
  } else if (!providerPlayerId) {
    identityStatus = "PLAYER_ID_UNRESOLVED";
  } else if (
    input.canonicalMappingPresent === true &&
    suppliedCanonical != null
  ) {
    identityStatus = "MATCHED";
    canonicalPlayerId = suppliedCanonical;
  } else {
    identityStatus = "PROVIDER_ID_ONLY";
  }

  return {
    provider: "api-football",
    providerPlayerId,
    providerTeamId,
    canonicalTeamId: input.canonicalTeamId,
    canonicalPlayerId,
    playerName: name,
    providerReportedPlayerName: name,
    identityStatus,
  };
}

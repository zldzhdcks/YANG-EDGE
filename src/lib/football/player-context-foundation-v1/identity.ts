/**
 * Team / player / coach identity for player-context foundation v1.
 * Reuses P0 player identity and team catalog.
 * Exact provider IDs only. Name-based identity guesses are prohibited.
 */
import { resolveProviderTeam } from "../core/team-catalog";
import type { FootballIdentityGateResult } from "../foundation/types";
import { resolveFootballPlayerIdentity } from "../pregame-player-xi-foundation-v1/player-identity";
import type { FootballCoachIdentityStatus, FootballCoachIdentityV1 } from "./types";

export { resolveFootballPlayerIdentity };

export function resolveFootballCoachIdentity(input: {
  providerCoachId: string | number | null | undefined;
  name: string | null | undefined;
  firstname?: string | null;
  lastname?: string | null;
}): FootballCoachIdentityV1 {
  const providerCoachId =
    input.providerCoachId == null || String(input.providerCoachId).trim() === ""
      ? null
      : String(input.providerCoachId).trim();
  const name =
    input.name == null || String(input.name).trim() === ""
      ? null
      : String(input.name).trim();

  let identityStatus: FootballCoachIdentityStatus = "COACH_IDENTITY_REVIEW_REQUIRED";
  if (providerCoachId) {
    identityStatus = "PROVIDER_ID_ONLY";
  }

  return {
    provider: "api-football",
    providerCoachId,
    canonicalCoachId: null,
    name,
    firstname:
      input.firstname == null || String(input.firstname).trim() === ""
        ? null
        : String(input.firstname).trim(),
    lastname:
      input.lastname == null || String(input.lastname).trim() === ""
        ? null
        : String(input.lastname).trim(),
    identityStatus,
  };
}

/**
 * Canonical team attachment from the team catalog.
 * Player/squad/coach rows never repair a blocked team identity.
 */
export function resolvePlayerContextTeamAttachment(input: {
  providerTeamId: string | null;
  providerTeamName?: string | null;
  identityGate?: FootballIdentityGateResult | null;
}): {
  canonicalTeamId: string | null;
  canonicalTeamAttached: boolean;
  operatorGameAttached: boolean;
  teamStatus: "MATCHED" | "IDENTITY_REVIEW_REQUIRED";
  reasons: string[];
} {
  const team = input.providerTeamId
    ? resolveProviderTeam(
        "api-football",
        input.providerTeamId,
        input.providerTeamName ?? null,
      )
    : {
        status: "IDENTITY_REVIEW_REQUIRED" as const,
        canonicalTeamId: null,
        reasons: ["PROVIDER_TEAM_ID_MISSING"],
      };

  const canonicalTeamAttached =
    team.status === "MATCHED" && Boolean(team.canonicalTeamId);
  const operatorGameAttached =
    canonicalTeamAttached && input.identityGate?.verdict === "PASS";

  return {
    canonicalTeamId: canonicalTeamAttached ? team.canonicalTeamId : null,
    canonicalTeamAttached,
    operatorGameAttached,
    teamStatus: team.status,
    reasons: team.reasons,
  };
}

/**
 * Fixture/team identity gate for attaching player/XI rows to an operator game.
 * Reuses evaluateFootballIdentityGate + resolveProviderTeam.
 * Unresolved identity ⇒ PROVIDER_FIXTURE_RESEARCH_ONLY.
 */
import { evaluateFootballIdentityGate } from "../foundation/identity-gate";
import { resolveProviderTeam } from "../core/team-catalog";
import type { FootballIdentityGateResult } from "../foundation/types";
import type { FootballAttachmentKind } from "./types";

export function resolveFootballTeamAttachment(input: {
  identityGate: FootballIdentityGateResult;
  providerTeamId: string | null;
  providerTeamName?: string | null;
}): {
  canonicalTeamId: string | null;
  attachmentKind: FootballAttachmentKind;
  operatorGameAttached: boolean;
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

  const attach =
    input.identityGate.verdict === "PASS" &&
    team.status === "MATCHED" &&
    Boolean(team.canonicalTeamId);

  return {
    canonicalTeamId: attach ? team.canonicalTeamId : null,
    attachmentKind: attach
      ? "OPERATOR_GAME_ATTACHED"
      : "PROVIDER_FIXTURE_RESEARCH_ONLY",
    operatorGameAttached: attach,
  };
}

export function footballIdentityGateFromPartial(
  input: Parameters<typeof evaluateFootballIdentityGate>[0],
): FootballIdentityGateResult {
  return evaluateFootballIdentityGate(input);
}

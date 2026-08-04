/**
 * Football Identity Gate v0 — must PASS before any future Prediction.
 * FAIL ⇒ predictionAllowed = false always.
 */
import { isCompetitionRegistered } from "./competition-registry";
import {
  buildFootballMatchIdentity,
  computeFootballIdentityHash,
} from "./match-identity";
import { isTeamRegistered } from "./team-registry";
import type {
  FootballIdentityGateResult,
  FootballMatchIdentityInput,
} from "./types";

export function evaluateFootballIdentityGate(
  input: Partial<FootballMatchIdentityInput> & {
    provider?: string;
    fixtureId?: string;
  },
): FootballIdentityGateResult {
  const reasonCodes: string[] = [];

  const fixtureId = String(input.fixtureId ?? "").trim();
  if (!fixtureId) {
    reasonCodes.push("FIXTURE_ID_MISSING");
  }

  const provider = input.provider;
  if (!provider) {
    reasonCodes.push("PROVIDER_MISSING");
  }

  const competitionId = String(input.competitionId ?? "").trim();
  if (!competitionId) {
    reasonCodes.push("COMPETITION_ID_MISSING");
  } else if (!isCompetitionRegistered(competitionId)) {
    reasonCodes.push("COMPETITION_NOT_REGISTERED");
  }

  const homeTeamId = String(input.homeTeamId ?? "").trim();
  const awayTeamId = String(input.awayTeamId ?? "").trim();
  if (!homeTeamId || !awayTeamId) {
    reasonCodes.push("TEAM_ID_MISSING");
  } else if (provider) {
    if (!isTeamRegistered(provider, homeTeamId)) {
      reasonCodes.push("HOME_TEAM_NOT_REGISTERED");
    }
    if (!isTeamRegistered(provider, awayTeamId)) {
      reasonCodes.push("AWAY_TEAM_NOT_REGISTERED");
    }
  } else {
    reasonCodes.push("TEAM_REGISTRY_UNCHECKED_NO_PROVIDER");
  }

  const kickoffUtc = String(input.kickoffUtc ?? "").trim();
  if (!kickoffUtc) {
    reasonCodes.push("KICKOFF_MISSING");
  } else if (Number.isNaN(Date.parse(kickoffUtc))) {
    reasonCodes.push("KICKOFF_INVALID");
  }

  const season = String(input.season ?? "").trim();
  if (!season) {
    reasonCodes.push("SEASON_MISSING");
  }

  if (input.status == null) {
    reasonCodes.push("STATUS_MISSING");
  }

  if (reasonCodes.length > 0) {
    return {
      verdict: "FAIL",
      reasonCodes,
      matchId: null,
      identityHash: null,
      predictionAllowed: false,
    };
  }

  const full: FootballMatchIdentityInput = {
    provider: provider as FootballMatchIdentityInput["provider"],
    fixtureId,
    competitionId,
    season,
    kickoffUtc,
    homeTeamId,
    awayTeamId,
    neutralVenue: Boolean(input.neutralVenue),
    status: input.status!,
  };

  try {
    const identity = buildFootballMatchIdentity(full);
    const hashCheck = computeFootballIdentityHash(full);
    if (hashCheck !== identity.identityHash) {
      return {
        verdict: "FAIL",
        reasonCodes: ["IDENTITY_HASH_MISMATCH"],
        matchId: identity.matchId,
        identityHash: null,
        predictionAllowed: false,
      };
    }
    return {
      verdict: "PASS",
      reasonCodes: [],
      matchId: identity.matchId,
      identityHash: identity.identityHash,
      predictionAllowed: true,
    };
  } catch (e) {
    return {
      verdict: "FAIL",
      reasonCodes: [
        "IDENTITY_HASH_BUILD_FAILED",
        e instanceof Error ? e.message : "UNKNOWN",
      ],
      matchId: null,
      identityHash: null,
      predictionAllowed: false,
    };
  }
}

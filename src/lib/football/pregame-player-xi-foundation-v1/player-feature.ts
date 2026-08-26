/**
 * Player Feature Dataset + XI Strength boundary.
 * v1: contracts only. No scores, weights, or probability adjustment.
 */
import type { FootballPlayerFeatureContractV1 } from "./types";

export const XI_STRENGTH_PROHIBITED = true as const;
export const PLAYER_IMPORTANCE_WEIGHTING_PROHIBITED = true as const;
export const INJURY_PENALTY_WEIGHTING_PROHIBITED = true as const;
export const REPLACEMENT_PLAYER_PENALTY_PROHIBITED = true as const;
export const PROBABILITY_ADJUSTMENT_PROHIBITED = true as const;

export function emptyPlayerFeatureContract(input: {
  providerPlayerId: string | null;
  providerTeamId: string | null;
  canonicalTeamId: string | null;
  position: string | null;
}): FootballPlayerFeatureContractV1 {
  return {
    schemaVersion: "yang-edge-football-player-feature-contract-v1",
    providerPlayerId: input.providerPlayerId,
    canonicalPlayerId: null,
    providerTeamId: input.providerTeamId,
    canonicalTeamId: input.canonicalTeamId,
    position: input.position,
    seasonMinutes: null,
    starts: null,
    recentMinutes: null,
    availability: null,
    role: null,
    playerScore: null,
    impactScore: null,
    featureWeights: null,
    filled: false,
    predictionInput: false,
    engineInput: false,
  };
}

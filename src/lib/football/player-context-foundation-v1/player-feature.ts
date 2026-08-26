/**
 * Player-context research feature projection.
 * May populate research fields from P1 datasets. Never admitted to Engine.
 */
import type {
  FootballPlayerContextFeatureContractV1,
  FootballPlayerSeasonStatV1,
  FootballSquadPlayerV1,
} from "./types";

export function projectPlayerContextFeatures(input: {
  stats?: FootballPlayerSeasonStatV1 | null;
  squadMember?: FootballSquadPlayerV1 | null;
}): FootballPlayerContextFeatureContractV1 {
  const stats = input.stats ?? null;
  const squad = input.squadMember ?? null;
  const researchProjectionFilled = Boolean(stats || squad);

  return {
    schemaVersion: "yang-edge-football-player-context-feature-contract-v1",
    providerPlayerId: stats?.providerPlayerId ?? squad?.providerPlayerId ?? null,
    canonicalPlayerId: null,
    providerTeamId: stats?.providerTeamId ?? null,
    canonicalTeamId: stats?.canonicalTeamId ?? null,
    position: stats?.games.position ?? squad?.position ?? null,
    seasonMinutes: stats?.games.minutes ?? null,
    starts: stats?.games.starts ?? null,
    goals: stats?.goals.total ?? null,
    assists: stats?.goals.assists ?? null,
    rating: stats?.games.rating ?? null,
    squadMembership: squad ? true : null,
    availability: null,
    playerScore: null,
    impactScore: null,
    tacticalScore: null,
    featureWeights: null,
    researchProjectionFilled,
    researchOnly: true,
    predictionInput: false,
    engineInput: false,
    admittedToEngine: false,
  };
}

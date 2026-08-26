/**
 * Storage conventions for immutable football player/XI raw observations.
 *
 * LIVE PROVIDER
 *   → TIMESTAMPED IMMUTABLE RAW OBSERVATION
 *   → NORMALIZE / REPLAY
 *   → FOUNDATION DATASET
 *
 * Replay/normalize MUST NOT call the provider.
 * Do not overwrite an earlier observation for the same fixture.
 */
export const FOOTBALL_PLAYER_XI_RAW_ROOT =
  "data/research/football/raw/player-xi-v1" as const;

export function footballInjuriesObservationRel(input: {
  providerFixtureId: string;
  observedAt: string;
}): string {
  const stamp = input.observedAt.replace(/[:.]/g, "-");
  return `${FOOTBALL_PLAYER_XI_RAW_ROOT}/injuries/${input.providerFixtureId}/${stamp}-v1.json`;
}

export function footballLineupsObservationRel(input: {
  providerFixtureId: string;
  observedAt: string;
}): string {
  const stamp = input.observedAt.replace(/[:.]/g, "-");
  return `${FOOTBALL_PLAYER_XI_RAW_ROOT}/lineups/${input.providerFixtureId}/${stamp}-v1.json`;
}

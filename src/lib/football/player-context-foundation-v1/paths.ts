/**
 * Storage conventions for immutable football player-context raw observations.
 *
 * LIVE PROVIDER
 *   → TIMESTAMPED IMMUTABLE RAW OBSERVATION
 *   → NORMALIZE / REPLAY
 *   → RESEARCH DATASET
 *   → future Public projection (not this mission)
 *
 * Replay/normalize MUST NOT call the provider.
 * Tests must not write live files under this root.
 */
export const FOOTBALL_PLAYER_CONTEXT_RAW_ROOT =
  "data/research/football/raw/player-context-v1" as const;

function stampObservedAt(observedAt: string): string {
  return observedAt.replace(/[:.]/g, "-");
}

export function footballPlayersObservationRel(input: {
  providerTeamId: string;
  observedAt: string;
}): string {
  const stamp = stampObservedAt(input.observedAt);
  return `${FOOTBALL_PLAYER_CONTEXT_RAW_ROOT}/players/${input.providerTeamId}/${stamp}-v1.json`;
}

export function footballSquadsObservationRel(input: {
  providerTeamId: string;
  observedAt: string;
}): string {
  const stamp = stampObservedAt(input.observedAt);
  return `${FOOTBALL_PLAYER_CONTEXT_RAW_ROOT}/squads/${input.providerTeamId}/${stamp}-v1.json`;
}

export function footballCoachesObservationRel(input: {
  providerTeamId: string;
  observedAt: string;
}): string {
  const stamp = stampObservedAt(input.observedAt);
  return `${FOOTBALL_PLAYER_CONTEXT_RAW_ROOT}/coaches/${input.providerTeamId}/${stamp}-v1.json`;
}

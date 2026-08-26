/**
 * Temporal gate for football player/XI observations.
 * No Date.now() — callers supply observedAt and fixtureKickoff.
 */
import type { FootballObservationPhase } from "./types";

export function classifyFootballObservationPhase(input: {
  observedAt: string;
  fixtureKickoff: string;
}): {
  isBeforeKickoff: boolean;
  pregameEligible: boolean;
  observationPhase: FootballObservationPhase;
} {
  const observedMs = Date.parse(input.observedAt);
  const kickoffMs = Date.parse(input.fixtureKickoff);
  if (!Number.isFinite(observedMs) || !Number.isFinite(kickoffMs)) {
    throw new Error("FOOTBALL_OBSERVATION_TEMPORAL_INVALID");
  }
  const isBeforeKickoff = observedMs < kickoffMs;
  return {
    isBeforeKickoff,
    pregameEligible: isBeforeKickoff,
    observationPhase: isBeforeKickoff
      ? "PRE_GAME"
      : "POST_KICKOFF_INVALID_FOR_PREGAME",
  };
}

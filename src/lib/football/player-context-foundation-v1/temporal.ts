/**
 * Temporal gate for player-context observations.
 * No Date.now() — callers supply observedAt and optional fixtureKickoff.
 *
 * Post-kickoff captures must not be relabeled as target-game Pregame evidence.
 * Season stats collected after a match may include that match.
 */
import { classifyFootballObservationPhase } from "../pregame-player-xi-foundation-v1/temporal";
import type { FootballPlayerContextObservationPhase } from "./types";

export function classifyPlayerContextTemporal(input: {
  observedAt: string;
  fixtureKickoff?: string | null;
}): {
  isBeforeKickoff: boolean | null;
  pregameEligible: boolean;
  observationPhase: FootballPlayerContextObservationPhase;
} {
  const kickoff = input.fixtureKickoff;
  if (kickoff == null || String(kickoff).trim() === "") {
    const observedMs = Date.parse(input.observedAt);
    if (!Number.isFinite(observedMs)) {
      throw new Error("FOOTBALL_PLAYER_CONTEXT_OBSERVED_AT_INVALID");
    }
    return {
      isBeforeKickoff: null,
      pregameEligible: false,
      observationPhase: "RESEARCH_WITHOUT_TARGET_FIXTURE",
    };
  }

  const phase = classifyFootballObservationPhase({
    observedAt: input.observedAt,
    fixtureKickoff: kickoff,
  });
  return {
    isBeforeKickoff: phase.isBeforeKickoff,
    pregameEligible: phase.pregameEligible,
    observationPhase: phase.observationPhase,
  };
}

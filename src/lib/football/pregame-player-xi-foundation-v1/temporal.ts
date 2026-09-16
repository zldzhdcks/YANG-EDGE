/**
 * Temporal gate for football player/XI observations.
 * No Date.now() — callers supply observedAt, kickoff, and optional provider clocks.
 * Do not fabricate providerPublishedAt or providerFetchedAt.
 */
import type {
  FootballObservationPhase,
  FootballV4TemporalStatus,
} from "./types";

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

function parseOptionalClock(value: string | null | undefined): number | null | "invalid" {
  if (value == null || String(value).trim() === "") return null;
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) return "invalid";
  return ms;
}

/**
 * V4 Phase 0 provenance classifier.
 * Pure. Does not call Date.now(). Does not infer missing provider clocks.
 */
export function classifyFootballV4TemporalProvenance(input: {
  observedAt: string;
  kickoffUtc: string;
  providerFetchedAt?: string | null;
  providerPublishedAt?: string | null;
}): {
  temporalStatus: FootballV4TemporalStatus;
  pregameEligible: boolean;
  strictReplayEligible: boolean;
  isBeforeKickoff: boolean;
  observationPhase: FootballObservationPhase;
} {
  const phase = classifyFootballObservationPhase({
    observedAt: input.observedAt,
    fixtureKickoff: input.kickoffUtc,
  });
  const observedMs = Date.parse(input.observedAt);
  const kickoffMs = Date.parse(input.kickoffUtc);
  const fetched = parseOptionalClock(input.providerFetchedAt);
  const published = parseOptionalClock(input.providerPublishedAt);

  if (!phase.isBeforeKickoff) {
    return {
      temporalStatus: "POST_KICKOFF_OBSERVATION",
      pregameEligible: false,
      strictReplayEligible: false,
      isBeforeKickoff: false,
      observationPhase: phase.observationPhase,
    };
  }

  if (fetched === "invalid" || published === "invalid") {
    return {
      temporalStatus: "TEMPORAL_EVIDENCE_MISSING",
      pregameEligible: true,
      strictReplayEligible: false,
      isBeforeKickoff: true,
      observationPhase: phase.observationPhase,
    };
  }

  const allClocksPresent = fetched != null && published != null;
  const allBeforeKickoff =
    allClocksPresent &&
    observedMs < kickoffMs &&
    fetched < kickoffMs &&
    published < kickoffMs;

  if (allBeforeKickoff) {
    return {
      temporalStatus: "TEMPORAL_VERIFIED",
      pregameEligible: true,
      strictReplayEligible: true,
      isBeforeKickoff: true,
      observationPhase: phase.observationPhase,
    };
  }

  return {
    temporalStatus: "TEMPORAL_PARTIAL",
    pregameEligible: true,
    strictReplayEligible: false,
    isBeforeKickoff: true,
    observationPhase: phase.observationPhase,
  };
}

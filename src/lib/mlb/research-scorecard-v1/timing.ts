import type { ObservationTiming } from "./types";

function asMs(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : null;
}

/**
 * Classify operator observation vs Prediction freeze and first pitch.
 * LATE wins if the observation is at/after first pitch.
 */
export function classifyObservationTiming(input: {
  predictionGeneratedAt: string | null;
  observedAt: string | null;
  firstPitchAt: string | null;
}): ObservationTiming {
  const observed = asMs(input.observedAt);
  const freeze = asMs(input.predictionGeneratedAt);
  const firstPitch = asMs(input.firstPitchAt);
  if (observed == null) return "UNKNOWN";
  if (firstPitch != null && observed >= firstPitch) return "LATE";
  if (freeze == null) return "UNKNOWN";
  if (observed < freeze) return "BEFORE_PREDICTION";
  if (firstPitch == null) return "UNKNOWN";
  if (observed >= freeze && observed < firstPitch) {
    return "AFTER_PREDICTION_BUT_BEFORE_GAME";
  }
  return "UNKNOWN";
}

export function isPostPredictionPregame(
  timing: ObservationTiming | null,
): boolean {
  return timing === "AFTER_PREDICTION_BUT_BEFORE_GAME";
}

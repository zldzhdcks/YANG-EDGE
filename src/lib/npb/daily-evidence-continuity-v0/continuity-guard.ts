import { asFiniteMs } from "@/lib/npb/manual-starter-intake-v0/join-schedule";
import {
  NPB_PREGAME_EVIDENCE_MISSING,
  type NpbContinuityGuardV0,
} from "./types";

/** Alert window: within this many ms before earliest first pitch. */
export const NPB_EVIDENCE_APPROACH_WINDOW_MS = 2 * 60 * 60 * 1000;

export function earliestFirstPitch(
  pitches: Array<string | null | undefined>,
): string | null {
  let best: string | null = null;
  let bestMs = Number.POSITIVE_INFINITY;
  for (const p of pitches) {
    const ms = asFiniteMs(p ?? null);
    if (ms == null) continue;
    if (ms < bestMs) {
      bestMs = ms;
      best = p!;
    }
  }
  return best;
}

export function isPastOrApproachingFirstPitch(input: {
  earliestFirstPitchAt: string | null;
  asOf: string;
  approachWindowMs?: number;
}): boolean {
  const pitchMs = asFiniteMs(input.earliestFirstPitchAt);
  const asOfMs = asFiniteMs(input.asOf);
  if (pitchMs == null || asOfMs == null) return false;
  const window = input.approachWindowMs ?? NPB_EVIDENCE_APPROACH_WINDOW_MS;
  return asOfMs >= pitchMs - window;
}

/**
 * Continuity guard: schedule present + no pregame snapshot near/after first pitch
 * → NPB_PREGAME_EVIDENCE_MISSING (ops failure signal).
 */
export function assessNpbPregameEvidenceContinuity(input: {
  scheduleExists: boolean;
  gameCount: number;
  snapshotExists: boolean;
  earliestFirstPitchAt: string | null;
  asOf: string;
}): NpbContinuityGuardV0 {
  const pastOrApproachingFirstPitch = isPastOrApproachingFirstPitch({
    earliestFirstPitchAt: input.earliestFirstPitchAt,
    asOf: input.asOf,
  });

  const scheduleExists = input.scheduleExists && input.gameCount > 0;
  let alert: typeof NPB_PREGAME_EVIDENCE_MISSING | null = null;
  let plainLanguage =
    "Pregame Evidence continuity OK or not yet required.";

  if (scheduleExists && !input.snapshotExists && pastOrApproachingFirstPitch) {
    alert = NPB_PREGAME_EVIDENCE_MISSING;
    plainLanguage =
      "NPB schedule exists but Pregame Evidence Snapshot is missing as first pitch approaches/passed. Freeze is blocked after start — collect before pitch.";
  } else if (scheduleExists && !input.snapshotExists) {
    plainLanguage =
      "Schedule present · Snapshot not frozen yet · freeze before first pitch.";
  } else if (input.snapshotExists) {
    plainLanguage = "Pregame Evidence Snapshot present.";
  } else {
    plainLanguage = "No NPB schedule for this date yet.";
  }

  return {
    alert,
    scheduleExists,
    snapshotExists: input.snapshotExists,
    earliestFirstPitchAt: input.earliestFirstPitchAt,
    pastOrApproachingFirstPitch,
    plainLanguage,
  };
}

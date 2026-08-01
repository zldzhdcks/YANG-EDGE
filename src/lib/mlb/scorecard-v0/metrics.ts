/** Probability metrics for scorecard v0. */

export function clampProb(p: number, eps = 1e-12): number {
  return Math.min(1 - eps, Math.max(eps, p));
}

/** Brier on HOME win indicator. */
export function brierHome(modelHomeP: number, actualHomeWin: 0 | 1): number {
  return (modelHomeP - actualHomeWin) ** 2;
}

/** Log loss with epsilon guard. */
export function logLossHomeAway(
  homeP: number,
  awayP: number,
  winner: "HOME" | "AWAY",
): number {
  const p = winner === "HOME" ? clampProb(homeP) : clampProb(awayP);
  return -Math.log(p);
}

export function mean(nums: number[]): number | null {
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

export function accuracySummary(
  correct: number,
  incorrect: number,
  opts?: {
    emptyStatus?: "NO_SAMPLE" | "N/A" | "INSUFFICIENT_SAMPLE";
    minForOk?: number;
  },
): {
  correct: number;
  incorrect: number;
  sampleCount: number;
  accuracy: number | null;
  status: "OK" | "NO_SAMPLE" | "N/A" | "INSUFFICIENT_SAMPLE";
} {
  const sampleCount = correct + incorrect;
  const emptyStatus = opts?.emptyStatus ?? "NO_SAMPLE";
  if (sampleCount === 0) {
    return {
      correct: 0,
      incorrect: 0,
      sampleCount: 0,
      accuracy: null,
      status: emptyStatus,
    };
  }
  const minForOk = opts?.minForOk ?? 0;
  return {
    correct,
    incorrect,
    sampleCount,
    accuracy: correct / sampleCount,
    status: sampleCount < minForOk ? "INSUFFICIENT_SAMPLE" : "OK",
  };
}

/** Calibration on selected-side probability. */
export const CALIBRATION_BUCKETS = [
  { id: "0.500-0.525", lo: 0.5, hi: 0.525 },
  { id: "0.525-0.550", lo: 0.525, hi: 0.55 },
  { id: "0.550-0.575", lo: 0.55, hi: 0.575 },
  { id: "0.575-0.600", lo: 0.575, hi: 0.6 },
  { id: "0.600-0.650", lo: 0.6, hi: 0.65 },
] as const;

export const CONFIDENCE_BUCKETS = [
  { id: "0-39", lo: 0, hi: 39 },
  { id: "40-49", lo: 40, hi: 49 },
  { id: "50-59", lo: 50, hi: 59 },
  { id: "60-69", lo: 60, hi: 69 },
  { id: "70-79", lo: 70, hi: 79 },
  { id: "80-100", lo: 80, hi: 100 },
] as const;

export function assignCalibrationBucket(selectedP: number): string | null {
  for (const b of CALIBRATION_BUCKETS) {
    if (selectedP >= b.lo && selectedP < b.hi) return b.id;
  }
  const last = CALIBRATION_BUCKETS[CALIBRATION_BUCKETS.length - 1]!;
  if (selectedP >= last.lo && selectedP <= last.hi) return last.id;
  return null;
}

export function validateProbabilityPair(
  homeP: number,
  awayP: number,
  sumTol: number,
): string | null {
  if (!Number.isFinite(homeP) || !Number.isFinite(awayP)) {
    return "PROBABILITY_NOT_FINITE";
  }
  if (!(homeP > 0 && homeP < 1 && awayP > 0 && awayP < 1)) {
    return "PROBABILITY_OUT_OF_OPEN_UNIT_INTERVAL";
  }
  if (Math.abs(homeP + awayP - 1) > sumTol) {
    return "PROBABILITY_SUM_NOT_ONE";
  }
  return null;
}

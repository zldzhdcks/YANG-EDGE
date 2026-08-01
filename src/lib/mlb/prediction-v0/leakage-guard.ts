/**
 * Leakage guards — block if post-start / result-tainted inputs detected.
 */
export type LeakageCheckInput = {
  commenceTimeUtc: string | null;
  predictedAt: string;
  oddsCapturedAt: string | null;
  lineupCapturedAt: string | null;
  starterStatsAsOf: string | null;
  starterTargetGameIncluded: boolean;
  starterCutoffViolations: number;
  closingOddsPostStart: boolean;
  liveLineupAfterStart: boolean;
};

export function evaluateLeakage(input: LeakageCheckInput): {
  blocked: boolean;
  reasons: string[];
} {
  const reasons: string[] = [];
  const commenceMs = input.commenceTimeUtc
    ? Date.parse(input.commenceTimeUtc)
    : Number.NaN;
  const predictedMs = Date.parse(input.predictedAt);

  if (
    Number.isFinite(commenceMs) &&
    Number.isFinite(predictedMs) &&
    predictedMs >= commenceMs
  ) {
    reasons.push("PREDICTION_AFTER_COMMENCE");
  }

  if (input.starterTargetGameIncluded) {
    reasons.push("STARTER_TARGET_GAME_IN_STATS");
  }
  if (input.starterCutoffViolations > 0) {
    reasons.push("STARTER_CUTOFF_VIOLATION");
  }
  // Result / final-score artifacts may exist on disk but must not be loaded into
  // features. Presence alone is NOT a leakage block — using them would be.
  if (input.closingOddsPostStart) {
    reasons.push("CLOSING_ODDS_POST_START");
  }
  if (input.liveLineupAfterStart) {
    reasons.push("LIVE_LINEUP_AFTER_START");
  }

  if (
    Number.isFinite(commenceMs) &&
    input.oddsCapturedAt &&
    Number.isFinite(Date.parse(input.oddsCapturedAt)) &&
    Date.parse(input.oddsCapturedAt) >= commenceMs
  ) {
    reasons.push("ODDS_CAPTURED_AFTER_COMMENCE");
  }

  if (
    Number.isFinite(commenceMs) &&
    input.lineupCapturedAt &&
    Number.isFinite(Date.parse(input.lineupCapturedAt)) &&
    Date.parse(input.lineupCapturedAt) >= commenceMs
  ) {
    reasons.push("LINEUP_CAPTURED_AFTER_COMMENCE");
  }

  return { blocked: reasons.length > 0, reasons };
}

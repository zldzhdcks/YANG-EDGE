/**
 * Pregame time windows — Scheduler config only (not Engine thresholds).
 */

export type WindowDef = {
  fromMinutes: number;
  toMinutes: number;
};

/** Minutes until scheduled start: from (inclusive) → to (exclusive), except LOCK toMinutes 0 inclusive as LOCK window end. */
export const DEFAULT_WINDOWS = {
  T90: { fromMinutes: 105, toMinutes: 75 },
  T60: { fromMinutes: 75, toMinutes: 50 },
  T45: { fromMinutes: 50, toMinutes: 35 },
  T30: { fromMinutes: 35, toMinutes: 15 },
  LOCK: { fromMinutes: 15, toMinutes: 0 },
} as const satisfies Record<string, WindowDef>;

export const DEFAULT_MAX_ATTEMPTS = {
  T90: 1,
  T60: 1,
  T45: 1,
  T30: 1,
  LOCK: 1,
} as const;

/** Lock TTL defaults (ms). */
export const DEFAULT_LOCK_TTL_MS = {
  SCHEDULE_DISCOVERY: 10 * 60_000,
  T90_COLLECTION: 10 * 60_000,
  T60_REFRESH: 10 * 60_000,
  T45_LINEUP_CHECK: 10 * 60_000,
  T30_FINAL_CHECK: 15 * 60_000,
  PREGAME_LOCK: 10 * 60_000,
  WAITING_FOR_FINAL: 5 * 60_000,
  POSTGAME_COLLECTION: 15 * 60_000,
  POSTGAME_REVIEW: 20 * 60_000,
  COMPLETE: 5 * 60_000,
} as const;

export const QUOTA_WARN_REMAINING = 20;
export const QUOTA_BLOCK_REMAINING = 10;

export type MlbOpsFreshnessWindow = keyof typeof DEFAULT_WINDOWS;

/**
 * Operations freshness only — NOT an Engine / prediction / weight threshold.
 * Window W is entered at scheduledStart − DEFAULT_WINDOWS[W].fromMinutes.
 * An observation produced before that instant is not a fresh observation for W.
 */
export function mlbOpsWindowEnteredAtMs(
  scheduledStartIso: string,
  window: MlbOpsFreshnessWindow,
): number | null {
  const startMs = Date.parse(scheduledStartIso);
  if (!Number.isFinite(startMs)) return null;
  return startMs - DEFAULT_WINDOWS[window].fromMinutes * 60_000;
}

/**
 * True iff observedAt is at or after the named window opened for this start.
 * Missing timestamps are not fresh (cannot prove ARTIFACT_FRESH).
 */
export function isMlbOpsWindowFresh(input: {
  observedAtMs: number | null;
  scheduledStartIso: string | null;
  window: MlbOpsFreshnessWindow;
}): boolean {
  if (input.observedAtMs == null || input.scheduledStartIso == null) {
    return false;
  }
  const entered = mlbOpsWindowEnteredAtMs(
    input.scheduledStartIso,
    input.window,
  );
  if (entered == null) return false;
  return input.observedAtMs >= entered;
}

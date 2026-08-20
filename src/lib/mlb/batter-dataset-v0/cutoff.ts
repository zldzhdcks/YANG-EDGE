/**
 * Pregame as-of policy for batter-dataset-v0.
 * SAME_DAY_GAME_RESULT_EXCLUDED: never mix same official/KST date results
 * into another game on that slate, including doubleheaders.
 */
import type { GameLogSplit } from "../build-pitcher-stat-candidate";

export function previousIsoDate(isoDate: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate.trim());
  if (!m) {
    throw new Error(`previousIsoDate: invalid date ${isoDate}`);
  }
  const utc = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return new Date(utc - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function minIsoDate(a: string, b: string): string {
  return a <= b ? a : b;
}

/**
 * Inclusive last calendar date allowed in pregame hitting logs.
 * Uses the earlier of slate KST date and the game's MLB officialDate,
 * then subtracts one day so same-day (incl. DH) results cannot leak.
 */
export function statsThroughDateForGame(input: {
  dateKst: string;
  officialDate: string | null;
}): string {
  const official = input.officialDate ?? input.dateKst;
  return previousIsoDate(minIsoDate(input.dateKst, official));
}

export function filterHittingGameLogAsOf(input: {
  splits: GameLogSplit[];
  targetGamePk: number;
  statsThroughDate: string;
}): {
  kept: GameLogSplit[];
  excludedTarget: number;
  excludedSameDayOrLater: number;
  excludedUndated: number;
} {
  let excludedTarget = 0;
  let excludedSameDayOrLater = 0;
  let excludedUndated = 0;
  const kept: GameLogSplit[] = [];
  for (const split of input.splits) {
    const pk = split.game?.gamePk;
    if (typeof pk === "number" && pk === input.targetGamePk) {
      excludedTarget += 1;
      continue;
    }
    const date = typeof split.date === "string" ? split.date.trim() : "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      excludedUndated += 1;
      continue;
    }
    if (date > input.statsThroughDate) {
      excludedSameDayOrLater += 1;
      continue;
    }
    kept.push(split);
  }
  return { kept, excludedTarget, excludedSameDayOrLater, excludedUndated };
}

export function latestIncludedGameDate(splits: GameLogSplit[]): string | null {
  let max: string | null = null;
  for (const split of splits) {
    const date = typeof split.date === "string" ? split.date.trim() : "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    if (max == null || date > max) max = date;
  }
  return max;
}

export function slateFullyPregame(
  commenceTimesUtc: string[],
  nowMs: number,
): boolean {
  if (commenceTimesUtc.length === 0) return false;
  return commenceTimesUtc.every((iso) => {
    const t = Date.parse(iso);
    return Number.isFinite(t) && t > nowMs;
  });
}

/**
 * Live hitting fetch gate v0.
 *
 * POLICY A — FULL_SLATE_BEFORE_FIRST_PITCH_ONLY:
 * network Stats API is allowed only while every slate game is still
 * in the future. After the first pitch, the whole slate is CLOSED.
 *
 * POLICY B (PER_GAME_CUTOFF) is intentionally not implemented in v0.
 * Mid-slate fetches after some games have started would mix a live
 * season aggregate window with completed same-day results unless every
 * caller re-implements the same as-of filter. v0 keeps one gate.
 */
export const BATTER_FETCH_GATE_POLICY =
  "FULL_SLATE_BEFORE_FIRST_PITCH_ONLY" as const;

export type BatterFetchGateWindow = "OPEN" | "CLOSED";

export type BatterFetchGate = {
  policy: typeof BATTER_FETCH_GATE_POLICY;
  window: BatterFetchGateWindow;
  firstCommenceUtc: string | null;
  commencedCount: number;
  remainingCount: number;
  slateFullyPregame: boolean;
};

export function evaluateFullSlateFetchGate(
  commenceTimesUtc: string[],
  nowMs: number,
): BatterFetchGate {
  const times = commenceTimesUtc
    .map((iso) => ({ iso, t: Date.parse(iso) }))
    .filter((row) => Number.isFinite(row.t))
    .sort((a, b) => a.t - b.t || a.iso.localeCompare(b.iso));
  const firstCommenceUtc = times[0]?.iso ?? null;
  const commencedCount = times.filter((row) => row.t <= nowMs).length;
  const remainingCount = times.filter((row) => row.t > nowMs).length;
  const fully = slateFullyPregame(commenceTimesUtc, nowMs);
  return {
    policy: BATTER_FETCH_GATE_POLICY,
    window: fully ? "OPEN" : "CLOSED",
    firstCommenceUtc,
    commencedCount,
    remainingCount,
    slateFullyPregame: fully,
  };
}

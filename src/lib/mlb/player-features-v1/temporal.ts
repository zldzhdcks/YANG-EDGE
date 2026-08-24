/**
 * Conservative D-1 statistical cutoff for player features v1.
 *
 * Game officialDate = 2026-08-25 → statsWindowEndDate = 2026-08-24.
 * Same-day (incl. DH game 1) results never enter features.
 */
import type { GameLogSplit } from "../build-pitcher-stat-candidate";
import {
  filterHittingGameLogAsOf,
  previousIsoDate,
  statsThroughDateForGame,
} from "../batter-dataset-v0/cutoff";

export { previousIsoDate, statsThroughDateForGame };

export function shiftIsoDate(isoDate: string, deltaDays: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate.trim());
  if (!m) {
    throw new Error(`shiftIsoDate: invalid date ${isoDate}`);
  }
  const utc = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return new Date(utc + deltaDays * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}

/** Inclusive LAST_N_DAYS window ending on statsThroughDate (D-1). */
export function recentWindowStartDate(
  statsThroughDate: string,
  inclusiveDays: number,
): string {
  if (inclusiveDays < 1) {
    throw new Error(`recentWindowStartDate: inclusiveDays must be >= 1`);
  }
  return shiftIsoDate(statsThroughDate, -(inclusiveDays - 1));
}

export function filterGameLogAsOf(input: {
  splits: GameLogSplit[];
  targetGamePk: number;
  statsThroughDate: string;
}): {
  kept: GameLogSplit[];
  excludedTarget: number;
  excludedSameDayOrLater: number;
  excludedUndated: number;
} {
  return filterHittingGameLogAsOf(input);
}

export function filterSplitsByInclusiveWindow(
  splits: GameLogSplit[],
  windowStartDate: string,
  windowEndDate: string,
): GameLogSplit[] {
  return splits.filter((split) => {
    const date = typeof split.date === "string" ? split.date.trim() : "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
    return date >= windowStartDate && date <= windowEndDate;
  });
}

export function assertNoOfficialDateLeak(input: {
  splits: GameLogSplit[];
  officialDate: string | null;
  statsThroughDate: string;
}): void {
  for (const split of input.splits) {
    const date = typeof split.date === "string" ? split.date.trim() : "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    if (date > input.statsThroughDate) {
      throw new Error(
        `TEMPORAL_LEAK: split date ${date} > statsThroughDate ${input.statsThroughDate}`,
      );
    }
    if (input.officialDate && date >= input.officialDate) {
      throw new Error(
        `TEMPORAL_LEAK: split date ${date} is on/after officialDate ${input.officialDate}`,
      );
    }
  }
}

export function isPostCutoff(commenceTimeUtc: string, nowMs: number): boolean {
  const t = Date.parse(commenceTimeUtc);
  return Number.isFinite(t) && t <= nowMs;
}

export function preGameSafeAllowed(input: {
  cutoffStatus: "BEFORE_CUTOFF" | "POST_CUTOFF";
  collectionPhase: "PRE_GAME" | "POST_GAME_OR_LATE" | "UNKNOWN" | null;
  provenanceClass: string;
  statsWindowEndDate: string;
  officialDate: string | null;
}): boolean {
  if (input.cutoffStatus !== "BEFORE_CUTOFF") return false;
  if (input.collectionPhase !== "PRE_GAME") return false;
  if (input.provenanceClass !== "TRUE_LIVE_PREGAME_CAPTURE") return false;
  if (input.officialDate && input.statsWindowEndDate >= input.officialDate) {
    return false;
  }
  return true;
}

import { roundProb } from "./calculate-implied-probabilities";
import type { OutcomeProbabilityMap } from "./types";

/**
 * 북메이커 마진(overround) 제거 — multiplicative normalization.
 *
 * normalized_i = raw_i / Σ raw
 * overround = Σ raw − 1
 *
 * 합계가 0·비유한수이면 정규화하지 않는다.
 */
export type MarginRemovalResult = {
  normalized: OutcomeProbabilityMap;
  overround: number | null;
  /** 정규화에 사용된 raw 합 */
  rawSum: number | null;
};

export function removeBookmakerMargin(raw: {
  home: number | null;
  away: number | null;
  draw: number | null;
}): MarginRemovalResult {
  const parts: Array<{ key: "home" | "away" | "draw"; value: number }> = [];
  if (raw.home != null && Number.isFinite(raw.home) && raw.home > 0) {
    parts.push({ key: "home", value: raw.home });
  }
  if (raw.away != null && Number.isFinite(raw.away) && raw.away > 0) {
    parts.push({ key: "away", value: raw.away });
  }
  if (raw.draw != null && Number.isFinite(raw.draw) && raw.draw > 0) {
    parts.push({ key: "draw", value: raw.draw });
  }

  if (parts.length === 0) {
    return {
      normalized: { home: null, away: null, draw: null },
      overround: null,
      rawSum: null,
    };
  }

  const rawSum = roundProb(parts.reduce((a, p) => a + p.value, 0));
  if (!Number.isFinite(rawSum) || rawSum <= 0) {
    return {
      normalized: { home: null, away: null, draw: null },
      overround: null,
      rawSum: null,
    };
  }

  const normalized: OutcomeProbabilityMap = {
    home: null,
    away: null,
    draw: null,
  };

  for (const { key, value } of parts) {
    normalized[key] = roundProb(value / rawSum);
  }

  return {
    normalized,
    overround: roundProb(rawSum - 1),
    rawSum,
  };
}

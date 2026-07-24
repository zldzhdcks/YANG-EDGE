import type { EdgeFactorKey } from "./types";

/**
 * YANG EDGE Engine v0 — 야구 기준 가중치
 *
 * 각 값은 "상대적 중요도"이며 총합은 100이다.
 * 종합 정규화 점수 = Σ (factorScore_i × weight_i) / WEIGHT_TOTAL
 * EDGE Score = clamp(종합 정규화 점수 × 30, -30, +30)
 */
export const BASEBALL_EDGE_WEIGHTS: Record<EdgeFactorKey, number> = {
  startingPitcher: 20,
  recentForm: 15,
  scoring: 12,
  defense: 12,
  homeAway: 10,
  leagueStanding: 8,
  headToHead: 7,
  rest: 6,
  injuries: 5,
  streak: 5,
};

export const WEIGHT_TOTAL = Object.values(BASEBALL_EDGE_WEIGHTS).reduce(
  (sum, w) => sum + w,
  0,
);

/** EDGE Score 스케일: 정규화(-1~+1) × EDGE_SCORE_SCALE → (-30~+30) */
export const EDGE_SCORE_SCALE = 30;

export const EDGE_SCORE_MIN = -30;
export const EDGE_SCORE_MAX = 30;

export const WIN_PROB_MIN = 20;
export const WIN_PROB_MAX = 80;

export const CONFIDENCE_MIN = 0;
export const CONFIDENCE_MAX = 100;

export const FACTOR_KEYS = Object.keys(
  BASEBALL_EDGE_WEIGHTS,
) as EdgeFactorKey[];

if (WEIGHT_TOTAL !== 100) {
  // 개발 중 가중치 합 실수 방지 (런타임 가드)
  throw new Error(
    `BASEBALL_EDGE_WEIGHTS must sum to 100 (got ${WEIGHT_TOTAL})`,
  );
}

/**
 * YANG EDGE — 시장 확률 / Value Edge 비교 계층
 *
 * Odds → 마진 제거 전·후 확률 → (가능하면) 모델 확률과 차이.
 * EDGE Engine 가중치·추천 결과는 이 계층에서 변경하지 않는다.
 */

export type MarketType = "two-way" | "three-way";

export type MarketDataQuality =
  | "complete"
  /** 배당 일부가 없거나 유효하지 않음 */
  | "incomplete-odds"
  /** 시장은 준비됐으나 모델이 해당 시장과 비교 불가 (예: 축구 3-way vs 2-way 승률만) */
  | "model-not-compatible"
  | "no-odds";

/** 0~1 확률 맵. 없는 결과는 null (억지로 채우지 않음). */
export type OutcomeProbabilityMap = {
  home: number | null;
  away: number | null;
  draw: number | null;
};

export type DecimalOddsInput = {
  homeOdds: number | null | undefined;
  awayOdds: number | null | undefined;
  /** 3-way 만. 2-way 에서는 무시 */
  drawOdds?: number | null | undefined;
};

/**
 * 모델 측 입력.
 *
 * 현재 EDGE Engine 은 추천 팀(home|away) 승리 확률만 제공한다.
 * - winProbability: 보통 0~100 (엔진 출력). 0~1 도 허용(자동 판별).
 * - 무승부 확률은 없음 → 3-way 와 직접 비교하지 않는다.
 */
export type ModelProbabilityInput = {
  pickTeamId: "home" | "away";
  /**
   * 추천 팀 승리 확률.
   * Engine: 0~100. 이미 비율이면 0~1.
   */
  winProbability: number;
  /**
   * 모델이 제공하는 시장 형태.
   * 기본 "two-way" (승/패만). 축구 3-way 분포가 생기면 "three-way" 로 확장.
   */
  marketSupport?: MarketType;
};

export type MarketComparison = {
  marketType: MarketType;
  /** 마진 제거 전: 1/odds (합계는 보통 > 1) */
  rawProbabilities: OutcomeProbabilityMap;
  /** 마진 제거 후: raw / Σraw (합계 ≈ 1) */
  normalizedProbabilities: OutcomeProbabilityMap;
  /**
   * overround = Σ raw − 1.
   * 예: 0.05 → 시장에 약 5% 북메이커 마진.
   */
  overround: number | null;
  /**
   * 추천 팀 기준 모델 승리 확률 (0~1).
   * 비교 불가면 null.
   */
  modelProbability: number | null;
  /**
   * 추천 팀 기준 정규화 시장 확률 (0~1).
   * 비교 불가면 null.
   */
  marketProbability: number | null;
  /**
   * (model − market) × 100.
   * 양수 = 모델이 시장보다 해당 팀에 더 높은 확률.
   */
  valueEdgePercentagePoints: number | null;
  hasPositiveValue: boolean;
  dataQuality: MarketDataQuality;
  /** raw/정규화·Value Edge 까지 비교 가능한지 */
  comparable: boolean;
  /** 사람이 읽기 쉬운 상태 메시지 */
  statusMessage: string;
};

import { isFinitePositive, roundProb } from "./calculate-implied-probabilities";

/**
 * Value Edge (percentage points) =
 *   modelProbability − normalizedMarketProbability  (둘 다 0~1일 때 × 100)
 *
 * 양수 → 모델이 시장 대비 해당 결과에 더 높은 확률.
 */

/** Engine(0~100) 또는 비율(0~1) → 0~1 */
export function toUnitIntervalProbability(value: number): number | null {
  if (!Number.isFinite(value)) return null;
  // 명확히 비율로 보이는 경우
  if (value >= 0 && value <= 1) return roundProb(value);
  // Engine winProbability 스케일 (0~100)
  if (value > 1 && value <= 100) return roundProb(value / 100);
  return null;
}

export function calculateValueEdgePercentagePoints(
  modelProbabilityUnit: number | null,
  marketProbabilityUnit: number | null,
): number | null {
  if (
    modelProbabilityUnit == null ||
    marketProbabilityUnit == null ||
    !Number.isFinite(modelProbabilityUnit) ||
    !Number.isFinite(marketProbabilityUnit)
  ) {
    return null;
  }
  if (modelProbabilityUnit < 0 || modelProbabilityUnit > 1) return null;
  if (marketProbabilityUnit < 0 || marketProbabilityUnit > 1) return null;

  const pp = (modelProbabilityUnit - marketProbabilityUnit) * 100;
  if (!Number.isFinite(pp)) return null;
  return roundProb(pp);
}

export function hasPositiveValueEdge(
  valueEdgePercentagePoints: number | null,
): boolean {
  return (
    valueEdgePercentagePoints != null &&
    Number.isFinite(valueEdgePercentagePoints) &&
    valueEdgePercentagePoints > 0
  );
}

/** 방어용 — 유효한 단위 확률인지 */
export function isValidUnitProbability(n: number | null): n is number {
  return n != null && isFinitePositive(n) && n <= 1;
}

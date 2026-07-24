import type { EdgeFactorInsight, EdgeFactorScores, FactorAvailability } from "./types";
import {
  BASEBALL_EDGE_WEIGHTS,
  CONFIDENCE_MAX,
  CONFIDENCE_MIN,
  FACTOR_KEYS,
} from "./weights";
import { clamp, round4, safeNumber } from "./calculate-edge";

export type ConfidenceInput = {
  factorScores: EdgeFactorScores;
  availability: FactorAvailability;
  edgeScore: number;
  riskCount: number;
};

/**
 * Confidence (0–100) — EDGE Score와 별개.
 */
export function calculateConfidence(input: ConfidenceInput): number {
  const { factorScores, availability, edgeScore, riskCount } = input;

  const availableKeys = FACTOR_KEYS.filter((k) => availability[k]);
  const availableCount = availableKeys.length;
  const totalFactors = FACTOR_KEYS.length;

  const coverageScore =
    totalFactors === 0 ? 0 : (availableCount / totalFactors) * 35;

  const direction = Math.sign(safeNumber(edgeScore, 0));
  let agreeWeight = 0;
  let totalAvailWeight = 0;

  for (const key of availableKeys) {
    const w = BASEBALL_EDGE_WEIGHTS[key];
    totalAvailWeight += w;
    const s = safeNumber(factorScores[key], 0);
    if (direction === 0) {
      if (Math.abs(s) < 0.05) agreeWeight += w;
    } else if (Math.sign(s) === direction || Math.abs(s) < 0.05) {
      agreeWeight += w;
    }
  }

  const agreementScore =
    totalAvailWeight === 0 ? 0 : (agreeWeight / totalAvailWeight) * 35;

  const separationScore = (Math.abs(safeNumber(edgeScore, 0)) / 30) * 20;
  const riskPenalty = Math.min(25, safeNumber(riskCount, 0) * 6);

  const raw =
    coverageScore + agreementScore + separationScore - riskPenalty;

  return round4(clamp(raw, CONFIDENCE_MIN, CONFIDENCE_MAX));
}

/**
 * Explainability (0–100)
 *
 * 규칙 기반 엔진은 factor·가중치·근거가 투명해 기본 점수가 높다.
 * 향후 black-box ML은 동일 필드를 쓰되 engineBase를 낮게 둘 수 있다.
 */
export function calculateExplainability(input: {
  availability: FactorAvailability;
  factors: EdgeFactorInsight[];
  topFactors: EdgeFactorInsight[];
  riskCount: number;
  /** rule-v1: 75, opaque ML: 40 등 */
  engineBase?: number;
}): number {
  const {
    availability,
    factors,
    topFactors,
    riskCount,
    engineBase = 75,
  } = input;

  const availableCount = FACTOR_KEYS.filter((k) => availability[k]).length;
  const coverage =
    FACTOR_KEYS.length === 0
      ? 0
      : (availableCount / FACTOR_KEYS.length) * 15;

  const topReady =
    topFactors.length >= 4 ? 10 : topFactors.length * 2.5;

  const highImpactExplained = factors.filter(
    (f) => f.available && (f.impact === "HIGH" || f.impact === "MEDIUM"),
  ).length;
  const clarityBonus = Math.min(5, highImpactExplained);

  const missingPenalty = (FACTOR_KEYS.length - availableCount) * 2;
  const riskPenalty = Math.min(10, safeNumber(riskCount, 0) * 2);

  const raw =
    engineBase +
    coverage +
    topReady +
    clarityBonus -
    missingPenalty -
    riskPenalty;

  return round4(clamp(raw, 0, 100));
}

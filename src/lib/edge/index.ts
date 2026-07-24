import type { AnalysisData } from "@/types/engine-analysis";
import type { EdgeEngineResult } from "./types";
import {
  calculateEdgeScore,
  computeFactorScores,
  edgeScoreToWinProbability,
  gradeFromEdgeScore,
  pickFromEdgeScore,
  safeNumber,
} from "./calculate-edge";
import {
  calculateConfidence,
  calculateExplainability,
} from "./calculate-confidence";
import {
  buildFactorInsights,
  selectTopFactors,
} from "./build-factors";
import {
  generateEdgeReasons,
  generateEdgeRisks,
} from "./generate-edge-reasons";

/**
 * YANG EDGE Engine v1 (rule-v1)
 *
 * AnalysisData → EdgeEngineResult
 * - 결정적(deterministic), random/ML 없음
 * - 향후 ML 엔진도 동일 EdgeEngineResult 스키마 사용
 */
export function runEdgeEngine(data: AnalysisData): EdgeEngineResult {
  const { scores, availability } = computeFactorScores(data);
  const edgeScore = calculateEdgeScore(scores);
  const { pickTeamId, pickTeamName } = pickFromEdgeScore(
    edgeScore,
    data.homeTeam,
    data.awayTeam,
  );
  const { grade, label } = gradeFromEdgeScore(edgeScore);

  const factors = buildFactorInsights(scores, availability, pickTeamId);
  const topFactors = selectTopFactors(factors, 4);
  const risks = generateEdgeRisks(data, availability);
  const reasons = generateEdgeReasons(data, factors);

  const confidence = calculateConfidence({
    factorScores: scores,
    availability,
    edgeScore,
    riskCount: risks.length,
  });

  const explainability = calculateExplainability({
    availability,
    factors,
    topFactors,
    riskCount: risks.length,
    engineBase: 75, // rule-v1: 높은 설명 가능성
  });

  const winProbability = edgeScoreToWinProbability(edgeScore);

  return {
    version: "v1",
    engineId: "rule-v1",
    pickTeamId,
    pickTeamName,
    winProbability: safeNumber(winProbability, 50),
    edgeScore: safeNumber(edgeScore, 0),
    confidence: safeNumber(confidence, 0),
    explainability: safeNumber(explainability, 0),
    grade,
    label,
    reasons,
    risks,
    factorScores: scores,
    factors,
    topFactors,
  };
}

export type {
  EdgeEngineResult,
  EdgeFactorInsight,
  EdgeFactorScores,
  EdgeReason,
  EdgeRisk,
  FactorAdvantage,
  FactorImpactLevel,
} from "./types";
export { BASEBALL_EDGE_WEIGHTS, WEIGHT_TOTAL } from "./weights";
export {
  calculateEdgeScore,
  computeFactorScores,
  edgeScoreToWinProbability,
} from "./calculate-edge";
export {
  calculateConfidence,
  calculateExplainability,
} from "./calculate-confidence";
export {
  buildFactorInsights,
  selectTopFactors,
  advantageForPick,
  impactLevel,
} from "./build-factors";
export {
  generateEdgeReasons,
  generateEdgeRisks,
} from "./generate-edge-reasons";

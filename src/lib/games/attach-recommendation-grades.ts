import { getEngineAnalysisData } from "@/lib/engine/analysis-data-provider";
import { runEdgeEngine } from "@/lib/edge/run-edge-engine";
import { getRecommendationGrade } from "@/lib/edge/recommendation-grade";
import type {
  GameRecommendationGrade,
  GameWithOdds,
} from "@/types/game-with-odds";

/**
 * GameCard 표시용 추천 등급 결정 (순수·결정적).
 *
 * - 분석 데이터 없음 → null (배지 미표시)
 * - 있으면 getRecommendationGrade(edgeScore) 결과 (설명 문구 제외)
 */
export function resolveGameCardRecommendation(
  hasAnalysisData: boolean,
  edgeScore: number | null | undefined,
): GameRecommendationGrade | null {
  if (!hasAnalysisData) return null;
  if (edgeScore == null || typeof edgeScore !== "number") return null;

  const { grade, color } = getRecommendationGrade(edgeScore);
  return { grade, color };
}

/**
 * /games 목록에 Engine 기반 추천 등급을 붙인다.
 * Odds·Today Pick·Featured·분석 상세와 분리된 표시용 enrichment.
 */
export async function attachRecommendationGrades(
  items: GameWithOdds[],
): Promise<GameWithOdds[]> {
  return Promise.all(
    items.map(async (item) => {
      if (!item.game.aiAnalysisAvailable) {
        return { ...item, recommendation: null };
      }

      const engineInput = await getEngineAnalysisData(item.game.id);
      if (!engineInput) {
        return { ...item, recommendation: null };
      }

      const result = runEdgeEngine(engineInput);
      const recommendation = resolveGameCardRecommendation(
        true,
        result.edgeScore,
      );

      return { ...item, recommendation };
    }),
  );
}

import type { GameData } from "@/types/game";
import type { OddsData } from "@/lib/odds";
import type {
  RecommendationGradeLabel,
  RecommendationGradeResult,
} from "@/lib/edge/recommendation-grade";

export type GameOddsMatchInfo = {
  matched: boolean;
  /** 0~1 (external-id=1.0, 정확 팀명 0.9, 부분 포함 0.72) */
  confidence: number;
  method: "external-id" | "teams-time" | "none";
};

/** GameCard 표시용 — 등급명·색만 (설명 문구 제외) */
export type GameRecommendationGrade = {
  grade: RecommendationGradeLabel;
  color: RecommendationGradeResult["color"];
};

/**
 * /api/games 응답 항목.
 * 배당이 없거나 신뢰도가 낮으면 odds=null (빈 값·0 표시 금지).
 * odds.bookmakers 는 상세 페이지 확장용으로 보존하되 카드에는 노출하지 않는다.
 * recommendation 은 Engine 결과가 있을 때만 채운다 (없으면 null → 배지 미표시).
 */
export type GameWithOdds = {
  game: GameData;
  odds: OddsData | null;
  oddsMatch: GameOddsMatchInfo;
  recommendation?: GameRecommendationGrade | null;
};

export function toBareGameWithOdds(game: GameData): GameWithOdds {
  return {
    game,
    odds: null,
    oddsMatch: { matched: false, confidence: 0, method: "none" },
    recommendation: null,
  };
}

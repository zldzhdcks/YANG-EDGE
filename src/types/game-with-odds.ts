import type { GameData } from "@/types/game";
import type { OddsData } from "@/lib/odds";

export type GameOddsMatchInfo = {
  matched: boolean;
  /** 0~1 (external-id=1.0, 정확 팀명 0.9, 부분 포함 0.72) */
  confidence: number;
  method: "external-id" | "teams-time" | "none";
};

/**
 * /api/games 응답 항목.
 * 배당이 없거나 신뢰도가 낮으면 odds=null (빈 값·0 표시 금지).
 * odds.bookmakers 는 상세 페이지 확장용으로 보존하되 카드에는 노출하지 않는다.
 */
export type GameWithOdds = {
  game: GameData;
  odds: OddsData | null;
  oddsMatch: GameOddsMatchInfo;
};

export function toBareGameWithOdds(game: GameData): GameWithOdds {
  return {
    game,
    odds: null,
    oddsMatch: { matched: false, confidence: 0, method: "none" },
  };
}

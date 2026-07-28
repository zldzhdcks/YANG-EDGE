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

export type OddsAvailability =
  | "available"
  | "not-found"
  | "not-yet-posted"
  | "market-closed"
  | "historical-not-loaded"
  | "provider-error";

export function getOddsAvailabilityLabel(
  availability: OddsAvailability,
): string | null {
  switch (availability) {
    case "available":
      return null;
    case "market-closed":
      return "배당 마감";
    case "historical-not-loaded":
      return "과거 배당 미수집";
    case "not-yet-posted":
      return "배당 준비중";
    case "not-found":
      return "배당 정보 없음";
    case "provider-error":
      return "배당 조회 실패";
  }
}

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
 * researchOutcome 은 graded research snapshot이 있을 때만 (시작 전·Live 미표시).
 */
export type GameResearchOutcomeDisplay = {
  homeScore: number;
  awayScore: number;
  homeTeam: string;
  awayTeam: string;
  predictedTeam: string;
  predictionHit: boolean;
};

export type GameWithOdds = {
  game: GameData;
  odds: OddsData | null;
  oddsMatch: GameOddsMatchInfo;
  oddsAvailability: OddsAvailability;
  oddsUnavailableReason: string | null;
  oddsComparison?: {
    domestic: {
      homeOdds: number | null;
      awayOdds: number | null;
      reviewStatus: "DRAFT" | "VERIFIED" | "REJECTED";
      sourceLabel: string;
    } | null;
    overseas: {
      homeOdds: number | null;
      awayOdds: number | null;
      providerLabel: string;
    } | null;
    comparisonStatus:
      | "COMPARABLE"
      | "MARKET_RULE_UNVERIFIED"
      | "DOMESTIC_MISSING"
      | "OVERSEAS_MISSING";
  } | null;
  recommendation?: GameRecommendationGrade | null;
  researchOutcome?: GameResearchOutcomeDisplay | null;
};

export function toBareGameWithOdds(game: GameData): GameWithOdds {
  return {
    game,
    odds: null,
    oddsMatch: { matched: false, confidence: 0, method: "none" },
    oddsAvailability: "not-found",
    oddsUnavailableReason: null,
    oddsComparison: null,
    recommendation: null,
    researchOutcome: null,
  };
}

import type { SportFilter } from "@/types/game";
import { SPORT_FILTERS } from "@/constants/games";
import { formatKoreanDate } from "@/lib/games/group";
import {
  RECOMMENDATION_FILTERS,
  type RecommendationFilterId,
} from "@/lib/games/recommendation-filter";

/** 종목 필터 요약 라벨 — "all"은 "전체 종목" */
export function sportFilterSummaryLabel(sport: SportFilter): string {
  if (sport === "all") return "전체 종목";
  return SPORT_FILTERS.find((f) => f.id === sport)?.label ?? sport;
}

/** 추천 필터 요약 라벨 (UI와 동일) */
export function recommendationFilterSummaryLabel(
  recommendation: RecommendationFilterId,
): string {
  return (
    RECOMMENDATION_FILTERS.find((f) => f.id === recommendation)?.label ??
    recommendation
  );
}

/**
 * /games 상단 조건 요약 문구 (순수·결정적).
 * 예: 2026년 7월 25일 · 야구 · EDGE PICK 이상 · "LG" 검색 · 1경기
 */
export function buildGamesFilterSummary(options: {
  date: string;
  sport: SportFilter;
  recommendation: RecommendationFilterId;
  search: string;
  resultCount: number;
}): string {
  const parts: string[] = [
    formatKoreanDate(options.date),
    sportFilterSummaryLabel(options.sport),
    recommendationFilterSummaryLabel(options.recommendation),
  ];

  const query = options.search.trim();
  if (query) {
    parts.push(`"${query}" 검색`);
  }

  parts.push(`${options.resultCount}경기`);
  return parts.join(" · ");
}

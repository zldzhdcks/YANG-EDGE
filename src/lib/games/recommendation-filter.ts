import type { SportFilter } from "@/types/game";
import type {
  GameRecommendationGrade,
  GameWithOdds,
} from "@/types/game-with-odds";
import {
  getMatchDisplayLabel,
  getTeamDisplayName,
} from "@/lib/teams";

export type RecommendationFilterId =
  | "all"
  | "analyzable"
  | "watch-or-higher"
  | "edge-pick-or-higher"
  | "top-edge";

export const RECOMMENDATION_FILTER_STORAGE_KEY =
  "yang-edge:games:recommendation-filter";

/**
 * /games 추천 등급 필터 기본값.
 * 한 줄만 바꾸면 전역 기본이 바뀐다 (예: "edge-pick-or-higher").
 * 유효한 저장값이 있으면 저장값이 우선한다.
 */
export const DEFAULT_RECOMMENDATION_FILTER: RecommendationFilterId = "all";

export const RECOMMENDATION_FILTER_IDS: readonly RecommendationFilterId[] = [
  "all",
  "analyzable",
  "watch-or-higher",
  "edge-pick-or-higher",
  "top-edge",
] as const;

export const RECOMMENDATION_FILTERS: {
  id: RecommendationFilterId;
  label: string;
}[] = [
  { id: "all", label: "전체" },
  { id: "analyzable", label: "분석 가능" },
  { id: "watch-or-higher", label: "WATCH 이상" },
  { id: "edge-pick-or-higher", label: "EDGE PICK 이상" },
  { id: "top-edge", label: "TOP EDGE" },
];

function isRecommendationFilterId(
  value: string,
): value is RecommendationFilterId {
  return (RECOMMENDATION_FILTER_IDS as readonly string[]).includes(value);
}

/**
 * 저장값 파싱 — 없거나 잘못된 값이면 defaultValue(기본: DEFAULT_RECOMMENDATION_FILTER).
 * 유효한 저장값이 있으면 저장값 우선.
 */
export function parseRecommendationFilterId(
  raw: string | null | undefined,
  defaultValue: RecommendationFilterId = DEFAULT_RECOMMENDATION_FILTER,
): RecommendationFilterId {
  if (typeof raw === "string" && isRecommendationFilterId(raw)) {
    return raw;
  }
  return isRecommendationFilterId(defaultValue)
    ? defaultValue
    : DEFAULT_RECOMMENDATION_FILTER;
}

/** 브라우저에서만 읽기. SSR·비브라우저·복원 실패 → DEFAULT_RECOMMENDATION_FILTER */
export function readStoredRecommendationFilter(): RecommendationFilterId {
  if (typeof window === "undefined") return DEFAULT_RECOMMENDATION_FILTER;
  try {
    return parseRecommendationFilterId(
      window.localStorage.getItem(RECOMMENDATION_FILTER_STORAGE_KEY),
    );
  } catch {
    return DEFAULT_RECOMMENDATION_FILTER;
  }
}

/** 브라우저에서만 쓰기. 유효 id만 저장 (잘못된 값은 기본값으로 정규화) */
export function writeStoredRecommendationFilter(
  value: RecommendationFilterId,
): void {
  if (typeof window === "undefined") return;
  const safe = parseRecommendationFilterId(value);
  try {
    window.localStorage.setItem(RECOMMENDATION_FILTER_STORAGE_KEY, safe);
  } catch {
    // private mode / quota — 무시
  }
}

/**
 * 추천 등급 필터 매칭 (순수·결정적).
 *
 * - 전체: 모두
 * - 분석 가능: recommendation 존재 (PASS 포함)
 * - WATCH 이상 / EDGE PICK 이상 / TOP EDGE: 해당 등급 이상만
 * - 분석 준비중(recommendation 없음): 전체만 통과
 */
export function matchesRecommendationFilter(
  recommendation: GameRecommendationGrade | null | undefined,
  filter: RecommendationFilterId,
): boolean {
  if (filter === "all") return true;

  const grade = recommendation?.grade;
  if (!grade) return false;

  switch (filter) {
    case "analyzable":
      return true;
    case "watch-or-higher":
      return (
        grade === "WATCH" || grade === "EDGE PICK" || grade === "TOP EDGE"
      );
    case "edge-pick-or-higher":
      return grade === "EDGE PICK" || grade === "TOP EDGE";
    case "top-edge":
      return grade === "TOP EDGE";
    default:
      return false;
  }
}

export function filterGamesClientSide(
  items: GameWithOdds[],
  options: {
    search: string;
    sport: SportFilter;
    recommendation: RecommendationFilterId;
  },
): GameWithOdds[] {
  return items.filter(
    (item) =>
      matchesSportAndSearch(item, options.sport, options.search) &&
      matchesRecommendationFilter(
        item.recommendation,
        options.recommendation,
      ),
  );
}

function matchesSportAndSearch(
  item: GameWithOdds,
  sport: SportFilter,
  search: string,
): boolean {
  if (sport !== "all" && item.game.sport !== sport) {
    return false;
  }

  const query = search.trim().toLowerCase();
  if (!query) return true;

  const searchable = [
    item.game.league,
    item.game.homeTeam,
    item.game.awayTeam,
    getTeamDisplayName(item.game.homeTeam),
    getTeamDisplayName(item.game.awayTeam),
    getMatchDisplayLabel(item.game.homeTeam, item.game.awayTeam),
  ]
    .join(" ")
    .toLowerCase();

  return searchable.includes(query);
}

export type RecommendationFilterCounts = Record<
  RecommendationFilterId,
  number
>;

/**
 * 종목·검색을 반영한 뒤, 추천 필터 옵션별 경기 수.
 * 현재 선택된 추천 필터는 무시한다 (각 옵션 선택 시 보일 수).
 */
export function countRecommendationFilters(
  items: GameWithOdds[],
  options: { search: string; sport: SportFilter },
): RecommendationFilterCounts {
  const scoped = items.filter((item) =>
    matchesSportAndSearch(item, options.sport, options.search),
  );

  const counts = {} as RecommendationFilterCounts;
  for (const id of RECOMMENDATION_FILTER_IDS) {
    counts[id] = scoped.filter((item) =>
      matchesRecommendationFilter(item.recommendation, id),
    ).length;
  }
  return counts;
}

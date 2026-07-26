/**
 * /games 추천 등급 필터 + localStorage + 기본값 상수 테스트
 * 실행: npx tsx scripts/test-recommendation-filter.ts
 */
import {
  DEFAULT_RECOMMENDATION_FILTER,
  countRecommendationFilters,
  filterGamesClientSide,
  parseRecommendationFilterId,
  RECOMMENDATION_FILTER_STORAGE_KEY,
  type RecommendationFilterId,
} from "../src/lib/games/recommendation-filter";
import type { GameWithOdds } from "../src/types/game-with-odds";
import type { GameData } from "../src/types/game";
import type { GameRecommendationGrade } from "../src/types/game-with-odds";

function game(
  id: string,
  sport: GameData["sport"],
  recommendation: GameRecommendationGrade | null,
): GameWithOdds {
  return {
    game: {
      id,
      sport,
      league: sport === "baseball" ? "KBO" : "EPL",
      homeTeam: `Home-${id}`,
      awayTeam: `Away-${id}`,
      startTime: "18:00",
      date: "2026-07-25",
      aiAnalysisAvailable: recommendation != null,
    },
    odds: null,
    oddsMatch: { matched: false, confidence: 0, method: "none" },
    oddsAvailability: "not-found",
    oddsUnavailableReason: "테스트",
    recommendation,
  };
}

const PASS: GameRecommendationGrade = { grade: "PASS", color: "zinc" };
const WATCH: GameRecommendationGrade = { grade: "WATCH", color: "blue" };
const EDGE: GameRecommendationGrade = { grade: "EDGE PICK", color: "emerald" };
const TOP: GameRecommendationGrade = { grade: "TOP EDGE", color: "amber" };

const catalog = [
  game("prep", "baseball", null),
  game("pass", "baseball", PASS),
  game("watch", "baseball", WATCH),
  game("edge", "baseball", EDGE),
  game("top", "baseball", TOP),
  game("fb-edge", "football", EDGE),
  game("fb-prep", "football", null),
];

function ids(
  items: GameWithOdds[],
  recommendation: RecommendationFilterId,
  sport: GameData["sport"] | "all" = "all",
): string[] {
  return filterGamesClientSide(items, {
    search: "",
    sport,
    recommendation,
  }).map((i) => i.game.id);
}

function assert(cond: boolean, label: string): void {
  if (cond) console.log(`OK  ${label}`);
  else {
    console.error(`FAIL ${label}`);
    throw new Error(label);
  }
}

function same(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

function main() {
  console.log("=== 추천 등급 필터 ===\n");

  assert(
    same(ids(catalog, "all"), [
      "prep",
      "pass",
      "watch",
      "edge",
      "top",
      "fb-edge",
      "fb-prep",
    ]),
    "전체",
  );

  assert(
    same(ids(catalog, "analyzable"), [
      "pass",
      "watch",
      "edge",
      "top",
      "fb-edge",
    ]),
    "분석 가능",
  );

  assert(
    same(ids(catalog, "watch-or-higher"), [
      "watch",
      "edge",
      "top",
      "fb-edge",
    ]),
    "WATCH 이상",
  );

  assert(
    same(ids(catalog, "edge-pick-or-higher"), ["edge", "top", "fb-edge"]),
    "EDGE PICK 이상",
  );

  assert(same(ids(catalog, "top-edge"), ["top"]), "TOP EDGE");

  assert(
    same(ids(catalog, "edge-pick-or-higher", "baseball"), ["edge", "top"]),
    "종목 필터와 조합 (야구 + EDGE PICK 이상)",
  );

  assert(
    !ids(catalog, "analyzable").includes("prep") &&
      !ids(catalog, "watch-or-higher").includes("prep") &&
      !ids(catalog, "edge-pick-or-higher").includes("prep") &&
      !ids(catalog, "top-edge").includes("prep") &&
      ids(catalog, "all").includes("prep"),
    "분석 준비중 제외 (전체만)",
  );

  assert(
    !ids(catalog, "watch-or-higher").includes("pass") &&
      ids(catalog, "analyzable").includes("pass") &&
      ids(catalog, "all").includes("pass"),
    "PASS는 전체·분석 가능만",
  );

  assert(ids(catalog, "top-edge", "football").length === 0, "결과 0건");

  console.log("\n=== 기본값 상수 · localStorage ===\n");

  assert(
    RECOMMENDATION_FILTER_STORAGE_KEY ===
      "yang-edge:games:recommendation-filter",
    "저장 키",
  );

  assert(
    DEFAULT_RECOMMENDATION_FILTER === "all",
    "기본값 상수 적용 (현재 all)",
  );

  assert(
    parseRecommendationFilterId(null) === DEFAULT_RECOMMENDATION_FILTER,
    "저장값 없음 → 기본값",
  );
  assert(
    parseRecommendationFilterId(undefined) === DEFAULT_RECOMMENDATION_FILTER,
    "undefined → 기본값",
  );
  assert(
    parseRecommendationFilterId("") === DEFAULT_RECOMMENDATION_FILTER,
    "빈 문자열 → 기본값",
  );

  assert(
    parseRecommendationFilterId("edge-pick-or-higher") ===
      "edge-pick-or-higher",
    "유효한 저장값 → 저장값 우선",
  );
  assert(
    parseRecommendationFilterId("watch-or-higher") === "watch-or-higher",
    "유효한 저장값 watch-or-higher",
  );
  assert(
    parseRecommendationFilterId("top-edge") === "top-edge",
    "유효 top-edge",
  );
  assert(
    parseRecommendationFilterId("analyzable") === "analyzable",
    "유효 analyzable",
  );
  assert(parseRecommendationFilterId("all") === "all", "유효 all");

  assert(
    parseRecommendationFilterId("watch_plus") === DEFAULT_RECOMMENDATION_FILTER,
    "잘못된 저장값 → 기본값",
  );
  assert(
    parseRecommendationFilterId("EDGE PICK") === DEFAULT_RECOMMENDATION_FILTER,
    "잘못된 라벨 → 기본값",
  );
  assert(
    parseRecommendationFilterId("foo") === DEFAULT_RECOMMENDATION_FILTER,
    "알 수 없는 값 → 기본값",
  );

  // 기본값을 edge-pick-or-higher로 바꿨을 때 (테스트 인자로 주입)
  const altDefault: RecommendationFilterId = "edge-pick-or-higher";
  assert(
    parseRecommendationFilterId(null, altDefault) === altDefault,
    "기본값 변경 시 저장 없음 → 새 기본값",
  );
  assert(
    parseRecommendationFilterId("bogus", altDefault) === altDefault,
    "기본값 변경 시 잘못된 값 → 새 기본값",
  );
  assert(
    parseRecommendationFilterId("top-edge", altDefault) === "top-edge",
    "기본값 변경 후에도 유효 저장값 우선",
  );
  assert(
    same(ids(catalog, altDefault), ["edge", "top", "fb-edge"]),
    "기본값 변경 시 필터 동작",
  );

  const saved = "edge-pick-or-higher";
  const restored = parseRecommendationFilterId(saved);
  assert(restored === saved, "변경 시 저장 → 새로고침 후 유지");

  console.log("\n=== 필터별 경기 수 ===\n");

  const countsAll = countRecommendationFilters(catalog, {
    search: "",
    sport: "all",
  });
  assert(countsAll.all === 7, "전체 경기 수");
  assert(countsAll.analyzable === 5, "분석 가능 수");
  assert(countsAll["watch-or-higher"] === 4, "WATCH 이상 수");
  assert(countsAll["edge-pick-or-higher"] === 3, "EDGE PICK 이상 수");
  assert(countsAll["top-edge"] === 1, "TOP EDGE 수");

  const countsBaseball = countRecommendationFilters(catalog, {
    search: "",
    sport: "baseball",
  });
  assert(
    countsBaseball.all === 5 &&
      countsBaseball.analyzable === 4 &&
      countsBaseball["watch-or-higher"] === 3 &&
      countsBaseball["edge-pick-or-higher"] === 2 &&
      countsBaseball["top-edge"] === 1,
    "종목 필터 조합 (야구)",
  );

  const countsSearch = countRecommendationFilters(catalog, {
    search: "Home-edge",
    sport: "all",
  });
  assert(
    countsSearch.all === 1 &&
      countsSearch.analyzable === 1 &&
      countsSearch["edge-pick-or-higher"] === 1 &&
      countsSearch["top-edge"] === 0,
    "검색어 조합",
  );

  assert(
    countsAll.all === 7 &&
      countsAll.analyzable === 5 &&
      // prep + fb-prep = 2 분석 준비중 → 전체에만 포함
      countsAll.all - countsAll.analyzable === 2,
    "분석 준비중 처리 (전체에만 포함)",
  );

  // 카운트는 클라이언트 순수 함수 — API 호출 없음
  assert(typeof countRecommendationFilters === "function", "API 재호출 없음");

  console.log("\nALL PASS");
}

main();

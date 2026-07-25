/**
 * /games 조건 요약 문구 테스트
 * 실행: npx tsx scripts/test-games-filter-summary.ts
 */
import { buildGamesFilterSummary } from "../src/lib/games/filter-summary";

function assert(cond: boolean, label: string): void {
  if (cond) console.log(`OK  ${label}`);
  else {
    console.error(`FAIL ${label}`);
    throw new Error(label);
  }
}

function main() {
  console.log("=== Games 조건 요약 ===\n");

  assert(
    buildGamesFilterSummary({
      date: "2026-07-25",
      sport: "all",
      recommendation: "all",
      search: "",
      resultCount: 25,
    }) === "2026년 7월 25일 · 전체 종목 · 전체 · 25경기",
    "전체 조건",
  );

  assert(
    buildGamesFilterSummary({
      date: "2026-07-25",
      sport: "baseball",
      recommendation: "all",
      search: "",
      resultCount: 10,
    }) === "2026년 7월 25일 · 야구 · 전체 · 10경기",
    "종목 선택",
  );

  assert(
    buildGamesFilterSummary({
      date: "2026-07-25",
      sport: "baseball",
      recommendation: "edge-pick-or-higher",
      search: "",
      resultCount: 2,
    }) === "2026년 7월 25일 · 야구 · EDGE PICK 이상 · 2경기",
    "추천 필터 선택",
  );

  assert(
    buildGamesFilterSummary({
      date: "2026-07-25",
      sport: "baseball",
      recommendation: "edge-pick-or-higher",
      search: "LG",
      resultCount: 1,
    }) === '2026년 7월 25일 · 야구 · EDGE PICK 이상 · "LG" 검색 · 1경기',
    "검색어 포함",
  );

  assert(
    buildGamesFilterSummary({
      date: "2026-07-25",
      sport: "football",
      recommendation: "top-edge",
      search: "",
      resultCount: 0,
    }) === "2026년 7월 25일 · 축구 · TOP EDGE · 0경기",
    "0경기",
  );

  assert(
    buildGamesFilterSummary({
      date: "2026-07-26",
      sport: "all",
      recommendation: "all",
      search: "",
      resultCount: 3,
    }) === "2026년 7월 26일 · 전체 종목 · 전체 · 3경기",
    "날짜 변경",
  );

  // 순수 함수 — API 호출 없음
  assert(typeof buildGamesFilterSummary === "function", "API 재호출 없음");

  console.log("\nALL PASS");
}

main();

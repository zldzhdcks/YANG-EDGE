/**
 * Featured 선정 (PASS 제외) 테스트
 * 실행: npx tsx scripts/test-featured-selection.ts
 */
import {
  selectFeaturedRows,
  type HomeGameEngineRow,
} from "../src/lib/home/build-home-feed";
import { getRecommendationGrade } from "../src/lib/edge/recommendation-grade";
import type { GameData } from "../src/types/game";
import type { EdgeEngineResult, EdgeFactorInsight } from "../src/lib/edge/types";
import type { AnalysisData } from "../src/types/engine-analysis";

function stubFactor(): EdgeFactorInsight {
  return {
    key: "recentForm",
    label: "form",
    score: 0,
    importance: 10,
    impactValue: 0,
    impact: "NONE",
    advantage: "neutral",
    available: true,
    icon: "form",
  };
}

function stubResult(edgeScore: number, confidence: number): EdgeEngineResult {
  const factors = [stubFactor()];
  return {
    version: "v1",
    engineId: "rule-v1",
    pickTeamId: "home",
    pickTeamName: "Home",
    winProbability: 55,
    edgeScore,
    confidence,
    explainability: 70,
    grade: "B",
    label: "Solid",
    reasons: [],
    risks: [],
    factorScores: {
      recentForm: 0,
      homeAway: 0,
      scoring: 0,
      defense: 0,
      leagueStanding: 0,
      headToHead: 0,
      rest: 0,
      injuries: 0,
      streak: 0,
      startingPitcher: 0,
    },
    factors,
    topFactors: factors,
  };
}

function stubGame(id: string, date: string, startTime: string): GameData {
  return {
    id,
    sport: "baseball",
    league: "KBO",
    homeTeam: "Home",
    awayTeam: "Away",
    startTime,
    date,
    aiAnalysisAvailable: true,
  };
}

function stubInput(id: string): AnalysisData {
  return {
    gameId: id,
    sport: "baseball",
    league: "KBO",
    homeTeam: "Home",
    awayTeam: "Away",
    date: "2024-06-01",
    startTime: "18:00",
    home: {} as AnalysisData["home"],
    away: {} as AnalysisData["away"],
    headToHead: {
      played: 0,
      homeTeamWins: 0,
      awayTeamWins: 0,
      draws: 0,
      recentMeetings: [],
    },
  };
}

function row(
  id: string,
  edge: number,
  confidence: number,
  date = "2024-06-01",
  startTime = "18:00",
): HomeGameEngineRow {
  return {
    game: stubGame(id, date, startTime),
    result: stubResult(edge, confidence),
    engineInput: stubInput(id),
  };
}

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

function main() {
  console.log("=== Featured 선정 (PASS 제외) ===\n");

  // PASS만 → 빈 목록 (안내 표시용)
  const onlyPass = selectFeaturedRows([
    row("p1", 0, 50),
    row("p2", 4.9, 80),
  ]);
  assert(onlyPass.length === 0, "PASS only → empty");
  console.log("OK  PASS만 존재 → 안내 표시(빈 목록)");

  // WATCH 1개
  const oneWatch = selectFeaturedRows([row("w1", 5, 40), row("p", 3, 90)]);
  assert(oneWatch.length === 1 && oneWatch[0].game.id === "w1", "WATCH 1");
  assert(
    getRecommendationGrade(oneWatch[0].result.edgeScore).grade === "WATCH",
    "grade WATCH",
  );
  console.log("OK  WATCH 1개 → 표시");

  // PASS + EDGE PICK → PICK만
  const mixed = selectFeaturedRows([
    row("pass", 2, 99),
    row("pick", 11, 40),
  ]);
  assert(mixed.length === 1 && mixed[0].game.id === "pick", "only EDGE PICK");
  console.log("OK  PASS + EDGE PICK → EDGE PICK만 표시");

  // 여러 경기 정렬: |EDGE| → conf → time → id
  const sorted = selectFeaturedRows([
    row("a", 11, 50, "2024-06-01", "19:00"),
    row("b", 14, 40, "2024-06-01", "18:00"),
    row("c", -14, 60, "2024-06-01", "17:00"), // abs tie with b, higher conf
    row("d", 6, 90),
    row("pass", 1, 99),
  ]);
  assert(
    sorted.map((r) => r.game.id).join(",") === "c,b,a,d",
    `sort got ${sorted.map((r) => r.game.id).join(",")}`,
  );
  console.log("OK  여러 경기 → 정렬 규칙 유지");

  // 음수 EDGE 절댓값
  const neg = selectFeaturedRows([row("n", -12, 30), row("p", 4, 90)]);
  assert(neg.length === 1 && neg[0].game.id === "n", "negative abs");
  console.log("OK  음수 EDGE도 절댓값 기준");

  // 결정성
  const input = [
    row("x", 8, 40),
    row("y", -11, 50),
    row("z", 3, 99),
  ];
  const a = selectFeaturedRows(input)
    .map((r) => r.game.id)
    .join(",");
  const b = selectFeaturedRows(input)
    .map((r) => r.game.id)
    .join(",");
  assert(a === b && a === "y,x", "deterministic");
  console.log("OK  동일 입력 → 동일 결과");

  console.log("\nALL PASS");
}

main();

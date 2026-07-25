/**
 * Today EDGE Pick 선정 규칙 테스트
 * 실행: npx tsx scripts/test-today-pick-selection.ts
 */
import {
  selectTodayPickRow,
  TODAY_PICK_MIN_ABS_EDGE,
  type HomeGameEngineRow,
} from "../src/lib/home/build-home-feed";
import type { GameData } from "../src/types/game";
import type { EdgeEngineResult, EdgeFactorInsight } from "../src/lib/edge/types";
import type { AnalysisData } from "../src/types/engine-analysis";

function stubFactor(available: boolean): EdgeFactorInsight {
  return {
    key: "recentForm",
    label: "form",
    score: 0,
    importance: 10,
    impactValue: 0,
    impact: "NONE",
    advantage: "neutral",
    available,
    icon: "form",
  };
}

function stubResult(
  edgeScore: number,
  confidence: number,
  availableCount: number,
  totalFactors = 10,
): EdgeEngineResult {
  const factors = Array.from({ length: totalFactors }, (_, i) =>
    stubFactor(i < availableCount),
  );
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
    topFactors: factors.slice(0, 4),
  };
}

function stubGame(
  id: string,
  date: string,
  startTime: string,
): GameData {
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

function stubInput(): AnalysisData {
  return {
    gameId: "x",
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
  availableCount: number,
  date = "2024-06-01",
  startTime = "18:00",
): HomeGameEngineRow {
  return {
    game: stubGame(id, date, startTime),
    result: stubResult(edge, confidence, availableCount),
    engineInput: { ...stubInput(), gameId: id },
  };
}

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

function main() {
  console.log("=== Today Pick 선정 (|EDGE| >=", TODAY_PICK_MIN_ABS_EDGE, ") ===\n");

  // 1) EDGE 9.9만 → 없음
  const none = selectTodayPickRow([row("a", 9.9, 80, 10)]);
  assert(none === null, "9.9 should be null");
  console.log("OK  EDGE 9.9만 → Today Pick 없음");

  // 2) EDGE 10 → 선정
  const at10 = selectTodayPickRow([row("b", 10, 50, 5)]);
  assert(at10?.game.id === "b", "10 should pick b");
  console.log("OK  EDGE 10 존재 → 선정");

  // 3) EDGE -12 → 절댓값 선정
  const neg = selectTodayPickRow([
    row("low", 9, 90, 10),
    row("neg", -12, 40, 3),
  ]);
  assert(neg?.game.id === "neg", "-12 should win by abs");
  console.log("OK  EDGE -12 존재 → 절댓값 기준 선정");

  // 4) 여러 경기 → 가장 높은 |EDGE|
  const highest = selectTodayPickRow([
    row("x", 11, 90, 10),
    row("y", 14.5, 40, 2),
    row("z", -13, 80, 8),
  ]);
  assert(highest?.game.id === "y", "highest abs edge");
  console.log("OK  여러 경기 → 가장 높은 |EDGE| 선정");

  // 5) 동점 EDGE → confidence
  const byConf = selectTodayPickRow([
    row("c1", 12, 40, 10),
    row("c2", 12, 70, 10),
  ]);
  assert(byConf?.game.id === "c2", "higher confidence");
  console.log("OK  동점 → confidence 기준");

  // 5b) EDGE+confidence 동점 → dataAvailability
  const byAvail = selectTodayPickRow([
    row("d1", 12, 60, 3),
    row("d2", 12, 60, 9),
  ]);
  assert(byAvail?.game.id === "d2", "higher availability");
  console.log("OK  동점 → dataAvailability 기준");

  // 5c) 그다음 시작 시간
  const byTime = selectTodayPickRow([
    row("t2", 12, 60, 5, "2024-06-01", "19:00"),
    row("t1", 12, 60, 5, "2024-06-01", "14:00"),
  ]);
  assert(byTime?.game.id === "t1", "earlier start");
  console.log("OK  동점 → 시작 시간 빠른 경기");

  // 5d) gameId
  const byId = selectTodayPickRow([
    row("m-b", 12, 60, 5, "2024-06-01", "18:00"),
    row("m-a", 12, 60, 5, "2024-06-01", "18:00"),
  ]);
  assert(byId?.game.id === "m-a", "gameId asc");
  console.log("OK  동점 → gameId 오름차순");

  // 6) 결정성
  const input = [
    row("p1", 11, 50, 4),
    row("p2", -15, 40, 8),
    row("p3", 9.5, 99, 10),
  ];
  const a = selectTodayPickRow(input);
  const b = selectTodayPickRow(input);
  assert(a?.game.id === b?.game.id && a?.game.id === "p2", "deterministic");
  console.log("OK  동일 입력 재실행 → 동일 결과");

  console.log("\nALL PASS");
}

main();

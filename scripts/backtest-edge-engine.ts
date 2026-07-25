/**
 * EDGE Engine v1 백테스트 평가
 *
 * 입력: data/backtest/baseball-2024-features.json
 * 출력:
 *   data/backtest/backtest-result.csv
 *   data/backtest/backtest-summary.json
 *
 * Engine 계산식·weights·UI·Provider 미수정 — 평가만 수행.
 *
 * 실행: npx tsx scripts/backtest-edge-engine.ts
 */
import { readFile, writeFile, stat } from "node:fs/promises";
import path from "node:path";
import { runEdgeEngine } from "../src/lib/edge/run-edge-engine";
import type { AnalysisData, TeamAnalysisSide } from "../src/types/engine-analysis";

const FEATURES_PATH = path.join(
  process.cwd(),
  "data",
  "backtest",
  "baseball-2024-features.json",
);
const CSV_PATH = path.join(process.cwd(), "data", "backtest", "backtest-result.csv");
const SUMMARY_PATH = path.join(
  process.cwd(),
  "data",
  "backtest",
  "backtest-summary.json",
);

type TeamFeat = {
  teamId: number;
  teamName: string;
  gamesPlayedBefore: number;
  winsLast5: number | null;
  lossesLast5: number | null;
  winRateLast5: number | null;
  runsScoredAverageLast5: number | null;
  runsAllowedAverageLast5: number | null;
  seasonWinRateBefore: number | null;
  seasonRunsScoredAverageBefore: number | null;
  seasonRunsAllowedAverageBefore: number | null;
  homeWinRateBefore: number | null;
  awayWinRateBefore: number | null;
  currentWinStreakBefore: number;
  currentLossStreakBefore: number;
  restDaysBefore: number | null;
};

type FeatureGame = {
  providerGameId: number;
  leagueId: number;
  leagueName: string;
  season: number;
  date: string;
  startTime: string;
  homeTeam: TeamFeat;
  awayTeam: TeamFeat;
  headToHead: {
    headToHeadGamesBefore: number;
    homeTeamHeadToHeadWinsBefore: number;
    awayTeamHeadToHeadWinsBefore: number;
    headToHeadHomeWinRateBefore: number | null;
  };
  dataAvailability: number;
  actualWinner: "home" | "away" | "draw";
  actualHomeScore: number;
  actualAwayScore: number;
};

type FeatureFile = {
  meta: unknown;
  games: FeatureGame[];
};

type RowResult = {
  providerGameId: number;
  leagueId: number;
  leagueName: string;
  date: string;
  homeTeam: string;
  awayTeam: string;
  pickTeamId: "home" | "away";
  pickTeamName: string;
  confidence: number;
  edgeScore: number;
  winProbability: number;
  actualWinner: "home" | "away" | "draw";
  hit: boolean | null; // null = draw (평가 제외)
  seasonPhase: "early" | "mid" | "late";
  dataAvailability: number;
  homeGamesBefore: number;
  awayGamesBefore: number;
};

function pct(n: number, d: number): number {
  if (d <= 0) return 0;
  return Math.round((n / d) * 10000) / 100;
}

function rateToPercent(rate: number | null): number {
  if (rate == null || !Number.isFinite(rate)) return Number.NaN;
  return rate * 100;
}

/**
 * 백테스트 특징 → Engine AnalysisData 어댑터 (평가 전용).
 * Engine 내부는 변경하지 않는다.
 * 없는 필드(선발·부상·개별 recentGames)는 null/빈 값으로 두어 availability=false 유도.
 */
function toAnalysisData(g: FeatureGame): AnalysisData {
  const mapSide = (side: TeamFeat, venue: "home" | "away"): TeamAnalysisSide => {
    const winsL5 = side.winsLast5 ?? 0;
    const lossesL5 = side.lossesLast5 ?? 0;
    // formStrength 는 W/L 합만 쓰므로 순서는 결과에 영향 없음
    const sequence =
      side.winsLast5 == null && side.lossesLast5 == null
        ? ""
        : "W".repeat(winsL5) + "L".repeat(lossesL5);

    const last5Len = sequence.length;

    const recentGames = Array.from({ length: last5Len }, (_, i) => ({
      date: g.date,
      opponent: "unknown",
      result: (sequence[i] === "W"
        ? "W"
        : sequence[i] === "L"
          ? "L"
          : "D") as "W" | "L" | "D",
      scoreFor: side.runsScoredAverageLast5 ?? 0,
      scoreAgainst: side.runsAllowedAverageLast5 ?? 0,
      isHome: venue === "home",
    }));

    const homeWr = rateToPercent(side.homeWinRateBefore);
    const awayWr = rateToPercent(side.awayWinRateBefore);
    const seasonWr = rateToPercent(side.seasonWinRateBefore);

    let streakType: "win" | "loss" | "draw" | "none" = "none";
    let streakCount = 0;
    if (side.currentWinStreakBefore > 0) {
      streakType = "win";
      streakCount = side.currentWinStreakBefore;
    } else if (side.currentLossStreakBefore > 0) {
      streakType = "loss";
      streakCount = side.currentLossStreakBefore;
    }

    const scored =
      side.seasonRunsScoredAverageBefore ?? side.runsScoredAverageLast5;
    const conceded =
      side.seasonRunsAllowedAverageBefore ?? side.runsAllowedAverageLast5;

    return {
      teamName: side.teamName,
      recentGames,
      homeRecord: {
        played: Number.isFinite(homeWr) ? Math.max(1, side.gamesPlayedBefore) : 0,
        wins: 0,
        draws: 0,
        losses: 0,
        winRate: homeWr,
      },
      awayRecord: {
        played: Number.isFinite(awayWr) ? Math.max(1, side.gamesPlayedBefore) : 0,
        wins: 0,
        draws: 0,
        losses: 0,
        winRate: awayWr,
      },
      leagueStanding: {
        rank: 0,
        played: side.gamesPlayedBefore,
        wins: 0,
        draws: 0,
        losses: 0,
        winningPercentage: side.seasonWinRateBefore ?? Number.NaN,
      },
      scoringAverages: {
        scoredAvg: scored ?? Number.NaN,
        concededAvg: conceded ?? Number.NaN,
      },
      recentForm: { sequence, last5: recentGames },
      winRate: seasonWr,
      streak: { type: streakType, count: streakCount },
      injuries: [],
      restDays: side.restDaysBefore ?? Number.NaN,
      startingPitcher: null,
    };
  };

  return {
    gameId: `bt-${g.providerGameId}`,
    sport: "baseball",
    league: g.leagueName,
    homeTeam: g.homeTeam.teamName,
    awayTeam: g.awayTeam.teamName,
    date: g.date,
    startTime: g.startTime,
    home: mapSide(g.homeTeam, "home"),
    away: mapSide(g.awayTeam, "away"),
    headToHead: {
      played: g.headToHead.headToHeadGamesBefore,
      homeTeamWins: g.headToHead.homeTeamHeadToHeadWinsBefore,
      awayTeamWins: g.headToHead.awayTeamHeadToHeadWinsBefore,
      draws: Math.max(
        0,
        g.headToHead.headToHeadGamesBefore -
          g.headToHead.homeTeamHeadToHeadWinsBefore -
          g.headToHead.awayTeamHeadToHeadWinsBefore,
      ),
      recentMeetings: [],
    },
  };
}

function seasonPhase(date: string): "early" | "mid" | "late" {
  const month = Number(date.slice(5, 7));
  if (month <= 4) return "early";
  if (month <= 7) return "mid";
  return "late";
}

function confidenceBucket(c: number): string {
  if (c < 50) return "0-50";
  if (c < 60) return "50-60";
  if (c < 70) return "60-70";
  if (c < 80) return "70-80";
  return "80+";
}

function edgeBucket(absEdge: number): string {
  if (absEdge < 5) return "0-5";
  if (absEdge < 10) return "5-10";
  if (absEdge < 15) return "10-15";
  if (absEdge < 20) return "15-20";
  return "20+";
}

type BucketStat = { total: number; hits: number; rate: number };

function finalizeBucket(map: Map<string, { total: number; hits: number }>): Record<string, BucketStat> {
  const out: Record<string, BucketStat> = {};
  for (const [k, v] of [...map.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    out[k] = { total: v.total, hits: v.hits, rate: pct(v.hits, v.total) };
  }
  return out;
}

function bump(
  map: Map<string, { total: number; hits: number }>,
  key: string,
  hit: boolean,
) {
  const cur = map.get(key) ?? { total: 0, hits: 0 };
  cur.total += 1;
  if (hit) cur.hits += 1;
  map.set(key, cur);
}

function csvEscape(value: string | number | boolean | null): string {
  const s = String(value ?? "");
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

async function main() {
  console.log("=== EDGE Engine v1 백테스트 ===");
  console.log("입력:", FEATURES_PATH);

  const file = JSON.parse(await readFile(FEATURES_PATH, "utf8")) as FeatureFile;
  const games = file.games;
  if (!Array.isArray(games) || games.length === 0) {
    throw new Error("features empty");
  }

  const rows: RowResult[] = [];
  let draws = 0;

  for (const g of games) {
    const input = toAnalysisData(g);
    const result = runEdgeEngine(input);

    const isDraw = g.actualWinner === "draw";
    const hit = isDraw
      ? null
      : result.pickTeamId === g.actualWinner;

    if (isDraw) draws += 1;

    rows.push({
      providerGameId: g.providerGameId,
      leagueId: g.leagueId,
      leagueName: g.leagueName,
      date: g.date,
      homeTeam: g.homeTeam.teamName,
      awayTeam: g.awayTeam.teamName,
      pickTeamId: result.pickTeamId,
      pickTeamName: result.pickTeamName,
      confidence: Math.round(result.confidence * 10) / 10,
      edgeScore: Math.round(result.edgeScore * 10) / 10,
      winProbability: Math.round(result.winProbability * 10) / 10,
      actualWinner: g.actualWinner,
      hit,
      seasonPhase: seasonPhase(g.date),
      dataAvailability: g.dataAvailability,
      homeGamesBefore: g.homeTeam.gamesPlayedBefore,
      awayGamesBefore: g.awayTeam.gamesPlayedBefore,
    });
  }

  const evaluated = rows.filter((r) => r.hit !== null) as Array<
    RowResult & { hit: boolean }
  >;
  const hits = evaluated.filter((r) => r.hit).length;
  const misses = evaluated.length - hits;

  const byLeague = new Map<string, { total: number; hits: number }>();
  const byConf = new Map<string, { total: number; hits: number }>();
  const byEdge = new Map<string, { total: number; hits: number }>();
  const byPhase = new Map<string, { total: number; hits: number }>();
  const missPatterns = new Map<string, number>();

  for (const r of evaluated) {
    bump(byLeague, r.leagueName, r.hit);
    bump(byConf, confidenceBucket(r.confidence), r.hit);
    bump(byEdge, edgeBucket(Math.abs(r.edgeScore)), r.hit);
    bump(byPhase, r.seasonPhase, r.hit);

    if (!r.hit) {
      const pattern = [
        `pick=${r.pickTeamId}`,
        `actual=${r.actualWinner}`,
        `phase=${r.seasonPhase}`,
        `conf=${confidenceBucket(r.confidence)}`,
        `edge=${edgeBucket(Math.abs(r.edgeScore))}`,
        r.homeGamesBefore < 10 || r.awayGamesBefore < 10 ? "thin-history" : "enough-history",
      ].join("|");
      missPatterns.set(pattern, (missPatterns.get(pattern) ?? 0) + 1);
    }
  }

  const topMissPatterns = [...missPatterns.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([pattern, count]) => ({ pattern, count }));

  const summary = {
    generatedAt: new Date().toISOString(),
    source: "baseball-2024-features.json",
    engine: "rule-v1",
    totalGames: rows.length,
    evaluatedGames: evaluated.length,
    drawsExcluded: draws,
    hits,
    misses,
    accuracy: pct(hits, evaluated.length),
    byLeague: finalizeBucket(byLeague),
    byConfidence: finalizeBucket(byConf),
    byEdgeScoreAbs: finalizeBucket(byEdge),
    bySeasonPhase: finalizeBucket(byPhase),
    topMissPatterns,
    improvementIdeas: [
      "시즌 초(thin-history) 구간은 dataAvailability 낮음 — 최소 경기 수 게이트 도입",
      "선발투수·부상 factor가 항상 비활성 — API-BASEBALL 유료/타 공급원 연결 시 Confidence·적중 개선 여지",
      "Confidence 낮은 구간만 추천을 보류하는 임계값(calibration) 실험",
      "홈 편향(pick=home 실패)이 많으면 homeAway 가중치 재검정보다 먼저 homeWinRate 표본 수 조건을 강화",
      "EDGE Score 절댓값이 작은 구간은 거의 동전 던지기 — |EDGE| 최소 컷오프 검토",
    ],
  };

  // CSV
  const header = [
    "providerGameId",
    "league",
    "date",
    "homeTeam",
    "awayTeam",
    "pickTeamId",
    "pickTeamName",
    "confidence",
    "edgeScore",
    "winProbability",
    "actualWinner",
    "hit",
    "seasonPhase",
    "dataAvailability",
  ];
  const csvLines = [
    header.join(","),
    ...rows.map((r) =>
      [
        r.providerGameId,
        r.leagueName,
        r.date,
        r.homeTeam,
        r.awayTeam,
        r.pickTeamId,
        r.pickTeamName,
        r.confidence,
        r.edgeScore,
        r.winProbability,
        r.actualWinner,
        r.hit === null ? "" : r.hit ? 1 : 0,
        r.seasonPhase,
        r.dataAvailability,
      ]
        .map(csvEscape)
        .join(","),
    ),
  ];
  await writeFile(CSV_PATH, csvLines.join("\n") + "\n", "utf8");
  await writeFile(SUMMARY_PATH, JSON.stringify(summary, null, 2) + "\n", "utf8");

  const csvStat = await stat(CSV_PATH);

  console.log("\n=== 결과 ===");
  console.log(`총 경기(특징)     : ${rows.length}`);
  console.log(`평가 경기(무 제외): ${evaluated.length} (무승부 ${draws} 제외)`);
  console.log(`적중 / 실패       : ${hits} / ${misses}`);
  console.log(`전체 적중률       : ${summary.accuracy}%`);
  console.log("리그별:");
  for (const [k, v] of Object.entries(summary.byLeague)) {
    console.log(`  ${k}: ${v.rate}% (${v.hits}/${v.total})`);
  }
  console.log("Confidence별:");
  for (const [k, v] of Object.entries(summary.byConfidence)) {
    console.log(`  ${k}: ${v.rate}% (${v.hits}/${v.total})`);
  }
  console.log("EDGE Score |abs|별:");
  for (const [k, v] of Object.entries(summary.byEdgeScoreAbs)) {
    console.log(`  ${k}: ${v.rate}% (${v.hits}/${v.total})`);
  }
  console.log("시즌 구간:");
  for (const [k, v] of Object.entries(summary.bySeasonPhase)) {
    console.log(`  ${k}: ${v.rate}% (${v.hits}/${v.total})`);
  }
  console.log("가장 많이 틀린 패턴:");
  for (const p of topMissPatterns.slice(0, 5)) {
    console.log(`  ${p.count}× ${p.pattern}`);
  }
  console.log(`CSV  : ${CSV_PATH} (${(csvStat.size / 1024).toFixed(1)} KB)`);
  console.log(`요약 : ${SUMMARY_PATH}`);
}

main().catch((e) => {
  console.error("FAILED:", e instanceof Error ? e.message : e);
  process.exit(1);
});

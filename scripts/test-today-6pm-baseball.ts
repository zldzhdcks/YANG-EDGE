/**
 * 오늘(KST) 18:00 전후 야구 경기 시제품 테스트 리포트 (조회·검증만).
 *
 * - Engine / weights / Market 계산식 / Odds 매칭 규칙 / UI 변경 없음
 * - Odds는 attachOddsToGames 1회만 (캐시·sportKey 중복 호출 방지)
 * - 임의 값 채우기 금지
 * - API 키 로그 금지
 *
 * 실행: npx tsx --env-file=.env.local scripts/test-today-6pm-baseball.ts
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { getKstToday } from "../src/lib/datetime/kst";
import { getSportsProvider } from "../src/lib/sports";
import {
  complementBaseballScheduleWithOdds,
  formatBaseballComplementSummary,
} from "../src/lib/games/complement-baseball-schedule";
import { attachOddsToGames } from "../src/lib/games/attach-odds";
import { getEngineAnalysisData } from "../src/lib/engine/analysis-data-provider";
import { runEdgeEngine } from "../src/lib/edge/run-edge-engine";
import { getRecommendationGrade } from "../src/lib/edge/recommendation-grade";
import { buildMarketComparison } from "../src/lib/market";
import {
  getMatchDisplayLabel,
  getTeamDisplayName,
} from "../src/lib/teams";
import type { GameData } from "../src/types/game";
import type { GameWithOdds } from "../src/types/game-with-odds";
import type { EdgeEngineResult } from "../src/lib/edge/types";

const WINDOW_START_MIN = 17 * 60 + 50; // 17:50
const WINDOW_END_MIN = 18 * 60 + 10; // 18:10
const RECOMMEND_ABS_EDGE = 10;

type FinalStatus =
  | "ANALYSIS_NOT_READY"
  | "ODDS_NOT_AVAILABLE"
  | "PASS"
  | "RECOMMENDED";

type GameReportRow = {
  gameId: string;
  league: string;
  startTime: string;
  homeTeam: string;
  awayTeam: string;
  homeTeamDisplay: string;
  awayTeamDisplay: string;
  matchDisplay: string;
  scheduleProvider: string | null;
  oddsMatched: boolean;
  oddsMatchMethod: string | null;
  bestHomeOdds: number | null;
  bestAwayOdds: number | null;
  analysisAvailable: boolean;
  edgeScore: number | null;
  confidence: number | null;
  recommendationGrade: string | null;
  modelWinProbability: number | null;
  marketProbability: number | null;
  valueEdge: number | null;
  finalStatus: FinalStatus;
  analysisDeterministic: boolean | null;
};

function parseHmToMinutes(startTime: string): number | null {
  const m = /^(\d{2}):(\d{2})$/.exec(startTime.trim());
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

/** 17:50~18:10 → 사실상 18시 경기 */
export function isAround6pmKst(startTime: string): boolean {
  const mins = parseHmToMinutes(startTime);
  if (mins == null) return false;
  return mins >= WINDOW_START_MIN && mins <= WINDOW_END_MIN;
}

export function resolveFinalStatus(input: {
  analysisAvailable: boolean;
  oddsMatched: boolean;
  edgeScore: number | null;
}): FinalStatus {
  if (!input.analysisAvailable || input.edgeScore == null) {
    return "ANALYSIS_NOT_READY";
  }
  if (!input.oddsMatched) {
    return "ODDS_NOT_AVAILABLE";
  }
  if (Math.abs(input.edgeScore) < RECOMMEND_ABS_EDGE) {
    return "PASS";
  }
  return "RECOMMENDED";
}

function sortGames(games: GameData[]): GameData[] {
  return [...games].sort((a, b) => {
    const league = a.league.localeCompare(b.league);
    if (league !== 0) return league;
    const time = a.startTime.localeCompare(b.startTime);
    if (time !== 0) return time;
    return a.id.localeCompare(b.id);
  });
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

async function buildRow(item: GameWithOdds): Promise<GameReportRow> {
  const { game, odds, oddsMatch } = item;
  const oddsMatched =
    oddsMatch.matched &&
    odds != null &&
    odds.bestHomeOdds != null &&
    odds.bestAwayOdds != null;

  const engineInput = await getEngineAnalysisData(game.id);
  let result: EdgeEngineResult | null = null;
  let analysisDeterministic: boolean | null = null;

  if (engineInput) {
    const first = runEdgeEngine(engineInput);
    const second = runEdgeEngine(engineInput);
    analysisDeterministic =
      first.edgeScore === second.edgeScore &&
      first.confidence === second.confidence &&
      first.winProbability === second.winProbability &&
      first.pickTeamId === second.pickTeamId;
    result = first;
  }

  const analysisAvailable = result != null;
  const recommendation = result
    ? getRecommendationGrade(result.edgeScore)
    : null;

  let marketProbability: number | null = null;
  let valueEdge: number | null = null;

  if (result && oddsMatched && odds) {
    const comparison = buildMarketComparison({
      marketType: "two-way",
      odds: {
        homeOdds: odds.bestHomeOdds,
        awayOdds: odds.bestAwayOdds,
      },
      model: {
        pickTeamId: result.pickTeamId,
        winProbability: result.winProbability,
        marketSupport: "two-way",
      },
    });
    if (comparison.comparable && comparison.marketProbability != null) {
      marketProbability = Math.round(comparison.marketProbability * 100);
    }
    if (
      comparison.comparable &&
      comparison.valueEdgePercentagePoints != null
    ) {
      valueEdge = round1(comparison.valueEdgePercentagePoints);
    }
  }

  const edgeScore = result != null ? round1(result.edgeScore) : null;
  const finalStatus = resolveFinalStatus({
    analysisAvailable,
    oddsMatched,
    edgeScore: result?.edgeScore ?? null,
  });

  return {
    gameId: game.id,
    league: game.league,
    startTime: game.startTime,
    homeTeam: game.homeTeam,
    awayTeam: game.awayTeam,
    homeTeamDisplay: getTeamDisplayName(game.homeTeam),
    awayTeamDisplay: getTeamDisplayName(game.awayTeam),
    matchDisplay: getMatchDisplayLabel(game.homeTeam, game.awayTeam),
    scheduleProvider: game.externalProvider ?? null,
    oddsMatched,
    oddsMatchMethod: oddsMatched ? oddsMatch.method : null,
    bestHomeOdds: oddsMatched && odds ? odds.bestHomeOdds : null,
    bestAwayOdds: oddsMatched && odds ? odds.bestAwayOdds : null,
    analysisAvailable,
    edgeScore,
    confidence: result != null ? Math.round(result.confidence) : null,
    recommendationGrade: recommendation?.grade ?? null,
    modelWinProbability:
      result != null ? Math.round(result.winProbability) : null,
    marketProbability,
    valueEdge,
    finalStatus,
    analysisDeterministic,
  };
}

function printRow(row: GameReportRow): void {
  console.log("─".repeat(56));
  console.log(`${row.league}  ${row.startTime}  ${row.matchDisplay}`);
  console.log(`  id          : ${row.gameId}`);
  console.log(`  원본팀      : ${row.homeTeam} / ${row.awayTeam}`);
  console.log(`  표시명      : ${row.homeTeamDisplay} / ${row.awayTeamDisplay}`);
  console.log(`  Provider    : ${row.scheduleProvider ?? "—"}`);
  console.log(
    `  배당 매칭   : ${row.oddsMatched ? `yes (${row.oddsMatchMethod})` : "no"}`,
  );
  console.log(
    `  최고 배당   : ${
      row.oddsMatched
        ? `홈 ${row.bestHomeOdds?.toFixed(2)} / 원정 ${row.bestAwayOdds?.toFixed(2)}`
        : "—"
    }`,
  );
  console.log(`  분석 데이터 : ${row.analysisAvailable ? "yes" : "no"}`);
  console.log(
    `  EDGE Score  : ${row.edgeScore != null ? row.edgeScore : "—"}`,
  );
  console.log(
    `  Confidence  : ${row.confidence != null ? row.confidence : "—"}`,
  );
  console.log(
    `  추천 등급   : ${row.recommendationGrade ?? "—"}`,
  );
  console.log(
    `  모델 승률   : ${row.modelWinProbability != null ? `${row.modelWinProbability}%` : "—"}`,
  );
  console.log(
    `  시장 확률   : ${row.marketProbability != null ? `${row.marketProbability}%` : "—"}`,
  );
  console.log(
    `  Value Edge  : ${row.valueEdge != null ? `${row.valueEdge}pp` : "—"}`,
  );
  console.log(`  최종 상태   : ${row.finalStatus}`);
  if (row.analysisDeterministic != null) {
    console.log(
      `  결정성      : ${row.analysisDeterministic ? "OK" : "FAIL"}`,
    );
  }
}

async function main() {
  const dateKst = getKstToday();
  const generatedAt = new Date().toISOString();

  console.log("=== YANG EDGE 시제품 — 오늘 18시 야구 테스트 ===");
  console.log(`dateKst: ${dateKst}`);
  console.log(`window : 17:50–18:10 (KST)\n`);

  const provider = getSportsProvider();
  const sportsDbBaseball = await provider.getGames({
    date: dateKst,
    sport: "baseball",
  });

  const { games: allBaseball, meta: complementMeta } =
    await complementBaseballScheduleWithOdds(sportsDbBaseball, dateKst);

  console.log(formatBaseballComplementSummary(complementMeta));
  console.log("");

  const around6pm = sortGames(
    allBaseball.filter((g) => isAround6pmKst(g.startTime)),
  );

  const kbo6 = around6pm.filter((g) => g.league === "KBO").length;
  const npb6 = around6pm.filter((g) => g.league === "NPB").length;
  console.log(`야구 전체(당일): ${allBaseball.length}`);
  console.log(
    `18시 창 필터  : ${around6pm.length} (KBO ${kbo6} / NPB ${npb6})`,
  );
  console.log(
    `검증 기대값   : KBO 5 + NPB 2 = 7 → ${
      kbo6 === 5 && npb6 === 2 && around6pm.length === 7 ? "OK" : "CHECK"
    }\n`,
  );

  // Odds enrichment — 위 complement 와 동일 sportKey 캐시 재사용
  const { items, meta: oddsMeta } = await attachOddsToGames(around6pm);

  const rows: GameReportRow[] = [];
  for (const item of items) {
    const row = await buildRow(item);
    rows.push(row);
    printRow(row);
  }

  const analyzedGames = rows.filter((r) => r.analysisAvailable).length;
  const gamesWithOdds = rows.filter((r) => r.oddsMatched).length;
  const recommendedGames = rows.filter(
    (r) => r.finalStatus === "RECOMMENDED",
  ).length;
  const passGames = rows.filter((r) => r.finalStatus === "PASS").length;
  const notReadyGames = rows.filter(
    (r) => r.finalStatus === "ANALYSIS_NOT_READY",
  ).length;
  const oddsMissingGames = rows.filter(
    (r) => r.finalStatus === "ODDS_NOT_AVAILABLE",
  ).length;

  const determinismOk = rows
    .filter((r) => r.analysisDeterministic != null)
    .every((r) => r.analysisDeterministic === true);

  const report = {
    meta: {
      generatedAt,
      dateKst,
      timeWindowKst: { start: "17:50", end: "18:10" },
      totalGames: rows.length,
      analyzedGames,
      gamesWithOdds,
      recommendedGames,
      passGames,
      analysisNotReadyGames: notReadyGames,
      oddsNotAvailableGames: oddsMissingGames,
      analysisDeterministic: determinismOk,
      apiUsage: {
        baseballScheduleComplement: complementMeta,
        odds: {
          ok: oddsMeta.ok,
          error: oddsMeta.error ?? null,
          requestedSportKeyCount: oddsMeta.requestedSportKeyCount,
          oddsEventCount: oddsMeta.oddsEventCount,
          matchedCount: oddsMeta.matchedCount,
          unmatchedGameCount: oddsMeta.unmatchedGameCount,
          allCached: oddsMeta.allCached,
          byMethod: oddsMeta.byMethod,
          sportKeys: oddsMeta.sportKeys.map((k) => ({
            league: k.league,
            sportKey: k.sportKey,
            ok: k.ok,
            eventCount: k.eventCount,
            cached: k.cached,
            error: k.error ?? null,
          })),
          usage: oddsMeta.usage,
        },
        scheduleProviderKind: provider.kind,
      },
    },
    games: rows,
  };

  const outDir = path.join(process.cwd(), "data", "daily-tests");
  const outFile = path.join(outDir, `${dateKst}-1800-baseball.json`);
  await mkdir(outDir, { recursive: true });
  await writeFile(outFile, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  console.log("\n" + "=".repeat(56));
  console.log(`오늘 18시 야구: ${rows.length}경기`);
  console.log(`분석 가능: ${analyzedGames}경기`);
  console.log(`배당 있음: ${gamesWithOdds}경기`);
  console.log(`추천 기준 통과: ${recommendedGames}경기`);
  console.log(`PASS: ${passGames}경기`);
  console.log(`분석 준비중: ${notReadyGames}경기`);
  if (oddsMissingGames > 0) {
    console.log(`배당 없음(분석있음): ${oddsMissingGames}경기`);
  }
  console.log(
    `분석 결정성: ${determinismOk ? "OK (동일 입력 → 동일 결과)" : "FAIL"}`,
  );
  console.log(
    `Odds usage remaining: ${oddsMeta.usage.requestsRemaining ?? "—"} / used: ${oddsMeta.usage.requestsUsed ?? "—"}`,
  );
  console.log(`저장: ${outFile}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

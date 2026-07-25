import type { FeatureData } from "@/types/feature";
import type { GameData } from "@/types/game";
import type { SportData } from "@/types/sport";
import type { TodayPickData } from "@/types/todayPick";
import type { AnalysisData as EngineAnalysisData } from "@/types/engine-analysis";
import { getEngineAnalysisData } from "@/lib/engine/analysis-data-provider";
import { runEdgeEngine } from "@/lib/edge/run-edge-engine";
import { getRecommendationGrade } from "@/lib/edge/recommendation-grade";
import { resolveAnalysisMarketOdds } from "@/lib/edge/resolve-analysis-market-odds";
import { buildMarketComparison } from "@/lib/market";
import type { EdgeEngineResult } from "@/lib/edge/types";

export type HomeGameEngineRow = {
  game: GameData;
  result: EdgeEngineResult;
  engineInput: EngineAnalysisData;
};

export type HomeFeed = {
  pick: TodayPickData | null;
  featured: FeatureData[];
  sports: SportData[];
  ranked: HomeGameEngineRow[];
};

/** Today EDGE Pick 최소 |EDGE Score| (백테스트 컷오프 후보와 동일) */
export const TODAY_PICK_MIN_ABS_EDGE = 10;

/** Featured 최대 카드 수 */
export const FEATURED_MAX_COUNT = 5;

const FEATURE_ICONS: FeatureData["icon"][] = [
  "dashboard",
  "ai",
  "sync",
  "engine",
];

/** 종목 카드 메타 (구 constants/todayGames — Provider 내부용) */
const SPORT_META: Record<
  GameData["sport"],
  { name: string; league: string }
> = {
  football: { name: "축구", league: "K리그 · EPL · 라리가" },
  baseball: { name: "야구", league: "NPB · KBO · MLB" },
  basketball: { name: "농구", league: "KBL · NBA" },
};

function factorAvailabilityRatio(result: EdgeEngineResult): number {
  const factors = result.factors ?? [];
  if (factors.length === 0) return 0;
  const available = factors.filter((f) => f.available).length;
  return available / factors.length;
}

function commenceKey(game: GameData): string {
  return `${game.date}T${game.startTime}`;
}

/**
 * Today EDGE Pick 후보 선정 (순수·결정적).
 *
 * 1) |edgeScore| >= TODAY_PICK_MIN_ABS_EDGE 만 통과
 * 2) |edgeScore| 내림차순
 * 3) confidence 내림차순
 * 4) dataAvailability(factor 가용 비율) 내림차순
 * 5) 시작 시간 오름차순
 * 6) gameId 오름차순
 *
 * 통과 후보 없으면 null (낮은 EDGE 억지 추천 금지).
 */
export function selectTodayPickRow(
  rows: HomeGameEngineRow[],
  minAbsEdge: number = TODAY_PICK_MIN_ABS_EDGE,
): HomeGameEngineRow | null {
  const eligible = rows.filter(
    (r) => Math.abs(r.result.edgeScore) >= minAbsEdge,
  );
  if (eligible.length === 0) return null;

  const sorted = [...eligible].sort((a, b) => {
    const edgeDiff =
      Math.abs(b.result.edgeScore) - Math.abs(a.result.edgeScore);
    if (edgeDiff !== 0) return edgeDiff;

    const confDiff = b.result.confidence - a.result.confidence;
    if (confDiff !== 0) return confDiff;

    const availDiff =
      factorAvailabilityRatio(b.result) - factorAvailabilityRatio(a.result);
    if (availDiff !== 0) return availDiff;

    const timeDiff = commenceKey(a.game).localeCompare(commenceKey(b.game));
    if (timeDiff !== 0) return timeDiff;

    return a.game.id.localeCompare(b.game.id);
  });

  return sorted[0] ?? null;
}

/**
 * Featured 후보 선정 (순수·결정적).
 *
 * - getRecommendationGrade(edgeScore) 가 PASS 이면 제외
 * - 남은 경기: |EDGE| ↓ → confidence ↓ → 시작 시간 ↑ → gameId ↑
 * - 최대 FEATURED_MAX_COUNT
 */
export function selectFeaturedRows(
  rows: HomeGameEngineRow[],
  maxCount: number = FEATURED_MAX_COUNT,
): HomeGameEngineRow[] {
  const eligible = rows.filter((r) => {
    const grade = getRecommendationGrade(r.result.edgeScore).grade;
    return grade !== "PASS";
  });

  const sorted = [...eligible].sort((a, b) => {
    const edgeDiff =
      Math.abs(b.result.edgeScore) - Math.abs(a.result.edgeScore);
    if (edgeDiff !== 0) return edgeDiff;

    const confDiff = b.result.confidence - a.result.confidence;
    if (confDiff !== 0) return confDiff;

    const timeDiff = commenceKey(a.game).localeCompare(commenceKey(b.game));
    if (timeDiff !== 0) return timeDiff;

    return a.game.id.localeCompare(b.game.id);
  });

  return sorted.slice(0, maxCount);
}

/**
 * 경기 목록에 대해 Engine을 돌리고 Home 피드를 만든다.
 * Dummy / TheSportsDB / API-Sports 모두 동일 흐름.
 */
export async function buildHomeFeed(games: GameData[]): Promise<HomeFeed> {
  const ranked: HomeGameEngineRow[] = [];

  for (const game of games) {
    const engineInput = await getEngineAnalysisData(game.id);
    if (!engineInput) continue;
    const result = runEdgeEngine(engineInput);
    ranked.push({ game, result, engineInput });
  }

  const pickRow = selectTodayPickRow(ranked);
  // Value Edge 는 실제 Pick 1건만 조회 (API 사용량 보호)
  const pick = pickRow ? await toTodayPick(pickRow) : null;

  const featuredRows = selectFeaturedRows(ranked);
  const featured = featuredRows.map((row, index) => toFeatured(row, index));
  const sports = toSportSummaries(games, ranked);

  return { pick, featured, sports, ranked };
}

const NO_MARKET = {
  marketProbability: null,
  valueEdge: null,
  comparisonAvailable: false,
} as const;

/**
 * 대표 Pick 의 시장 확률 / Value Edge.
 * 야구 2-way + 배당 매칭 시에만. Market 계산식·Engine 미변경.
 */
async function toPickMarketFields(
  row: HomeGameEngineRow,
): Promise<
  Pick<
    TodayPickData,
    "marketProbability" | "valueEdge" | "comparisonAvailable"
  >
> {
  if (row.engineInput.sport !== "baseball") return { ...NO_MARKET };

  const odds = await resolveAnalysisMarketOdds(row.engineInput);
  if (!odds) return { ...NO_MARKET };

  const comparison = buildMarketComparison({
    marketType: "two-way",
    odds: { homeOdds: odds.homeOdds, awayOdds: odds.awayOdds },
    model: {
      pickTeamId: row.result.pickTeamId,
      winProbability: row.result.winProbability,
      marketSupport: "two-way",
    },
  });

  if (
    !comparison.comparable ||
    comparison.marketProbability == null ||
    comparison.valueEdgePercentagePoints == null
  ) {
    return { ...NO_MARKET };
  }

  return {
    marketProbability: Math.round(comparison.marketProbability * 100),
    valueEdge: Math.round(comparison.valueEdgePercentagePoints * 10) / 10,
    comparisonAvailable: true,
  };
}

async function toTodayPick(row: HomeGameEngineRow): Promise<TodayPickData> {
  const { game, result } = row;
  const market = await toPickMarketFields(row);
  return {
    gameId: game.id,
    league: game.league,
    homeTeam: game.homeTeam,
    awayTeam: game.awayTeam,
    aiWinRate: Math.round(result.winProbability),
    confidence: Math.round(result.confidence),
    edgeValue: Math.round(Math.abs(result.edgeScore) * 10) / 10,
    reasons: result.reasons.slice(0, 6).map((r) => r.title),
    ...market,
  };
}

function toFeatured(row: HomeGameEngineRow, index: number): FeatureData {
  const { game, result } = row;
  const edge = Math.round(Math.abs(result.edgeScore) * 10) / 10;
  const recommendation = getRecommendationGrade(result.edgeScore);
  return {
    id: game.id,
    title: `${game.homeTeam} vs ${game.awayTeam}`,
    description: `EDGE +${edge} · ${result.pickTeamName} · Confidence ${Math.round(result.confidence)} · ${result.grade}`,
    icon: FEATURE_ICONS[index % FEATURE_ICONS.length],
    gameId: game.id,
    edgeScore: edge,
    pickTeamName: result.pickTeamName,
    homeTeam: game.homeTeam,
    awayTeam: game.awayTeam,
    recommendationGrade: recommendation.grade,
    recommendationColor: recommendation.color,
  };
}

function toSportSummaries(
  games: GameData[],
  ranked: HomeGameEngineRow[],
): SportData[] {
  const analyzedIds = new Set(ranked.map((r) => r.game.id));
  const sports: GameData["sport"][] = ["football", "baseball", "basketball"];

  return sports.map((sportId) => {
    const meta = SPORT_META[sportId];
    const sportGames = games.filter((g) => g.sport === sportId);
    const analyzedGames = sportGames.filter((g) => analyzedIds.has(g.id)).length;
    return {
      id: sportId,
      name: meta.name,
      league: meta.league,
      todayGames: sportGames.length,
      analyzedGames,
    };
  });
}

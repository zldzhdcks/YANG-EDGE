import type { FeatureData } from "@/types/feature";
import type { GameData } from "@/types/game";
import type { SportData } from "@/types/sport";
import type { TodayPickData } from "@/types/todayPick";
import { getEngineAnalysisData } from "@/lib/engine/analysis-data-provider";
import { runEdgeEngine } from "@/lib/edge/run-edge-engine";
import type { EdgeEngineResult } from "@/lib/edge/types";

export type HomeGameEngineRow = {
  game: GameData;
  result: EdgeEngineResult;
};

export type HomeFeed = {
  pick: TodayPickData | null;
  featured: FeatureData[];
  sports: SportData[];
  ranked: HomeGameEngineRow[];
};

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
    ranked.push({ game, result });
  }

  // EDGE Score 절대값 기준 (기회 크기)
  ranked.sort(
    (a, b) => Math.abs(b.result.edgeScore) - Math.abs(a.result.edgeScore),
  );

  const pick = ranked[0] ? toTodayPick(ranked[0]) : null;
  const featured = ranked.slice(0, 5).map((row, index) => toFeatured(row, index));
  const sports = toSportSummaries(games, ranked);

  return { pick, featured, sports, ranked };
}

function toTodayPick(row: HomeGameEngineRow): TodayPickData {
  const { game, result } = row;
  return {
    gameId: game.id,
    league: game.league,
    homeTeam: game.homeTeam,
    awayTeam: game.awayTeam,
    aiWinRate: Math.round(result.winProbability),
    confidence: Math.round(result.confidence),
    edgeValue: Math.round(Math.abs(result.edgeScore) * 10) / 10,
    reasons: result.reasons.slice(0, 6).map((r) => r.title),
  };
}

function toFeatured(row: HomeGameEngineRow, index: number): FeatureData {
  const { game, result } = row;
  const edge = Math.round(Math.abs(result.edgeScore) * 10) / 10;
  return {
    id: game.id,
    title: `${game.homeTeam} vs ${game.awayTeam}`,
    description: `EDGE +${edge} · ${result.pickTeamName} · Confidence ${Math.round(result.confidence)} · ${result.grade}`,
    icon: FEATURE_ICONS[index % FEATURE_ICONS.length],
    gameId: game.id,
    edgeScore: edge,
    pickTeamName: result.pickTeamName,
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

import type { GameData } from "@/types/game";
import { GAMES } from "@/constants/games";
import {
  apiGetExternal,
  apiGetInternal,
  hasExternalApiBaseUrl,
} from "./client";
import {
  fallbackResult,
  successResult,
  type ApiFetchResult,
} from "./types";

export type FetchGamesParams = {
  date?: string;
  sport?: GameData["sport"] | "all";
};

/** @deprecated FetchGamesParams 사용 */
export type FetchTodayGamesParams = FetchGamesParams;

export type GamesResult = ApiFetchResult<GameData[]>;

function getDummyGames(params: FetchGamesParams): GameData[] {
  let games = [...GAMES];

  if (params.date) {
    games = games.filter((game) => game.date === params.date);
  }

  if (params.sport && params.sport !== "all") {
    games = games.filter((game) => game.sport === params.sport);
  }

  return games;
}

function buildQuery(params: FetchGamesParams): string {
  const query = new URLSearchParams();
  if (params.date) query.set("date", params.date);
  if (params.sport && params.sport !== "all") {
    query.set("sport", params.sport);
  }
  const qs = query.toString();
  return qs ? `?${qs}` : "";
}

/**
 * 개별 경기 목록 (GameData[])
 *
 * 1. external-api  NEXT_PUBLIC_API_BASE_URL/games
 * 2. internal-api  /api/games
 * 3. dummy         constants/games
 *
 * 홈 종목 요약(SportData[])은 fetchTodayGames() → /api/today-games
 */
export async function fetchGames(
  params: FetchGamesParams = {},
): Promise<GamesResult> {
  const dummy = getDummyGames(params);
  const query = buildQuery(params);
  const externalPath = `/games${query}`;
  const internalPath = `/api/games${query}`;

  if (hasExternalApiBaseUrl()) {
    try {
      const data = await apiGetExternal<GameData[]>(externalPath);
      return successResult(data, "external-api");
    } catch {
      // fall through to internal-api
    }
  }

  try {
    const data = await apiGetInternal<GameData[]>(internalPath);
    return successResult(data, "internal-api");
  } catch (error) {
    return fallbackResult(dummy, error, internalPath);
  }
}

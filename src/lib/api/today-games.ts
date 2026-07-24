import type { SportData } from "@/types/sport";
import { TODAY_GAMES } from "@/constants/todayGames";
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

export type TodayGamesResult = ApiFetchResult<SportData[]>;

function getDummyTodayGames(): SportData[] {
  return [...TODAY_GAMES];
}

/**
 * 홈 종목별 오늘 경기 요약 (SportData[])
 *
 * 1. external-api  NEXT_PUBLIC_API_BASE_URL/today-games
 * 2. internal-api  /api/today-games
 * 3. dummy         constants/todayGames
 *
 * 개별 경기 목록(GameData[])은 fetchGames() → /api/games
 */
export async function fetchTodayGames(): Promise<TodayGamesResult> {
  const dummy = getDummyTodayGames();
  const externalPath = "/today-games";
  const internalPath = "/api/today-games";

  if (hasExternalApiBaseUrl()) {
    try {
      const data = await apiGetExternal<SportData[]>(externalPath);
      return successResult(data, "external-api");
    } catch {
      // fall through to internal-api
    }
  }

  try {
    const data = await apiGetInternal<SportData[]>(internalPath);
    return successResult(data, "internal-api");
  } catch (error) {
    return fallbackResult(dummy, error, internalPath);
  }
}

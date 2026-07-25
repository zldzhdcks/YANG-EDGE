import type { GameData } from "@/types/game";
import { getSportsProvider } from "@/lib/sports";
import { successResult, type ApiFetchResult } from "./types";

export type FetchGamesParams = {
  date?: string;
  sport?: GameData["sport"] | "all";
  league?: string;
};

/** @deprecated FetchGamesParams 사용 */
export type FetchTodayGamesParams = FetchGamesParams;

export type GamesResult = ApiFetchResult<GameData[]>;

function toSource(
  kind: "dummy" | "thesportsdb" | "apisports",
): ApiFetchResult<unknown>["source"] {
  return kind === "dummy" ? "dummy" : "external-api";
}

/**
 * 개별 경기 목록 — SportsProvider 위임
 */
export async function fetchGames(
  params: FetchGamesParams = {},
): Promise<GamesResult> {
  const provider = getSportsProvider();
  const data = await provider.getGames(params);
  return successResult(data, toSource(provider.kind));
}

import type { SportData } from "@/types/sport";
import { getSportsProvider } from "@/lib/sports";
import { successResult, type ApiFetchResult } from "./types";

export type TodayGamesResult = ApiFetchResult<SportData[]>;

function toSource(
  kind: "dummy" | "thesportsdb" | "apisports",
): ApiFetchResult<unknown>["source"] {
  return kind === "dummy" ? "dummy" : "external-api";
}

/**
 * 홈 종목별 오늘 경기 요약 — SportsProvider 위임
 */
export async function fetchTodayGames(): Promise<TodayGamesResult> {
  const provider = getSportsProvider();
  const data = await provider.getTodayGames();
  return successResult(data, toSource(provider.kind));
}

import type { TodayPickData } from "@/types/todayPick";
import { getSportsProvider } from "@/lib/sports";
import { successResult, type ApiFetchResult } from "./types";

export type TodayPickResult = ApiFetchResult<TodayPickData>;

function toSource(
  kind: "dummy" | "thesportsdb" | "apisports",
): ApiFetchResult<unknown>["source"] {
  return kind === "dummy" ? "dummy" : "external-api";
}

/**
 * 홈 EDGE Pick — SportsProvider 위임
 */
export async function fetchTodayPick(): Promise<TodayPickResult> {
  const provider = getSportsProvider();
  const data = await provider.getTodayPick();
  return successResult(data, toSource(provider.kind));
}

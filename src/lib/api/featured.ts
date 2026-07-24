import type { FeatureData } from "@/types/feature";
import { getSportsProvider } from "@/lib/sports";
import { successResult, type ApiFetchResult } from "./types";

export type FeaturedResult = ApiFetchResult<FeatureData[]>;

function toSource(
  kind: "dummy" | "thesportsdb" | "apisports",
): ApiFetchResult<unknown>["source"] {
  return kind === "dummy" ? "dummy" : "external-api";
}

/**
 * 홈 Featured (EDGE 상위 경기) — SportsProvider 위임
 */
export async function fetchFeatured(): Promise<FeaturedResult> {
  const provider = getSportsProvider();
  const data = await provider.getFeaturedGames();
  return successResult(data, toSource(provider.kind));
}

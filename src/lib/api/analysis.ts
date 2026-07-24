import type { AnalysisData } from "@/types/analysis";
import { getSportsProvider } from "@/lib/sports";
import { successResult, type ApiFetchResult } from "./types";

export type AnalysisResult = ApiFetchResult<AnalysisData | null>;

function toSource(
  kind: "dummy" | "thesportsdb" | "apisports",
): ApiFetchResult<unknown>["source"] {
  return kind === "dummy" ? "dummy" : "external-api";
}

/**
 * 경기별 EDGE Detail — SportsProvider 위임
 */
export async function fetchAnalysis(gameId: string): Promise<AnalysisResult> {
  const provider = getSportsProvider();
  const data = await provider.getAnalysis(gameId);
  return successResult(data, toSource(provider.kind));
}

import type { AnalysisData } from "@/types/analysis";
import { getAnalysisByGameId } from "@/constants/analysis";
import {
  apiGetExternal,
  apiGetInternal,
  hasExternalApiBaseUrl,
} from "./client";
import {
  fallbackResult,
  isNotFoundError,
  successResult,
  type ApiFetchResult,
} from "./types";

export type AnalysisResult = ApiFetchResult<AnalysisData | null>;

function getDummyAnalysis(gameId: string): AnalysisData | null {
  return getAnalysisByGameId(gameId) ?? null;
}

/**
 * 경기별 EDGE Detail
 *
 * 1. external-api  NEXT_PUBLIC_API_BASE_URL/analysis/:gameId
 * 2. internal-api  /api/analysis/:gameId
 * 3. dummy         constants/analysis
 *
 * 404는 "데이터 없음"으로 처리하고 null을 반환한다 (화면 유지).
 */
export async function fetchAnalysis(gameId: string): Promise<AnalysisResult> {
  const dummy = getDummyAnalysis(gameId);
  const externalPath = `/analysis/${encodeURIComponent(gameId)}`;
  const internalPath = `/api/analysis/${encodeURIComponent(gameId)}`;

  if (hasExternalApiBaseUrl()) {
    try {
      const data = await apiGetExternal<AnalysisData>(externalPath);
      return successResult(data, "external-api");
    } catch (error) {
      if (isNotFoundError(error)) {
        return successResult(null, "external-api");
      }
      // fall through to internal-api
    }
  }

  try {
    const data = await apiGetInternal<AnalysisData>(internalPath);
    return successResult(data, "internal-api");
  } catch (error) {
    if (isNotFoundError(error)) {
      return successResult(null, "internal-api");
    }
    return fallbackResult(dummy, error, internalPath);
  }
}

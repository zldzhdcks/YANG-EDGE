import type { FeatureData } from "@/types/feature";
import { FEATURES } from "@/constants/features";
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

export type FeaturedResult = ApiFetchResult<FeatureData[]>;

function getDummyFeatured(): FeatureData[] {
  return [...FEATURES];
}

/**
 * 홈 Why YANG EDGE (FEATURED)
 *
 * 1. external-api  NEXT_PUBLIC_API_BASE_URL/featured
 * 2. internal-api  /api/featured
 * 3. dummy         constants/features
 */
export async function fetchFeatured(): Promise<FeaturedResult> {
  const dummy = getDummyFeatured();
  const externalPath = "/featured";
  const internalPath = "/api/featured";

  if (hasExternalApiBaseUrl()) {
    try {
      const data = await apiGetExternal<FeatureData[]>(externalPath);
      return successResult(data, "external-api");
    } catch {
      // fall through to internal-api
    }
  }

  try {
    const data = await apiGetInternal<FeatureData[]>(internalPath);
    return successResult(data, "internal-api");
  } catch (error) {
    return fallbackResult(dummy, error, internalPath);
  }
}

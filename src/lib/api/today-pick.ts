import type { TodayPickData } from "@/types/todayPick";
import { TODAY_PICK } from "@/constants/todayPick";
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

export type TodayPickResult = ApiFetchResult<TodayPickData>;

function getDummyTodayPick(): TodayPickData {
  return TODAY_PICK;
}

/**
 * 홈 EDGE Pick
 *
 * 1. external-api  NEXT_PUBLIC_API_BASE_URL/today-pick
 * 2. internal-api  /api/today-pick
 * 3. dummy         constants/todayPick
 */
export async function fetchTodayPick(): Promise<TodayPickResult> {
  const dummy = getDummyTodayPick();
  const externalPath = "/today-pick";
  const internalPath = "/api/today-pick";

  if (hasExternalApiBaseUrl()) {
    try {
      const data = await apiGetExternal<TodayPickData>(externalPath);
      return successResult(data, "external-api");
    } catch {
      // fall through to internal-api
    }
  }

  try {
    const data = await apiGetInternal<TodayPickData>(internalPath);
    return successResult(data, "internal-api");
  } catch (error) {
    return fallbackResult(dummy, error, internalPath);
  }
}

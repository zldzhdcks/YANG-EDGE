import type { BudgetOption, TotoRoundData } from "@/types/toto";
import { TOTO_BUDGET_OPTIONS, TOTO_ROUND } from "@/constants/toto";
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

export type TotoResponse = {
  round: TotoRoundData;
  budgetOptions: BudgetOption[];
};

export type TotoResult = ApiFetchResult<TotoResponse>;

function getDummyToto(): TotoResponse {
  return {
    round: TOTO_ROUND,
    budgetOptions: TOTO_BUDGET_OPTIONS,
  };
}

/**
 * EDGE Combo(승무패) 회차
 *
 * 1. external-api  NEXT_PUBLIC_API_BASE_URL/toto/current
 * 2. internal-api  /api/toto/current
 * 3. dummy         constants/toto
 */
export async function fetchToto(): Promise<TotoResult> {
  const dummy = getDummyToto();
  const externalPath = "/toto/current";
  const internalPath = "/api/toto/current";

  if (hasExternalApiBaseUrl()) {
    try {
      const data = await apiGetExternal<TotoResponse>(externalPath);
      return successResult(data, "external-api");
    } catch {
      // fall through to internal-api
    }
  }

  try {
    const data = await apiGetInternal<TotoResponse>(internalPath);
    return successResult(data, "internal-api");
  } catch (error) {
    return fallbackResult(dummy, error, internalPath);
  }
}

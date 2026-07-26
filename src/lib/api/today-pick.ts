import type { TodayPickData, TodayPickLoadResult } from "@/types/todayPick";
import { buildHomeFeed } from "@/lib/home/build-home-feed";
import { getSportsProvider, SportsApiError } from "@/lib/sports";
import { successResult, type ApiFetchResult } from "./types";

export type TodayPickResult = ApiFetchResult<TodayPickData | null>;

const SAFE_ERROR_MESSAGE =
  "경기 데이터를 불러오지 못했습니다. 잠시 후 다시 확인해 주세요.";

function toSource(
  kind: "dummy" | "thesportsdb" | "apisports",
): ApiFetchResult<unknown>["source"] {
  return kind === "dummy" ? "dummy" : "external-api";
}

/**
 * Today EDGE Pick 로드.
 * - success: 추천 기준을 충족한 Pick
 * - empty-games: 오늘 일정 0건 (정상)
 * - empty-pick: 일정은 있으나 |EDGE| 기준 미충족 (정상)
 * - error: 외부 API/네트워크/설정 오류 (Dummy 자동 대체 없음)
 */
export async function loadTodayPick(): Promise<TodayPickLoadResult> {
  const provider = getSportsProvider();
  const providerKind = provider.kind;

  try {
    const games = await provider.getGames();
    if (games.length === 0) {
      return { status: "empty-games", pick: null, providerKind };
    }

    const feed = await buildHomeFeed(games);
    if (!feed.pick) {
      return { status: "empty-pick", pick: null, providerKind };
    }

    return { status: "success", pick: feed.pick, providerKind };
  } catch (error) {
    return {
      status: "error",
      pick: null,
      providerKind,
      message: SAFE_ERROR_MESSAGE,
      httpStatus: todayPickErrorHttpStatus(error),
    };
  }
}

/** upstream 오류 → 클라이언트에 안전한 HTTP 상태 (민감정보 미포함) */
export function todayPickErrorHttpStatus(error: unknown): number {
  if (error instanceof SportsApiError) {
    if (error.status === 0) return 503;
    if (error.status >= 500) return 502;
    if (error.status === 501) return 502;
    if (error.status >= 400) return 502;
  }
  return 502;
}

/**
 * 홈 EDGE Pick — loadTodayPick 위임 (기존 ApiFetchResult 호환)
 */
export async function fetchTodayPick(): Promise<TodayPickResult> {
  const result = await loadTodayPick();
  const source = toSource(result.providerKind);

  if (result.status === "success") {
    return successResult(result.pick, source);
  }

  if (result.status === "error") {
    return {
      data: null,
      status: "error",
      source,
      error: {
        message: result.message,
        statusCode: result.httpStatus,
        path: "today-pick",
      },
    };
  }

  return successResult(null, source);
}

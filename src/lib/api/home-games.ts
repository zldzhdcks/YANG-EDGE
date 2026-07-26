import type { HomeGamesLoadResult } from "@/types/home";
import { buildHomeFeed } from "@/lib/home/build-home-feed";
import { getSportsProvider } from "@/lib/sports";

const SAFE_ERROR_MESSAGE =
  "경기 일정을 불러오지 못했습니다. 잠시 후 다시 확인해 주세요.";

/**
 * 홈 Featured + 오늘 경기 목록 로드.
 *
 * - success: 오늘 일정 존재 (featured 는 빈 배열 가능 — 억지 선정하지 않음)
 * - empty:   오늘 일정 0건 (정상 빈 상태)
 * - error:   외부 API/네트워크/설정 오류 (Dummy 자동 대체 없음)
 *
 * Dummy 데이터는 SPORTS_PROVIDER=dummy 로 provider 가 선택된 경우에만 쓰인다.
 */
export async function loadHomeGames(): Promise<HomeGamesLoadResult> {
  const provider = getSportsProvider();
  const providerKind = provider.kind;

  try {
    const games = await provider.getGames();
    if (games.length === 0) {
      return { status: "empty", providerKind };
    }

    const feed = await buildHomeFeed(games);
    return {
      status: "success",
      featured: feed.featured,
      sports: feed.sports,
      providerKind,
    };
  } catch {
    return { status: "error", message: SAFE_ERROR_MESSAGE, providerKind };
  }
}

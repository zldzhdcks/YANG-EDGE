import { NextResponse } from "next/server";
import {
  FootballApiError,
  getFootballProvider,
  resolveFootballProviderKind,
} from "@/lib/football";

/**
 * GET /api/football/fixtures?date=YYYY-MM-DD
 * GET /api/football/fixtures?date=YYYY-MM-DD&leagueId=39
 * GET /api/football/fixtures?date=YYYY-MM-DD&leagueId=39&season=2025
 *
 * API-Football fixtures → GameData[].
 * - FOOTBALL_API_KEY 서버 전용 (NEXT_PUBLIC_* 금지)
 * - 경기 없음: 200 + [] (Dummy 가짜 경기 미혼합)
 * - 인증/서버 오류만 명확한 HTTP 오류
 * - /games 자동 합치기 없음 (이번 단계)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date")?.trim();

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json(
        { message: "date=YYYY-MM-DD 쿼리가 필요합니다." },
        { status: 400 },
      );
    }

    const leagueRaw = searchParams.get("leagueId");
    const seasonRaw = searchParams.get("season");
    const timezone = searchParams.get("timezone") ?? "Asia/Seoul";

    const leagueId =
      leagueRaw != null && leagueRaw !== ""
        ? Number(leagueRaw)
        : undefined;
    const season =
      seasonRaw != null && seasonRaw !== "" ? Number(seasonRaw) : undefined;

    if (leagueId != null && !Number.isFinite(leagueId)) {
      return NextResponse.json(
        { message: "leagueId 는 숫자여야 합니다." },
        { status: 400 },
      );
    }
    if (season != null && !Number.isFinite(season)) {
      return NextResponse.json(
        { message: "season 은 숫자여야 합니다." },
        { status: 400 },
      );
    }

    const provider = getFootballProvider();
    const result = await provider.getFixtures({
      date,
      leagueId,
      season,
      timezone,
    });

    return NextResponse.json(
      {
        games: result.games,
        fixtures: result.fixtures,
        meta: {
          provider: provider.kind,
          source: result.source,
          cached: result.cached,
          fetchedAt: result.fetchedAt,
          usage: result.usage,
          gameCount: result.games.length,
          params: result.params,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof FootballApiError) {
      const status =
        error.status >= 400 && error.status < 600 ? error.status : 502;
      return NextResponse.json(
        {
          message: error.message,
          path: error.path,
          provider: resolveFootballProviderKind(),
        },
        { status },
      );
    }

    const message =
      error instanceof Error
        ? error.message
        : "축구 일정을 불러오지 못했습니다.";
    const status = /FOOTBALL_API_KEY/i.test(message) ? 503 : 500;

    return NextResponse.json(
      {
        message,
        provider: resolveFootballProviderKind(),
      },
      { status },
    );
  }
}

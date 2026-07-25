import { NextResponse } from "next/server";
import {
  getOddsProvider,
  OddsApiError,
  resolveOddsProviderKind,
} from "@/lib/odds";

/**
 * GET /api/odds?sportKey=baseball_kbo&regions=eu&markets=h2h
 *
 * The Odds API 배당을 서버에서만 조회한다.
 * - ODDS_API_KEY 는 서버 환경변수만 사용 (NEXT_PUBLIC_* 금지)
 * - 실패 시 명확한 HTTP 오류 JSON 반환
 * - SportsProvider / /games 페이지와 독립 (영향 없음)
 * - DummyOddsProvider 는 ODDS_PROVIDER=dummy 명시 시에만
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sportKey = searchParams.get("sportKey")?.trim();

    if (!sportKey) {
      return NextResponse.json(
        { message: "sportKey 쿼리가 필요합니다." },
        { status: 400 },
      );
    }

    const regions = searchParams.get("regions") ?? undefined;
    const markets = searchParams.get("markets") ?? undefined;
    const commenceTimeFrom =
      searchParams.get("commenceTimeFrom") ?? undefined;
    const commenceTimeTo = searchParams.get("commenceTimeTo") ?? undefined;

    const provider = getOddsProvider();
    const result = await provider.getOdds({
      sportKey,
      regions,
      markets,
      commenceTimeFrom,
      commenceTimeTo,
    });

    return NextResponse.json(
      {
        sportKey: result.sportKey,
        events: result.events,
        meta: {
          provider: provider.kind,
          cached: result.cached,
          fetchedAt: result.fetchedAt,
          usage: result.usage,
          eventCount: result.events.length,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof OddsApiError) {
      const status =
        error.status >= 400 && error.status < 600 ? error.status : 502;
      return NextResponse.json(
        {
          message: error.message,
          path: error.path,
          provider: resolveOddsProviderKind(),
        },
        { status },
      );
    }

    const message =
      error instanceof Error
        ? error.message
        : "배당 데이터를 불러오지 못했습니다.";

    // 키 미설정 등
    const status = /ODDS_API_KEY/i.test(message) ? 503 : 500;

    return NextResponse.json(
      {
        message,
        provider: resolveOddsProviderKind(),
      },
      { status },
    );
  }
}

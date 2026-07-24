import { NextResponse } from "next/server";
import { getSportsProvider } from "@/lib/sports";

/**
 * GET /api/today-games
 * Provider를 통해 홈 종목별 오늘 경기 요약을 반환한다.
 */
export async function GET() {
  try {
    const data = await getSportsProvider().getTodayGames();
    return NextResponse.json(data, { status: 200 });
  } catch {
    return NextResponse.json(
      {
        message:
          "오늘 경기 요약 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.",
      },
      { status: 500 },
    );
  }
}

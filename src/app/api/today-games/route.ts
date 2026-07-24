import { NextResponse } from "next/server";
import { TODAY_GAMES } from "@/constants/todayGames";

/**
 * GET /api/today-games
 * 홈 종목별 오늘 경기 요약 — constants/todayGames 더미를 JSON으로 반환한다.
 * (개별 경기 목록은 /api/games)
 *
 * 주의: 외부 스포츠 API 키는 서버 라우트에서만 사용하고
 * NEXT_PUBLIC_* 환경변수에 넣지 않는다.
 */
export async function GET() {
  try {
    return NextResponse.json(TODAY_GAMES, { status: 200 });
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

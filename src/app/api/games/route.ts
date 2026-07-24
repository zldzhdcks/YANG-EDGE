import { NextResponse } from "next/server";
import { getSportsProvider } from "@/lib/sports";
import type { GameData } from "@/types/game";

/**
 * GET /api/games
 *
 * Provider를 통해 경기 목록을 반환한다.
 * 외부 스포츠 API 키는 Provider 서버 측에서만 사용하고
 * NEXT_PUBLIC_* 환경변수에 넣지 않는다.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date") ?? undefined;
    const sportParam = searchParams.get("sport");
    const sport =
      sportParam && sportParam !== "all"
        ? (sportParam as GameData["sport"])
        : "all";

    const games = await getSportsProvider().getGames({ date, sport });
    return NextResponse.json(games, { status: 200 });
  } catch {
    return NextResponse.json(
      {
        message: "경기 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.",
      },
      { status: 500 },
    );
  }
}

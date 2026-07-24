import { NextResponse } from "next/server";
import { GAMES } from "@/constants/games";
import type { GameData } from "@/types/game";

/**
 * GET /api/games
 * 테스트용 내부 API — constants/games 더미를 JSON으로 반환한다.
 *
 * 주의: 외부 스포츠 API 키는 이 라우트 서버 측에서만 사용하고
 * NEXT_PUBLIC_* 환경변수에 넣지 않는다.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date");
    const sport = searchParams.get("sport");

    let games: GameData[] = [...GAMES];

    if (date) {
      games = games.filter((game) => game.date === date);
    }

    if (sport && sport !== "all") {
      games = games.filter((game) => game.sport === sport);
    }

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

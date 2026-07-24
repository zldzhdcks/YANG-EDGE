import { NextResponse } from "next/server";
import { getAnalysisByGameId } from "@/constants/analysis";

type RouteContext = {
  params: Promise<{ gameId: string }>;
};

/**
 * GET /api/analysis/:gameId
 * 테스트용 내부 API — constants/analysis 더미를 JSON으로 반환한다.
 *
 * 주의: 외부 스포츠 API 키는 서버 라우트에서만 사용하고
 * NEXT_PUBLIC_* 환경변수에 넣지 않는다.
 */
export async function GET(_request: Request, context: RouteContext) {
  try {
    const { gameId } = await context.params;
    const analysis = getAnalysisByGameId(gameId);

    if (!analysis) {
      return NextResponse.json(
        {
          message: `경기 분석 데이터를 찾을 수 없습니다. (gameId: ${gameId})`,
        },
        { status: 404 },
      );
    }

    return NextResponse.json(analysis, { status: 200 });
  } catch {
    return NextResponse.json(
      {
        message: "분석 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.",
      },
      { status: 500 },
    );
  }
}

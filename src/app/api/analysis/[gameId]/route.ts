import { NextResponse } from "next/server";
import { getSportsProvider } from "@/lib/sports";

type RouteContext = {
  params: Promise<{ gameId: string }>;
};

/**
 * GET /api/analysis/:gameId
 * Provider를 통해 EDGE Detail을 반환한다.
 */
export async function GET(_request: Request, context: RouteContext) {
  try {
    const { gameId } = await context.params;
    const analysis = await getSportsProvider().getAnalysis(gameId);

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

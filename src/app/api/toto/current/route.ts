import { NextResponse } from "next/server";
import { TOTO_BUDGET_OPTIONS, TOTO_ROUND } from "@/constants/toto";

/**
 * GET /api/toto/current
 * 테스트용 내부 API — constants/toto 더미를 JSON으로 반환한다.
 *
 * 주의: 외부 스포츠 API 키는 서버 라우트에서만 사용하고
 * NEXT_PUBLIC_* 환경변수에 넣지 않는다.
 */
export async function GET() {
  try {
    return NextResponse.json(
      {
        round: TOTO_ROUND,
        budgetOptions: TOTO_BUDGET_OPTIONS,
      },
      { status: 200 },
    );
  } catch {
    return NextResponse.json(
      {
        message:
          "승무패(EDGE Combo) 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.",
      },
      { status: 500 },
    );
  }
}

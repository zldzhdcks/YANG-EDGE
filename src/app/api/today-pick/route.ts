import { NextResponse } from "next/server";
import { TODAY_PICK } from "@/constants/todayPick";

/**
 * GET /api/today-pick
 * 홈 EDGE Pick — constants/todayPick 더미를 JSON으로 반환한다.
 *
 * 주의: 외부 스포츠 API 키는 서버 라우트에서만 사용하고
 * NEXT_PUBLIC_* 환경변수에 넣지 않는다.
 */
export async function GET() {
  try {
    return NextResponse.json(TODAY_PICK, { status: 200 });
  } catch {
    return NextResponse.json(
      {
        message: "EDGE Pick 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.",
      },
      { status: 500 },
    );
  }
}

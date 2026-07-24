import { NextResponse } from "next/server";
import { getSportsProvider } from "@/lib/sports";

/**
 * GET /api/today-pick
 * Provider를 통해 홈 EDGE Pick을 반환한다.
 */
export async function GET() {
  try {
    const data = await getSportsProvider().getTodayPick();
    if (!data) {
      return NextResponse.json(
        { message: "EDGE Pick 데이터를 찾을 수 없습니다." },
        { status: 404 },
      );
    }
    return NextResponse.json(data, { status: 200 });
  } catch {
    return NextResponse.json(
      {
        message: "EDGE Pick 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.",
      },
      { status: 500 },
    );
  }
}

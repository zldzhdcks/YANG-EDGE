import { NextResponse } from "next/server";
import { getSportsProvider } from "@/lib/sports";

/**
 * GET /api/featured
 * Provider를 통해 홈 FEATURED를 반환한다.
 */
export async function GET() {
  try {
    const data = await getSportsProvider().getFeatured();
    return NextResponse.json(data, { status: 200 });
  } catch {
    return NextResponse.json(
      {
        message:
          "FEATURED 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.",
      },
      { status: 500 },
    );
  }
}

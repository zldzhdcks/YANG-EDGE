import { NextResponse } from "next/server";
import { getSportsProvider } from "@/lib/sports";

/**
 * GET /api/toto/current
 * Provider를 통해 EDGE Combo 데이터를 반환한다.
 */
export async function GET() {
  try {
    const data = await getSportsProvider().getToto();
    return NextResponse.json(data, { status: 200 });
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

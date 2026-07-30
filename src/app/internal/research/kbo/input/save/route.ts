import { NextRequest, NextResponse } from "next/server";
import {
  saveKboLineupConfirmation,
  saveKboOperatorMarkets,
  type SaveLineupPayload,
  type SaveMarketsPayload,
} from "@/lib/kbo/operator-input-bridge";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const kind = body?.kind;
    if (kind === "markets") {
      const result = await saveKboOperatorMarkets(body.payload as SaveMarketsPayload);
      return NextResponse.json(result, { status: result.ok ? 200 : 400 });
    }
    if (kind === "lineup") {
      const result = await saveKboLineupConfirmation(body.payload as SaveLineupPayload);
      return NextResponse.json(result, { status: result.ok ? 200 : 400 });
    }
    return NextResponse.json(
      { ok: false, message: "Unknown save kind", errors: ["UNKNOWN_KIND"] },
      { status: 400 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "Save failed",
        errors: ["SAVE_ROUTE_ERROR"],
      },
      { status: 500 },
    );
  }
}

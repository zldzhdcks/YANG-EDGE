import { NextRequest, NextResponse } from "next/server";
import { loadKboT45AdminView } from "@/lib/kbo/t45-personnel/admin-api";
import {
  assertInternalKboT45Access,
  assertSafeDateKst,
} from "@/lib/kbo/t45-personnel/internal-access";

export const dynamic = "force-dynamic";

/** GET /api/internal/kbo/t45-personnel/load?date=YYYY-MM-DD */
export async function GET(request: NextRequest) {
  const denied = assertInternalKboT45Access(request);
  if (denied) return denied;

  const raw = request.nextUrl.searchParams.get("date")?.trim() ?? "";
  const dateCheck = assertSafeDateKst(raw);
  if (!dateCheck.ok) {
    return NextResponse.json(
      { ok: false, errorCode: dateCheck.error, message: "date=YYYY-MM-DD required" },
      { status: 400 },
    );
  }

  const result = await loadKboT45AdminView({ dateKst: dateCheck.dateKst });
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}

import { NextRequest, NextResponse } from "next/server";
import { runKboT45AdminWorkflow } from "@/lib/kbo/t45-personnel/admin-api";
import {
  assertInternalKboT45Access,
  assertSafeDateKst,
} from "@/lib/kbo/t45-personnel/internal-access";

export const dynamic = "force-dynamic";

/** POST /api/internal/kbo/t45-personnel/run — T45 workflow only (no T30) */
export async function POST(request: NextRequest) {
  const denied = assertInternalKboT45Access(request);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        ok: false,
        errorCode: "MALFORMED_JSON",
        message: "Malformed JSON",
        t30AutoRun: false,
      },
      { status: 400 },
    );
  }

  const obj = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const dateCheck = assertSafeDateKst(obj.dateKst);
  if (!dateCheck.ok) {
    return NextResponse.json(
      {
        ok: false,
        errorCode: dateCheck.error,
        message: "dateKst YYYY-MM-DD required",
        t30AutoRun: false,
      },
      { status: 400 },
    );
  }

  if (obj.inputPath != null || obj.path != null || obj.script != null) {
    return NextResponse.json(
      {
        ok: false,
        errorCode: "ARBITRARY_PATH_BLOCKED",
        message: "Client must not supply paths or scripts",
        t30AutoRun: false,
      },
      { status: 400 },
    );
  }

  const dryRun = Boolean(obj.dryRun);
  const gameId =
    typeof obj.gameId === "string" && obj.gameId.trim()
      ? obj.gameId.trim().slice(0, 64)
      : null;
  const adminId =
    typeof obj.adminId === "string" && obj.adminId.trim()
      ? obj.adminId.trim().slice(0, 64)
      : "admin-ui";

  const result = await runKboT45AdminWorkflow({
    dateKst: dateCheck.dateKst,
    dryRun,
    gameId,
    adminId,
  });

  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}

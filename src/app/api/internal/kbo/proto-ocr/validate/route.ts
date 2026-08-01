import { NextRequest, NextResponse } from "next/server";
import {
  assertInternalKboT45Access,
  assertSafeDateKst,
} from "@/lib/kbo/t45-personnel/internal-access";
import { validateProtoOcrDraft } from "@/lib/kbo/proto-ocr/validate-draft";
import type { KboProtoOcrDraftRow } from "@/lib/kbo/proto-ocr/types";

export const dynamic = "force-dynamic";

/** POST /api/internal/kbo/proto-ocr/validate */
export async function POST(request: NextRequest) {
  const denied = assertInternalKboT45Access(request);
  if (denied) return denied;

  const body = (await request.json()) as {
    dateKst?: string;
    rows?: KboProtoOcrDraftRow[];
  };
  const dateCheck = assertSafeDateKst(body.dateKst ?? "");
  if (!dateCheck.ok) {
    return NextResponse.json(
      { ok: false, errorCode: dateCheck.error, mutationPerformed: false },
      { status: 400 },
    );
  }
  if (!Array.isArray(body.rows)) {
    return NextResponse.json(
      { ok: false, errorCode: "ROWS_REQUIRED", mutationPerformed: false },
      { status: 400 },
    );
  }

  const result = await validateProtoOcrDraft({
    dateKst: dateCheck.dateKst,
    rows: body.rows,
  });
  return NextResponse.json(result);
}

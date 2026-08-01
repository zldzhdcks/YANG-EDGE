import { NextRequest, NextResponse } from "next/server";
import {
  assertInternalKboT45Access,
  assertSafeDateKst,
} from "@/lib/kbo/t45-personnel/internal-access";
import { approveProtoOcrDraft } from "@/lib/kbo/proto-ocr/approve";
import type { KboProtoOcrDraftRow } from "@/lib/kbo/proto-ocr/types";

export const dynamic = "force-dynamic";

/** POST /api/internal/kbo/proto-ocr/approve — Domestic Proto merge only; no T45/T30 */
export async function POST(request: NextRequest) {
  const denied = assertInternalKboT45Access(request);
  if (denied) return denied;

  const body = (await request.json()) as {
    dateKst?: string;
    ocrRunId?: string;
    approvedRows?: KboProtoOcrDraftRow[];
    adminId?: string;
    sourceReference?: string;
    screenshotObservedAt?: string;
    explicitConfirmation?: boolean;
    approveAll?: boolean;
  };

  const dateCheck = assertSafeDateKst(body.dateKst ?? "");
  if (!dateCheck.ok) {
    return NextResponse.json(
      { ok: false, errorCode: dateCheck.error, mutationPerformed: false },
      { status: 400 },
    );
  }
  if (!body.ocrRunId || !Array.isArray(body.approvedRows)) {
    return NextResponse.json(
      {
        ok: false,
        errorCode: "INVALID_PAYLOAD",
        mutationPerformed: false,
        t45AutoRun: false,
        t30AutoRun: false,
      },
      { status: 400 },
    );
  }

  const result = await approveProtoOcrDraft({
    dateKst: dateCheck.dateKst,
    ocrRunId: body.ocrRunId,
    approvedRows: body.approvedRows,
    adminId: body.adminId || "admin-ui",
    sourceReference: body.sourceReference,
    screenshotObservedAt: body.screenshotObservedAt,
    explicitConfirmation: Boolean(body.explicitConfirmation),
    approveAll: Boolean(body.approveAll),
  });

  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}

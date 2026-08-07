import { NextResponse } from "next/server";
import {
  loadNpbStarterResearchOverlay,
  saveNpbStarterConfirmation,
  type NpbStarterIntakeDraftGame,
} from "@/lib/npb/manual-starter-intake-v0";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      dateKst?: string;
      sourceLabel?: string;
      verifiedAt?: string;
      drafts?: NpbStarterIntakeDraftGame[];
    };
    const dateKst = body.dateKst?.trim() ?? "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKst)) {
      return NextResponse.json(
        { ok: false, message: "INVALID_DATE", errors: ["INVALID_DATE"] },
        { status: 400 },
      );
    }
    const drafts = Array.isArray(body.drafts) ? body.drafts : [];
    const result = await saveNpbStarterConfirmation({
      dateKst,
      sourceLabel: body.sourceLabel,
      verifiedAt: body.verifiedAt,
      drafts,
      allowLate: false,
    });
    if (!result.ok || !result.document) {
      return NextResponse.json(
        {
          ok: false,
          message: "SAVE_REJECTED",
          errors: result.errors,
          path: null,
        },
        { status: 400 },
      );
    }
    const overlay = await loadNpbStarterResearchOverlay({ dateKst });
    return NextResponse.json({
      ok: true,
      message: `저장 완료 · ${overlay.line}`,
      path: result.pathRel,
      errors: result.errors,
      summary: result.document.summary,
      overlayLine: overlay.line,
    });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        message: e instanceof Error ? e.message : "SAVE_ERROR",
        errors: ["SAVE_ERROR"],
      },
      { status: 500 },
    );
  }
}

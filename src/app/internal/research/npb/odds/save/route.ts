import { NextResponse } from "next/server";
import {
  loadNpbPregameResearchReadiness,
  saveNpbMarketOddsConfirmation,
  type NpbMarketOddsDraftGame,
} from "@/lib/npb/manual-market-odds-v0";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      dateKst?: string;
      sourceLabel?: string;
      verifiedAt?: string;
      drafts?: NpbMarketOddsDraftGame[];
    };
    const dateKst = body.dateKst?.trim() ?? "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKst)) {
      return NextResponse.json(
        { ok: false, message: "INVALID_DATE", errors: ["INVALID_DATE"] },
        { status: 400 },
      );
    }
    const result = await saveNpbMarketOddsConfirmation({
      dateKst,
      sourceLabel: body.sourceLabel,
      verifiedAt: body.verifiedAt,
      drafts: Array.isArray(body.drafts) ? body.drafts : [],
      allowLate: false,
    });
    if (!result.ok || !result.document) {
      return NextResponse.json(
        {
          ok: false,
          message: "SAVE_REJECTED",
          errors: result.errors,
        },
        { status: 400 },
      );
    }
    const readiness = await loadNpbPregameResearchReadiness({ dateKst });
    const s = result.document.summary;
    return NextResponse.json({
      ok: true,
      message: `저장 완료 · ${s.moneylineVerified}/${s.scheduleGames} VERIFIED · PRE_GAME`,
      path: result.pathRel,
      summary: s,
      readiness,
      errors: result.errors,
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

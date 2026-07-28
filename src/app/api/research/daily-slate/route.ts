import { NextRequest, NextResponse } from "next/server";
import { loadBetmanFullSlateArtifact } from "@/lib/betman/daily-slate/build-betman-full-slate-v1";
import { getKstToday } from "@/lib/datetime/kst";

/**
 * GET /api/research/daily-slate?date=YYYY-MM-DD
 * Internal research API — not for public display.
 */
export async function GET(request: NextRequest) {
  const date =
    request.nextUrl.searchParams.get("date")?.trim() || getKstToday();

  try {
    const document = await loadBetmanFullSlateArtifact(date);
    if (!document) {
      return NextResponse.json(
        {
          targetDateKst: date,
          operatorInputStatus: "NOT_ENTERED",
          coverageSummary: null,
          sportCounts: {},
          games: [],
          warnings: ["ARTIFACT_NOT_GENERATED"],
        },
        { status: 404 },
      );
    }

    return NextResponse.json(
      {
        targetDateKst: document.meta.targetDateKst,
        operatorInputStatus: document.meta.operatorInputStatus,
        researchOnly: document.meta.researchOnly,
        legalStatus: document.meta.legalStatus,
        coverageSummary: document.coverageSummary,
        sportCounts: document.sportCounts,
        games: document.games,
        warnings: document.warnings,
      },
      { status: 200 },
    );
  } catch {
    return NextResponse.json(
      { message: "Daily slate artifact could not be loaded." },
      { status: 500 },
    );
  }
}

import { NextResponse } from "next/server";
import { saveMlbKoreanMarketOddsObservation } from "@/lib/mlb/korean-market-odds-observation-v0";

export const dynamic = "force-dynamic";

type Body = {
  dateKst?: string;
  observedAt?: string;
  drafts?: Array<{
    gamePk?: number;
    awayOdds?: number | string | null;
    homeOdds?: number | string | null;
    joinReviewRequired?: boolean;
  }>;
};

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, errors: ["INVALID_JSON"] }, { status: 400 });
  }

  const dateKst = body.dateKst?.trim() ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKst)) {
    return NextResponse.json({ ok: false, errors: ["INVALID_DATE"] }, { status: 400 });
  }

  const drafts = (body.drafts ?? []).map((d) => ({
    gamePk: Number(d.gamePk),
    awayOdds: d.awayOdds ?? null,
    homeOdds: d.homeOdds ?? null,
    joinReviewRequired: Boolean(d.joinReviewRequired),
  }));

  if (drafts.some((d) => !Number.isFinite(d.gamePk))) {
    return NextResponse.json(
      { ok: false, errors: ["INVALID_GAMEPK"] },
      { status: 400 },
    );
  }

  const result = await saveMlbKoreanMarketOddsObservation({
    dateKst,
    observedAt: body.observedAt,
    drafts,
  });

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, errors: result.errors, pathRel: result.pathRel },
      { status: 400 },
    );
  }

  return NextResponse.json({
    ok: true,
    pathRel: result.pathRel,
    summary: result.document?.summary ?? null,
    koreanMarketOddsHash: result.document?.koreanMarketOddsHash ?? null,
    sourceType: "MANUAL_OBSERVATION",
    marketContext: "KOREAN_MARKET",
    marketType: "MONEYLINE",
  });
}

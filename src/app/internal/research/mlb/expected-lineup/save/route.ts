import { NextResponse } from "next/server";
import {
  saveMlbExpectedLineupObservation,
  selectExpectedLineupDraftsFromPastes,
} from "@/lib/mlb/expected-lineup-observation-v0";

export const dynamic = "force-dynamic";

type Body = {
  dateKst?: string;
  observedAt?: string;
  drafts?: Array<{
    gamePk?: number;
    awayPaste?: string;
    homePaste?: string;
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

  const selected = selectExpectedLineupDraftsFromPastes(body.drafts ?? []);
  if (selected.errors.length) {
    return NextResponse.json(
      { ok: false, errors: selected.errors },
      { status: 400 },
    );
  }

  const result = await saveMlbExpectedLineupObservation({
    dateKst,
    observedAt: body.observedAt,
    drafts: selected.drafts,
    allowMissingDrafts: true,
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
    expectedLineupHash: result.document?.expectedLineupHash ?? null,
    lineupStatus: "EXPECTED",
  });
}

import { NextResponse } from "next/server";
import {
  parseExpectedLineupPaste,
  saveMlbExpectedLineupObservation,
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

  const parseErrors: string[] = [];
  const drafts = [];
  for (const raw of body.drafts ?? []) {
    const gamePk = Number(raw.gamePk);
    if (!Number.isFinite(gamePk)) {
      parseErrors.push("INVALID_GAMEPK");
      continue;
    }
    const away = parseExpectedLineupPaste(raw.awayPaste ?? "");
    const home = parseExpectedLineupPaste(raw.homePaste ?? "");
    parseErrors.push(
      ...away.errors.map((e) => `AWAY:${gamePk}:${e}`),
      ...home.errors.map((e) => `HOME:${gamePk}:${e}`),
    );
    drafts.push({
      gamePk,
      awayLineup: away.batters,
      homeLineup: home.batters,
    });
  }

  if (parseErrors.length) {
    return NextResponse.json(
      { ok: false, errors: parseErrors },
      { status: 400 },
    );
  }

  const result = await saveMlbExpectedLineupObservation({
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
    expectedLineupHash: result.document?.expectedLineupHash ?? null,
    lineupStatus: "EXPECTED",
  });
}

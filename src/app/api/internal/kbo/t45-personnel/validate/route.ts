import { NextRequest, NextResponse } from "next/server";
import { validateKboT45AdminPayload } from "@/lib/kbo/t45-personnel/admin-api";
import { assertInternalKboT45Access } from "@/lib/kbo/t45-personnel/internal-access";
import { kboT45Paths } from "@/lib/kbo/t45-personnel/paths";
import { access, readFile } from "node:fs/promises";

export const dynamic = "force-dynamic";

async function exists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

/** POST /api/internal/kbo/t45-personnel/validate — no file writes */
export async function POST(request: NextRequest) {
  const denied = assertInternalKboT45Access(request);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        status: "INVALID",
        globalErrors: ["MALFORMED_JSON"],
        games: [],
        wouldCreateArtifacts: [],
        mutationPerformed: false,
      },
      { status: 400 },
    );
  }

  const payload =
    body &&
    typeof body === "object" &&
    "payload" in (body as object)
      ? (body as { payload: unknown }).payload
      : body;

  const locked = new Set<string>();
  const dateKst =
    payload &&
    typeof payload === "object" &&
    typeof (payload as { dateKst?: unknown }).dateKst === "string"
      ? (payload as { dateKst: string }).dateKst
      : null;
  if (dateKst && /^\d{4}-\d{2}-\d{2}$/.test(dateKst)) {
    const paths = kboT45Paths(dateKst);
    if (await exists(paths.prediction)) {
      try {
        const pred = JSON.parse(await readFile(paths.prediction, "utf8")) as {
          lockPhase?: string;
          games?: { gameId?: string }[];
        };
        if (
          pred.lockPhase === "T30_FINAL_PREGAME_LOCK" ||
          pred.lockPhase === "ADMIN_VERIFIED_PERSONNEL_PROTO_REVISION"
        ) {
          for (const g of pred.games ?? []) {
            if (g.gameId) locked.add(g.gameId);
          }
        }
      } catch {
        /* ignore */
      }
    }
  }

  const result = validateKboT45AdminPayload({
    payload,
    lockedGameIds: locked,
  });

  return NextResponse.json(result, {
    status: result.status === "INVALID" && result.globalErrors.length ? 400 : 200,
  });
}

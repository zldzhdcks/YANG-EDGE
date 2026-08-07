/**
 * PASS outcome tracking for MLB postgame.
 * PASS is a sealed research state — not mixed into Good Pick accuracy.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { asRecord, asString } from "@/lib/mlb/mlb-review-utils";
import type { MlbOfficialResultsDocument } from "@/lib/mlb/mlb-prediction-review-types";

export type MlbPassTrackJoinStatus =
  | "MATCHED"
  | "RESULT_MISSING"
  | "RESULT_NOT_FINAL"
  | "RESULT_JOIN_FAILED";

export type MlbPassTrackRow = {
  gameId: string;
  gamePk: number | null;
  officialStatus: string;
  researchPick: string | null;
  resultStatus: string | null;
  actualWinner: "HOME" | "AWAY" | "DRAW" | null;
  joinStatus: MlbPassTrackJoinStatus;
};

export type MlbPassTrackingV0 = {
  totalPass: number;
  tracked: number;
  pending: number;
  joinFailed: number;
  rows: MlbPassTrackRow[];
  display: string;
  note: string;
};

function asArr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

export async function loadMlbPassTracking(input: {
  dateKst: string;
  cwd?: string;
  results: MlbOfficialResultsDocument | null;
}): Promise<MlbPassTrackingV0> {
  const cwd = input.cwd ?? process.cwd();
  const predRel = `data/predictions/mlb/${input.dateKst}.json`;
  let predictions: unknown[] = [];
  try {
    const doc = asRecord(
      JSON.parse(await readFile(path.join(cwd, predRel), "utf8")),
    );
    predictions = asArr(doc?.predictions);
  } catch {
    predictions = [];
  }

  const resultById = new Map(
    (input.results?.games ?? []).map((g) => [g.internalGameId, g] as const),
  );
  const resultByPk = new Map(
    (input.results?.games ?? []).map((g) => [g.gamePk, g] as const),
  );

  const rows: MlbPassTrackRow[] = [];
  for (const raw of predictions) {
    const row = asRecord(raw);
    if (!row) continue;
    const officialStatus = asString(row.officialStatus) ?? "";
    if (officialStatus !== "PASS") continue;

    const gameId = asString(row.gameId) ?? asString(row.internalGameId) ?? "";
    const gamePkRaw = row.gamePk;
    const gamePk =
      typeof gamePkRaw === "number" && Number.isFinite(gamePkRaw)
        ? gamePkRaw
        : null;
    const researchPick =
      asString(asRecord(row.research)?.pick) ??
      asString(row.researchPick) ??
      null;

    let result =
      (gameId ? resultById.get(gameId) : undefined) ??
      (gamePk != null ? resultByPk.get(gamePk) : undefined) ??
      null;

    let joinStatus: MlbPassTrackJoinStatus = "RESULT_MISSING";
    let resultStatus: string | null = null;
    let actualWinner: "HOME" | "AWAY" | "DRAW" | null = null;

    if (!input.results) {
      joinStatus = "RESULT_MISSING";
    } else if (!result) {
      joinStatus = "RESULT_JOIN_FAILED";
    } else if (result.status !== "FINAL") {
      joinStatus = "RESULT_NOT_FINAL";
      resultStatus = result.status;
    } else {
      joinStatus = "MATCHED";
      resultStatus = result.status;
      actualWinner = result.winner;
    }

    rows.push({
      gameId,
      gamePk,
      officialStatus,
      researchPick,
      resultStatus,
      actualWinner,
      joinStatus,
    });
  }

  const tracked = rows.filter((r) => r.joinStatus === "MATCHED").length;
  const joinFailed = rows.filter(
    (r) => r.joinStatus === "RESULT_JOIN_FAILED",
  ).length;
  const pending = rows.length - tracked - joinFailed;

  return {
    totalPass: rows.length,
    tracked,
    pending,
    joinFailed,
    rows,
    display:
      input.results == null
        ? `${rows.length} PASS sealed (awaiting results)`
        : `Tracked ${tracked}/${rows.length}`,
    note: "PASS tracking is research evidence only — not mixed with Good Pick accuracy.",
  };
}

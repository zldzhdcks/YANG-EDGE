/**
 * League-aware Prediction Snapshot resolver (primary artifacts only).
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import {
  buildResearchPredictionView,
  emptyResearchPredictionView,
  type ResearchPredictionLoadReason,
  type ResearchPredictionView,
} from "./research-prediction-view";

function asRecord(v: unknown): Record<string, unknown> | null {
  return typeof v === "object" && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}
function asString(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

function isPrimaryDailyName(name: string): boolean {
  return /^\d{4}-\d{2}-\d{2}\.json$/.test(name) && !name.includes(".rev-");
}

async function listPrimaryDaily(
  dirRel: string,
  cwd: string,
): Promise<string[]> {
  const abs = path.join(cwd, dirRel);
  try {
    const names = await readdir(abs);
    return names
      .filter(isPrimaryDailyName)
      .map((n) => path.join(dirRel, n).replace(/\\/g, "/"))
      .sort()
      .reverse();
  } catch {
    return [];
  }
}

async function readJson(rel: string, cwd: string): Promise<unknown | null> {
  try {
    return JSON.parse(await readFile(path.join(cwd, rel), "utf8")) as unknown;
  } catch {
    return null;
  }
}

function gameRows(doc: Record<string, unknown>): Record<string, unknown>[] {
  const preds = Array.isArray(doc.predictions) ? doc.predictions : [];
  const games = Array.isArray(doc.games) ? doc.games : [];
  const rows = [...preds, ...games];
  return rows
    .map((r) => asRecord(r))
    .filter((r): r is Record<string, unknown> => !!r);
}

function normalizeLeagueGame(
  row: Record<string, unknown>,
  doc: Record<string, unknown>,
  league: string,
): Record<string, unknown> {
  const home =
    asString(row.homeTeam) ??
    (typeof row.home === "string" ? row.home : null);
  const away =
    asString(row.awayTeam) ??
    (typeof row.away === "string" ? row.away : null);
  return {
    ...row,
    league: asString(row.league) ?? asString(doc.league) ?? league,
    homeTeam: home,
    awayTeam: away,
    dateKst:
      asString(row.dateKst) ??
      asString(row.date) ??
      asString(doc.date) ??
      asString(doc.dateKst),
    startTimeKst:
      asString(row.startTimeKst) ?? asString(row.scheduledStartTime),
  };
}

export type LoadedPredictionArtifact = {
  pred: Record<string, unknown>;
  meta: Record<string, unknown>;
  pathRel: string;
  league: "MLB" | "KBO";
  view: ResearchPredictionView;
  loadReason: ResearchPredictionLoadReason;
};

function leagueFromGameId(gameId: string): "MLB" | "KBO" | "UNKNOWN" {
  if (gameId.startsWith("kbo-")) return "KBO";
  if (gameId.startsWith("mlb-") || /^\d+$/.test(gameId)) return "MLB";
  return "UNKNOWN";
}

export async function resolveResearchPrediction(input: {
  gameId: string;
  cwd?: string;
  predictionHashFn?: (pred: Record<string, unknown>) => string;
}): Promise<LoadedPredictionArtifact | null> {
  const cwd = input.cwd ?? process.cwd();
  const gameId = input.gameId.trim();
  const resolvedLeague: "MLB" | "KBO" | "UNKNOWN" = leagueFromGameId(gameId);

  if (resolvedLeague === "UNKNOWN") {
    return null;
  }
  const league: "MLB" | "KBO" = resolvedLeague;

  const dirRel =
    league === "KBO" ? "data/predictions/kbo" : "data/predictions/mlb";
  const files = await listPrimaryDaily(dirRel, cwd);

  if (files.length === 0) {
    // Distinguish revision-only
    try {
      const abs = path.join(cwd, dirRel);
      const names = await readdir(abs);
      const hasRev = names.some(
        (n) => n.endsWith(".json") && n.includes(".rev-"),
      );
      if (hasRev) {
        return {
          pred: {},
          meta: {},
          pathRel: "",
          league,
          view: emptyResearchPredictionView("REVISION_ONLY_FOUND"),
          loadReason: "REVISION_ONLY_FOUND",
        };
      }
    } catch {
      /* empty */
    }
    return {
      pred: {},
      meta: {},
      pathRel: "",
      league,
      view: emptyResearchPredictionView("PREDICTION_FILE_NOT_FOUND"),
      loadReason: "PREDICTION_FILE_NOT_FOUND",
    };
  }

  for (const rel of files) {
    const doc = asRecord(await readJson(rel, cwd));
    if (!doc) {
      continue;
    }
    const rawDocLeague: string | null = asString(doc.league);
    const docLeague: string = (rawDocLeague ?? league).toUpperCase();
    if (docLeague !== league) continue;

    const rows = gameRows(doc);
    const hit = rows.find((r) => asString(r.gameId) === gameId);
    if (!hit) continue;

    const pred = normalizeLeagueGame(hit, doc, league);
    const runId =
      asString(hit.runId) ?? asString(doc.runId) ?? asString(doc.meta && asRecord(doc.meta)?.runId);
    const meta = {
      ...(asRecord(doc.meta) ?? {}),
      generatedAt:
        asString(asRecord(doc.meta)?.generatedAt) ??
        asString(doc.lockedAt) ??
        asString(doc.predictedAt) ??
        asString(hit.lockedAt) ??
        asString(hit.predictedAt),
      runId,
    };
    const hash = input.predictionHashFn?.(pred) ?? null;
    const view = buildResearchPredictionView({
      pred,
      pathRel: rel,
      runId,
      predictionHash: hash,
    });
    return {
      pred,
      meta,
      pathRel: rel,
      league,
      view,
      loadReason: "OK",
    };
  }

  return {
    pred: {},
    meta: {},
    pathRel: files[0] ?? "",
    league,
    view: emptyResearchPredictionView("GAME_ID_NOT_FOUND"),
    loadReason: "GAME_ID_NOT_FOUND",
  };
}

/** Test helpers */
export function buildViewFromOfficial(input: {
  officialStatus: string;
  officialPick: string | null;
  passReasons?: string[];
}): ResearchPredictionView {
  return buildResearchPredictionView({
    pred: {
      officialStatus: input.officialStatus,
      officialPick: input.officialPick,
      passReasons: input.passReasons ?? ["TEST_REASON"],
      predictedAt: "2026-07-31T08:52:42.165Z",
      lockedAt: "2026-07-31T09:08:50.735Z",
    },
    pathRel: "data/predictions/kbo/2026-07-31.json",
    runId: "test",
    predictionHash: "abc",
  });
}

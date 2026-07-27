/**
 * Load graded MLB research prediction outcomes for a KST date (read-only).
 * Used by /api/games cards — no Engine, no re-grading.
 */
import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";

export type MlbGameResearchOutcome = {
  homeScore: number;
  awayScore: number;
  homeTeam: string;
  awayTeam: string;
  predictedTeam: string;
  predictionHit: boolean;
  feedbackClassification: string | null;
  gameId: string;
  externalId: string | null;
};

function asRecord(v: unknown): Record<string, unknown> | null {
  return typeof v === "object" && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

function asString(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

function asNumber(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function asBoolean(v: unknown): boolean | null {
  return typeof v === "boolean" ? v : null;
}

/**
 * Returns outcomes keyed by externalId and `mlb-{externalId}` / gameId.
 * Only graded rows with scores + predictionHit boolean.
 */
export async function loadMlbResearchOutcomesByDate(
  dateKst: string,
): Promise<Map<string, MlbGameResearchOutcome>> {
  const map = new Map<string, MlbGameResearchOutcome>();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKst)) return map;

  const rel = path.join(
    /*turbopackIgnore: true*/ process.cwd(),
    "data",
    "predictions",
    "mlb",
    `${dateKst}.json`,
  );

  let doc: unknown;
  try {
    doc = JSON.parse(await readFile(rel, "utf8")) as unknown;
  } catch {
    return map;
  }

  const root = asRecord(doc);
  if (!root) return map;
  const preds = Array.isArray(root.predictions) ? root.predictions : [];

  for (const raw of preds) {
    const pred = asRecord(raw);
    if (!pred) continue;
    if (asString(pred.resultStatus) !== "graded") continue;

    const homeScore = asNumber(pred.homeScore);
    const awayScore = asNumber(pred.awayScore);
    const predictionHit = asBoolean(pred.predictionHit);
    const homeTeam = asString(pred.homeTeam);
    const awayTeam = asString(pred.awayTeam);
    const predictedTeam = asString(pred.baselinePick);
    const gameId = asString(pred.gameId);
    if (
      homeScore == null ||
      awayScore == null ||
      predictionHit == null ||
      !homeTeam ||
      !awayTeam ||
      !predictedTeam ||
      !gameId
    ) {
      continue;
    }

    const externalId = asString(pred.externalId);
    const outcome: MlbGameResearchOutcome = {
      homeScore,
      awayScore,
      homeTeam,
      awayTeam,
      predictedTeam,
      predictionHit,
      feedbackClassification: asString(pred.feedbackClassification),
      gameId,
      externalId,
    };

    map.set(gameId, outcome);
    if (externalId) {
      map.set(externalId, outcome);
      map.set(`mlb-${externalId}`, outcome);
    }
  }

  return map;
}

export function lookupMlbResearchOutcome(
  map: Map<string, MlbGameResearchOutcome>,
  game: { externalId?: string; externalProvider?: string; id: string },
): MlbGameResearchOutcome | null {
  if (game.externalProvider === "api-baseball" && game.externalId) {
    return (
      map.get(`mlb-${game.externalId}`) ??
      map.get(game.externalId) ??
      null
    );
  }
  return map.get(game.id) ?? null;
}

/**
 * Load schedule games for Scheduler planning (read-only consumer of schedule artifacts).
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { mlbPredictionSnapshotRel } from "../mlb/mlb-prediction-review-paths";
import type { SchedulerGameInput, SchedulerLeague } from "./types";

function scheduleRel(league: SchedulerLeague, dateKst: string): string {
  return path.join(
    "data",
    "research",
    league.toLowerCase(),
    `${dateKst}-schedule-v1.json`,
  );
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return typeof v === "object" && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

function asNonEmptyString(v: unknown): string | null {
  if (typeof v === "string" && v.trim() !== "") return v.trim();
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return null;
}

/**
 * Canonical Scheduler game ID.
 * MLB Daily Ops filters on internalGameId — prefer that over numeric gamePk.
 * KBO/NPB keep the historical gamePk-first order.
 */
export function canonicalSchedulerGameId(
  league: SchedulerLeague,
  g: Record<string, unknown>,
): string {
  if (league === "MLB") {
    return (
      asNonEmptyString(g.internalGameId) ??
      asNonEmptyString(g.gameId) ??
      asNonEmptyString(g.gamePk) ??
      "unknown"
    );
  }
  return (
    asNonEmptyString(g.gamePk) ??
    asNonEmptyString(g.gameId) ??
    asNonEmptyString(g.internalGameId) ??
    "unknown"
  );
}

export function mlbOfficialPredictionRel(dateKst: string): string {
  return mlbPredictionSnapshotRel(dateKst);
}

function predictionRows(doc: unknown): Array<Record<string, unknown>> {
  const rec = asRecord(doc);
  if (!rec) return [];
  const raw = rec.predictions ?? rec.games;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row) => asRecord(row))
    .filter((row): row is Record<string, unknown> => row != null);
}

/** Structured match: Official V0 gameId, then externalId fallback. */
export function predictionRowMatchesSchedulerGameId(
  row: Record<string, unknown>,
  schedulerGameId: string,
): boolean {
  const want = schedulerGameId.trim();
  if (!want) return false;
  const gameId = asNonEmptyString(row.gameId);
  if (gameId === want) return true;
  const externalId = asNonEmptyString(row.externalId);
  return externalId === want;
}

export async function loadScheduleGames(input: {
  league: SchedulerLeague;
  dateKst: string;
  cwd?: string;
  gameId?: string;
}): Promise<{ games: SchedulerGameInput[]; schedulePath: string }> {
  const cwd = input.cwd ?? process.cwd();
  const schedulePath = path.join(cwd, scheduleRel(input.league, input.dateKst));
  let raw: string;
  try {
    raw = await readFile(schedulePath, "utf8");
  } catch {
    throw new Error(
      `SCHEDULE_ARTIFACT_MISSING: ${scheduleRel(input.league, input.dateKst)}`,
    );
  }
  const doc = JSON.parse(raw) as {
    games?: Array<Record<string, unknown>>;
  };
  if (!Array.isArray(doc.games)) {
    throw new Error(`SCHEDULE_ARTIFACT_INVALID: ${scheduleRel(input.league, input.dateKst)}`);
  }

  let games: SchedulerGameInput[] = doc.games.map((g) => {
    const gameId = canonicalSchedulerGameId(input.league, g);
    const scheduledStartTime = String(
      g.scheduledStartTime ?? g.commenceTimeUtc ?? "",
    );
    return {
      gameId,
      scheduledStartTime,
      statusAbstract: (g.statusAbstract as string | null | undefined) ?? null,
      actualStartTime: (g.actualStartTime as string | null | undefined) ?? null,
      pregameLocked: Boolean(g.pregameLocked),
      lockedPredictionExists: Boolean(g.lockedPredictionExists),
    };
  });

  if (input.gameId) {
    games = games.filter(
      (g) =>
        g.gameId === input.gameId ||
        g.gameId === String(input.gameId),
    );
  }

  return { games, schedulePath };
}

/** Detect locked prediction artifact presence (best-effort, no mutation). */
export async function detectLockedPrediction(input: {
  league: SchedulerLeague;
  dateKst: string;
  gameId: string;
  cwd?: string;
}): Promise<boolean> {
  const cwd = input.cwd ?? process.cwd();
  if (input.league === "MLB") {
    const official = path.join(cwd, mlbOfficialPredictionRel(input.dateKst));
    try {
      const raw = await readFile(official, "utf8");
      const doc = JSON.parse(raw) as unknown;
      return predictionRows(doc).some((row) =>
        predictionRowMatchesSchedulerGameId(row, input.gameId),
      );
    } catch {
      return false;
    }
  }

  const candidates = [
    path.join(
      cwd,
      "data",
      "predictions",
      input.league.toLowerCase(),
      `${input.dateKst}-prediction-snapshot-v1.json`,
    ),
  ];
  for (const p of candidates) {
    try {
      const raw = await readFile(p, "utf8");
      if (raw.includes(String(input.gameId))) return true;
    } catch {
      // continue
    }
  }
  return false;
}

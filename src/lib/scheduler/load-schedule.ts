/**
 * Load schedule games for Scheduler planning (read-only consumer of schedule artifacts).
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import type { SchedulerGameInput, SchedulerLeague } from "./types";

function scheduleRel(league: SchedulerLeague, dateKst: string): string {
  return path.join(
    "data",
    "research",
    league.toLowerCase(),
    `${dateKst}-schedule-v1.json`,
  );
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
    const gameId =
      String(g.gamePk ?? g.gameId ?? g.internalGameId ?? "").trim() ||
      "unknown";
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
  const candidates =
    input.league === "MLB"
      ? [
          path.join(
            cwd,
            "data",
            "predictions",
            "mlb",
            `${input.dateKst}-prediction-snapshot-v1.json`,
          ),
        ]
      : [
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

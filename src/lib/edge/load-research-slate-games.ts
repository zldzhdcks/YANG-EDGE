import { readFile } from "node:fs/promises";
import path from "node:path";
import { isUpcomingGame } from "@/lib/edge/game-upcoming";
import type { ResearchSlateGame } from "@/types/today-edge-pick";

function asRecord(v: unknown): Record<string, unknown> | null {
  return typeof v === "object" && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

function asString(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

export async function loadResearchSlateGames(
  dateKst: string,
  nowMs?: number,
): Promise<ResearchSlateGame[]> {
  const rel = `data/predictions/mlb/${dateKst}.json`;
  let raw: string;
  try {
    raw = await readFile(
      path.join(/*turbopackIgnore: true*/ process.cwd(), rel),
      "utf8",
    );
  } catch {
    return [];
  }

  const doc = asRecord(JSON.parse(raw));
  if (!doc) return [];

  const effectiveNow = nowMs ?? Date.now();
  const games: ResearchSlateGame[] = [];

  for (const row of (doc.predictions as unknown[]) ?? []) {
    const pred = asRecord(row);
    if (!pred) continue;
    const gameId = asString(pred.gameId);
    if (!gameId) continue;

    const gameDate = asString(pred.dateKst) ?? dateKst;
    const startTimeKst = asString(pred.startTimeKst) ?? "";
    const resultStatus = asString(pred.resultStatus) ?? "pending";

    if (
      !isUpcomingGame({
        dateKst: gameDate,
        startTimeKst,
        resultStatus,
        nowMs: effectiveNow,
      })
    ) {
      continue;
    }

    games.push({
      gameId,
      league: asString(pred.league) ?? "MLB",
      homeTeam: asString(pred.homeTeam) ?? "?",
      awayTeam: asString(pred.awayTeam) ?? "?",
      startTimeKst,
    });
  }

  games.sort((a, b) => {
    const timeDiff = a.startTimeKst.localeCompare(b.startTimeKst);
    if (timeDiff !== 0) return timeDiff;
    return a.gameId.localeCompare(b.gameId);
  });

  return games;
}

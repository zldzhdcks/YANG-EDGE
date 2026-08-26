import { readFile } from "node:fs/promises";
import path from "node:path";
import { formatRecentFormSummary } from "./format-display";
import type { PublicRecentForm } from "@/types/public-game-analysis-view";

function asRecord(v: unknown): Record<string, unknown> | null {
  return typeof v === "object" && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

function asString(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

type FormGame = { result: "W" | "D" | "L" };

function parseFormGames(raw: unknown): FormGame[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const games: FormGame[] = [];
  for (const item of raw) {
    const rec = asRecord(item);
    const result = asString(rec?.result);
    if (result !== "W" && result !== "D" && result !== "L") return null;
    games.push({ result });
  }
  return games;
}

function summarize(
  team: string,
  games: FormGame[],
): PublicRecentForm["home"] | null {
  let wins = 0;
  let draws = 0;
  let losses = 0;
  for (const game of games) {
    if (game.result === "W") wins += 1;
    else if (game.result === "D") draws += 1;
    else losses += 1;
  }
  const side = { team, window: games.length, wins, draws, losses };
  return { ...side, summary: formatRecentFormSummary(side) };
}

export async function loadKboRecentFormForOperatorGame(input: {
  dateKst: string;
  operatorGameId: string;
  homeTeam: string;
  awayTeam: string;
  cwd?: string;
}): Promise<PublicRecentForm | null> {
  const cwd = input.cwd ?? process.cwd();
  const rel = `data/research/kbo/${input.dateKst}-api-baseball-recent-form-asof-v1.json`;
  let doc: Record<string, unknown> | null = null;
  try {
    doc = asRecord(JSON.parse(await readFile(path.join(cwd, rel), "utf8")));
  } catch {
    return null;
  }
  if (!doc) return null;
  if (asString(doc.dateKst) !== input.dateKst) return null;

  const rows = Array.isArray(doc.rows) ? doc.rows : [];
  for (const raw of rows) {
    const rec = asRecord(raw);
    if (!rec) continue;
    if (asString(rec.operatorGameId) !== input.operatorGameId) continue;
    if (rec.targetGameExcluded !== true) return null;

    const homeGames = parseFormGames(rec.homeForm);
    const awayGames = parseFormGames(rec.awayForm);
    if (!homeGames || !awayGames) return null;

    const home = summarize(input.homeTeam, homeGames);
    const away = summarize(input.awayTeam, awayGames);
    if (!home || !away) return null;
    return { home, away };
  }
  return null;
}

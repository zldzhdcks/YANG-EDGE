import { access, readFile } from "node:fs/promises";
import path from "node:path";
import type { ScheduleGameRow } from "./schedule-map";

async function exists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

export async function loadKboScheduleGames(
  dateKst: string,
  cwd = process.cwd(),
): Promise<ScheduleGameRow[]> {
  const fp = path.join(cwd, "data/research/kbo", `${dateKst}-schedule-v1.json`);
  if (!(await exists(fp))) return [];
  const doc = JSON.parse(await readFile(fp, "utf8")) as {
    games?: ScheduleGameRow[];
  };
  return (doc.games ?? []).filter((g) => g.gameId && g.home && g.away);
}

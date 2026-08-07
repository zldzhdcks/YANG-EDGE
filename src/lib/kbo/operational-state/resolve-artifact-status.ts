/**
 * Safe artifact read + status helpers for KBO operational state.
 */
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import type { KboOperationalErrorCode } from "./types";

export type ReadOk<T> = {
  ok: true;
  data: T;
  path: string;
  updatedAt: string | null;
};
export type ReadFail = {
  ok: false;
  error: KboOperationalErrorCode | "FILE_NOT_FOUND";
  path: string;
};
export type ReadResult<T> = ReadOk<T> | ReadFail;

export function rec(v: unknown): Record<string, unknown> | null {
  return typeof v === "object" && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}
export function arr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}
export function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}
export function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

export function rel(cwd: string, p: string): string {
  return path.relative(cwd, p).replace(/\\/g, "/");
}

export async function readJsonFile<T>(filePath: string): Promise<ReadResult<T>> {
  try {
    const raw = await readFile(filePath, "utf8");
    const data = JSON.parse(raw) as T;
    let updatedAt: string | null = null;
    try {
      updatedAt = (await stat(filePath)).mtime.toISOString();
    } catch {
      /* ignore */
    }
    return { ok: true, data, path: filePath, updatedAt };
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    if (err?.code === "ENOENT") {
      return { ok: false, error: "FILE_NOT_FOUND", path: filePath };
    }
    if (e instanceof SyntaxError) {
      return { ok: false, error: "MALFORMED_JSON", path: filePath };
    }
    if (err?.code === "EACCES" || err?.code === "EPERM") {
      return { ok: false, error: "PERMISSION_ERROR", path: filePath };
    }
    return { ok: false, error: "READ_ERROR", path: filePath };
  }
}

export async function listScheduleV1Dates(cwd: string): Promise<string[]> {
  const dir = path.join(cwd, "data", "research", "kbo");
  try {
    const files = await readdir(dir);
    return files
      .map((f) => {
        const m = f.match(/^(\d{4}-\d{2}-\d{2})-schedule-v1\.json$/);
        return m?.[1] ?? null;
      })
      .filter((d): d is string => Boolean(d))
      .sort()
      .reverse();
  } catch {
    return [];
  }
}

export function sideHasStarter(side: unknown): boolean {
  const s = rec(side);
  if (!s) return false;
  const starter = rec(s.starter);
  if (!starter) return false;
  return Boolean(str(starter.playerName) || str(starter.playerId));
}

export function sideHasLineup(side: unknown): boolean {
  const s = rec(side);
  if (!s) return false;
  const lineup = s.lineup;
  if (Array.isArray(lineup)) return lineup.length > 0;
  const nested = rec(lineup);
  if (!nested) return false;
  return arr(nested.batters).length > 0 || arr(nested.battingOrder).length > 0;
}

export function gameHasBothStarters(g: Record<string, unknown>): boolean {
  return sideHasStarter(g.home) && sideHasStarter(g.away);
}

export function gameHasBothLineups(g: Record<string, unknown>): boolean {
  return sideHasLineup(g.home) && sideHasLineup(g.away);
}

export function gameHasProto(g: Record<string, unknown>): boolean {
  const proto = rec(g.domesticProto);
  if (!proto) return false;
  return num(proto.homePrice) != null && num(proto.awayPrice) != null;
}

export function extractStarterNames(g: Record<string, unknown>): {
  home: string | null;
  away: string | null;
} {
  const home = rec(g.home);
  const away = rec(g.away);
  const hs = home ? rec(home.starter) : null;
  const as_ = away ? rec(away.starter) : null;
  return {
    home: hs ? str(hs.playerName) : str(g.homeStarterName),
    away: as_ ? str(as_.playerName) : str(g.awayStarterName),
  };
}

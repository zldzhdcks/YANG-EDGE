/**
 * Join operator starter rows to NPB schedule via team identity mapping.
 */
import { readFile } from "node:fs/promises";
import { resolveNpbTeamIdentity } from "@/lib/npb/resolve-npb-team-identity";
import { asRecord, asString } from "@/lib/mlb/mlb-review-utils";
import { npbScheduleAbs } from "./paths";
import type { NpbGameJoinStatus } from "./types";

function asArr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

export type NpbScheduleGameRow = {
  internalGameId: string;
  homeTeam: string;
  awayTeam: string;
  homeTeamCanonicalId: string | null;
  awayTeamCanonicalId: string | null;
  firstPitchAt: string | null;
  joinStatus: NpbGameJoinStatus;
};

function teamKey(name: string): string {
  const id = resolveNpbTeamIdentity(name);
  if (id.mappingStatus === "MATCHED" && id.canonicalTeamId) {
    return id.canonicalTeamId;
  }
  return name
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export async function loadNpbScheduleGames(input: {
  dateKst: string;
  cwd?: string;
}): Promise<{
  exists: boolean;
  pathRel: string;
  games: NpbScheduleGameRow[];
}> {
  const cwd = input.cwd ?? process.cwd();
  const abs = npbScheduleAbs(input.dateKst, cwd);
  const pathRel = `data/research/npb/${input.dateKst}-schedule-v1.json`;
  try {
    const doc = asRecord(JSON.parse(await readFile(abs, "utf8")));
    const rawGames = asArr(doc?.games);
    const byPair = new Map<string, NpbScheduleGameRow[]>();

    for (const raw of rawGames) {
      const g = asRecord(raw);
      if (!g) continue;
      const internalGameId =
        asString(g.internalGameId) ?? asString(g.gameId) ?? "";
      const homeTeam = asString(g.homeTeam) ?? asString(g.home) ?? "";
      const awayTeam = asString(g.awayTeam) ?? asString(g.away) ?? "";
      if (!internalGameId || !homeTeam || !awayTeam) continue;

      const homeId = resolveNpbTeamIdentity(homeTeam);
      const awayId = resolveNpbTeamIdentity(awayTeam);
      const firstPitchAt =
        asString(g.commenceTimeUtc) ??
        asString(g.scheduledStartTime) ??
        asString(g.firstPitchAt);

      const row: NpbScheduleGameRow = {
        internalGameId,
        homeTeam: homeId.canonicalNameEn ?? homeTeam,
        awayTeam: awayId.canonicalNameEn ?? awayTeam,
        homeTeamCanonicalId: homeId.canonicalTeamId,
        awayTeamCanonicalId: awayId.canonicalTeamId,
        firstPitchAt,
        joinStatus: "MATCHED",
      };

      const pairKey = `${teamKey(homeTeam)}|${teamKey(awayTeam)}`;
      const list = byPair.get(pairKey) ?? [];
      list.push(row);
      byPair.set(pairKey, list);
    }

    const games: NpbScheduleGameRow[] = [];
    for (const list of byPair.values()) {
      if (list.length === 1) {
        games.push({ ...list[0]!, joinStatus: "MATCHED" });
      } else if (list.length > 1) {
        const uniqueIds = new Set(list.map((x) => x.internalGameId));
        if (uniqueIds.size === 1) {
          games.push({ ...list[0]!, joinStatus: "MATCHED" });
        } else {
          for (const row of list) {
            games.push({ ...row, joinStatus: "AMBIGUOUS" });
          }
        }
      }
    }

    const byId = new Map<string, NpbScheduleGameRow>();
    for (const g of games) {
      const prev = byId.get(g.internalGameId);
      if (
        !prev ||
        (prev.joinStatus !== "MATCHED" && g.joinStatus === "MATCHED")
      ) {
        byId.set(g.internalGameId, g);
      }
    }

    return {
      exists: true,
      pathRel,
      games: [...byId.values()].sort((a, b) =>
        a.internalGameId.localeCompare(b.internalGameId),
      ),
    };
  } catch {
    return { exists: false, pathRel, games: [] };
  }
}

export function resolveJoinForInternalGameId(
  scheduleGames: NpbScheduleGameRow[],
  internalGameId: string,
): NpbScheduleGameRow | null {
  const matches = scheduleGames.filter(
    (g) => g.internalGameId === internalGameId,
  );
  if (matches.length === 1 && matches[0]!.joinStatus === "MATCHED") {
    return matches[0]!;
  }
  if (matches.length > 1) {
    return { ...matches[0]!, joinStatus: "AMBIGUOUS" };
  }
  return scheduleGames.find((g) => g.internalGameId === internalGameId) ?? null;
}

export function asFiniteMs(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const n = Date.parse(iso);
  return Number.isFinite(n) ? n : null;
}

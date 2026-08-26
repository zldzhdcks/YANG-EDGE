/**
 * Deterministic public gameId ↔ daily C row resolver.
 * Exact ID equality only. No fuzzy / approximate name matching.
 */

import { buildGameId } from "@/lib/game-id";
import { TEAM_ALIASES } from "@/lib/teams/team-aliases";
import { normalizeTeamName } from "@/lib/teams/normalize-team-name";
import type { TeamAliasEntry } from "@/lib/teams/types";
import type { DailyCGameRow } from "./daily-c-types";

export type PublicGameIdMatch = {
  row: DailyCGameRow;
  matchedGameId: string;
};

function sportForC(sport: string): "baseball" | "football" | undefined {
  if (sport === "KBO" || sport === "NPB") return "baseball";
  if (sport === "FOOTBALL") return "football";
  return undefined;
}

function leagueKeysForRow(row: DailyCGameRow): string[] {
  const keys = new Set<string>();
  if (row.sport === "KBO" || row.sport === "NPB") keys.add(row.sport);
  if (row.rawLeagueLabel) keys.add(row.rawLeagueLabel);
  if (row.sport === "FOOTBALL") keys.add("FOOTBALL");
  if (row.sport === "VOLLEYBALL") keys.add("VOLLEYBALL");
  return [...keys];
}

function aliasEntryForName(
  name: string,
  league: string | null,
  sport: "baseball" | "football" | undefined,
): TeamAliasEntry | null {
  const normalized = normalizeTeamName(name);
  if (!normalized) return null;

  const matches = TEAM_ALIASES.filter((entry) => {
    if (sport && entry.sport && entry.sport !== sport) return false;
    if (
      league &&
      entry.league &&
      entry.league.toLowerCase() !== league.toLowerCase()
    ) {
      return false;
    }
    if (normalizeTeamName(entry.displayName) === normalized) return true;
    return entry.originalNames.some((orig) => normalizeTeamName(orig) === normalized);
  });

  if (matches.length === 1) return matches[0];
  return null;
}

function approvedNamesForSide(
  names: Array<string | null | undefined>,
  league: string | null,
  sport: "baseball" | "football" | undefined,
): string[] {
  const out = new Set<string>();
  for (const raw of names) {
    const trimmed = raw?.trim();
    if (!trimmed) continue;
    out.add(trimmed);
    const entry = aliasEntryForName(trimmed, league, sport);
    if (!entry) continue;
    out.add(entry.displayName);
    for (const orig of entry.originalNames) out.add(orig);
  }
  return [...out];
}

export function namesMatchViaApprovedAlias(
  a: string | null | undefined,
  b: string | null | undefined,
  league: string | null,
  sport: "baseball" | "football" | undefined,
): boolean {
  const left = a?.trim();
  const right = b?.trim();
  if (!left || !right) return false;
  if (left === right) return true;
  if (normalizeTeamName(left) === normalizeTeamName(right)) return true;
  const entry = aliasEntryForName(left, league, sport);
  if (!entry) return false;
  if (normalizeTeamName(entry.displayName) === normalizeTeamName(right)) return true;
  return entry.originalNames.some(
    (orig) => normalizeTeamName(orig) === normalizeTeamName(right),
  );
}

export function collectCandidateGameIds(row: DailyCGameRow): Set<string> {
  const ids = new Set<string>();
  ids.add(row.operatorGameId);

  const sport = sportForC(row.sport);
  const leagueHint =
    row.sport === "KBO" || row.sport === "NPB" ? row.sport : row.rawLeagueLabel;
  const homeNames = approvedNamesForSide(
    [row.rawHome, row.canonicalHome, row.marketBenchmark.oddsHomeTeam],
    leagueHint,
    sport,
  );
  const awayNames = approvedNamesForSide(
    [row.rawAway, row.canonicalAway, row.marketBenchmark.oddsAwayTeam],
    leagueHint,
    sport,
  );

  for (const league of leagueKeysForRow(row)) {
    for (const home of homeNames) {
      for (const away of awayNames) {
        ids.add(buildGameId(league, home, away));
      }
    }
  }

  for (const extra of row.extraPublicGameIds) {
    if (extra) ids.add(extra);
  }

  return ids;
}

export function indexDailyCRowsByPublicGameId(
  rows: DailyCGameRow[],
): {
  byGameId: Map<string, DailyCGameRow>;
  collisions: Set<string>;
} {
  const first = new Map<string, DailyCGameRow>();
  const collisions = new Set<string>();

  for (const row of rows) {
    for (const id of collectCandidateGameIds(row)) {
      const existing = first.get(id);
      if (!existing) {
        first.set(id, row);
        continue;
      }
      if (existing.operatorGameId !== row.operatorGameId) {
        collisions.add(id);
      }
    }
  }

  for (const id of collisions) first.delete(id);
  return { byGameId: first, collisions };
}

export function resolveDailyCRowByPublicGameId(
  publicGameId: string,
  rows: DailyCGameRow[],
): PublicGameIdMatch | null {
  const normalized = publicGameId.trim();
  if (!normalized) return null;
  const { byGameId } = indexDailyCRowsByPublicGameId(rows);
  const row = byGameId.get(normalized);
  if (!row) return null;
  return { row, matchedGameId: normalized };
}

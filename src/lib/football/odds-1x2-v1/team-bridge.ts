/**
 * Explicit canonical team → The Odds API reported team name.
 * Exact strings only. No slug generation. No fuzzy similarity.
 *
 * Names are copied from a verified The Odds API /events payload.
 * Do not invent aliases from Schedule display names.
 */
import {
  FOOTBALL_ODDS_TEAM_BRIDGE_VERSION,
  type FootballOddsTeamBridgeEntry,
} from "./types";

export { FOOTBALL_ODDS_TEAM_BRIDGE_VERSION };

const J1_EVENT_2026_08_14 =
  "the-odds-api:/sports/soccer_japan_j_league/events id=b5533f61730b76f4a8f39ed5918218ae";

export const FOOTBALL_ODDS_TEAM_BRIDGE_V1: FootballOddsTeamBridgeEntry[] = [
  {
    canonicalTeamId: "fb-team-v1-api-football-306",
    oddsProvider: "THE_ODDS_API",
    oddsTeamNames: ["Tokyo Verdy"],
    source: J1_EVENT_2026_08_14,
    verifiedAt: "2026-08-13T14:59:35.477Z",
  },
  {
    canonicalTeamId: "fb-team-v1-api-football-281",
    oddsProvider: "THE_ODDS_API",
    oddsTeamNames: ["Kashiwa Reysol"],
    source: J1_EVENT_2026_08_14,
    verifiedAt: "2026-08-13T14:59:35.477Z",
  },
];

export function getOddsTeamNames(
  canonicalTeamId: string,
  entries: FootballOddsTeamBridgeEntry[] = FOOTBALL_ODDS_TEAM_BRIDGE_V1,
): string[] {
  const hit = entries.find((e) => e.canonicalTeamId === canonicalTeamId);
  return hit?.oddsTeamNames.slice() ?? [];
}

export function oddsNameMatchesCanonical(
  oddsReportedName: string,
  canonicalTeamId: string,
  entries: FootballOddsTeamBridgeEntry[] = FOOTBALL_ODDS_TEAM_BRIDGE_V1,
): boolean {
  const names = getOddsTeamNames(canonicalTeamId, entries);
  return names.includes(oddsReportedName);
}

export function assertOddsTeamBridgeIntegrity(
  entries: FootballOddsTeamBridgeEntry[] = FOOTBALL_ODDS_TEAM_BRIDGE_V1,
): void {
  const seenCanonical = new Set<string>();
  const nameToCanonical = new Map<string, string>();
  for (const entry of entries) {
    if (seenCanonical.has(entry.canonicalTeamId)) {
      throw new Error(
        `ODDS_TEAM_BRIDGE_DUPLICATE_CANONICAL:${entry.canonicalTeamId}`,
      );
    }
    seenCanonical.add(entry.canonicalTeamId);
    const seenInEntry = new Set<string>();
    for (const name of entry.oddsTeamNames) {
      if (seenInEntry.has(name)) {
        throw new Error(
          `ODDS_TEAM_BRIDGE_DUPLICATE_NAME_IN_ENTRY:${entry.canonicalTeamId}:${name}`,
        );
      }
      seenInEntry.add(name);
      const prior = nameToCanonical.get(name);
      if (prior != null && prior !== entry.canonicalTeamId) {
        throw new Error(
          `ODDS_TEAM_BRIDGE_NAME_COLLISION:${name}:${prior}:${entry.canonicalTeamId}`,
        );
      }
      nameToCanonical.set(name, entry.canonicalTeamId);
    }
  }
}

assertOddsTeamBridgeIntegrity(FOOTBALL_ODDS_TEAM_BRIDGE_V1);

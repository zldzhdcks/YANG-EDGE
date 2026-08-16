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
const CMP_V0 =
  "data/research/football/2026-08-16-1x2-market-comparison-v0.json";
const MLS_VERIFIED_AT = "2026-08-16T14:27:47.964Z";
const LA_LIGA_VERIFIED_AT = "2026-08-16T14:27:47.334Z";

function comparisonEventSource(oddsProviderEventId: string): string {
  return `${CMP_V0} the-odds-api event id=${oddsProviderEventId}`;
}

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
  {
    canonicalTeamId: "fb-team-v1-api-football-16489",
    oddsProvider: "THE_ODDS_API",
    oddsTeamNames: ["Austin FC"],
    source: comparisonEventSource("0198abf59a592bb8855ebf7430656607"),
    verifiedAt: MLS_VERIFIED_AT,
  },
  {
    canonicalTeamId: "fb-team-v1-api-football-1597",
    oddsProvider: "THE_ODDS_API",
    oddsTeamNames: ["FC Dallas"],
    source: comparisonEventSource("0198abf59a592bb8855ebf7430656607"),
    verifiedAt: MLS_VERIFIED_AT,
  },
  {
    canonicalTeamId: "fb-team-v1-api-football-1604",
    oddsProvider: "THE_ODDS_API",
    oddsTeamNames: ["New York City FC"],
    source: comparisonEventSource("c3be3958beef3c35ea4a9dac6e028863"),
    verifiedAt: MLS_VERIFIED_AT,
  },
  {
    canonicalTeamId: "fb-team-v1-api-football-1599",
    oddsProvider: "THE_ODDS_API",
    oddsTeamNames: ["Philadelphia Union"],
    source: comparisonEventSource("c3be3958beef3c35ea4a9dac6e028863"),
    verifiedAt: MLS_VERIFIED_AT,
  },
  {
    canonicalTeamId: "fb-team-v1-api-football-1607",
    oddsProvider: "THE_ODDS_API",
    oddsTeamNames: ["Chicago Fire"],
    source: comparisonEventSource("af52fb96f1a5ea0fe7e11c6896158211"),
    verifiedAt: MLS_VERIFIED_AT,
  },
  {
    canonicalTeamId: "fb-team-v1-api-football-1617",
    oddsProvider: "THE_ODDS_API",
    oddsTeamNames: ["Portland Timbers"],
    source: comparisonEventSource("af52fb96f1a5ea0fe7e11c6896158211"),
    verifiedAt: MLS_VERIFIED_AT,
  },
  {
    canonicalTeamId: "fb-team-v1-api-football-1595",
    oddsProvider: "THE_ODDS_API",
    oddsTeamNames: ["Seattle Sounders FC"],
    source: comparisonEventSource("235d6733ba040815d12859e40de81c1e"),
    verifiedAt: MLS_VERIFIED_AT,
  },
  {
    canonicalTeamId: "fb-team-v1-api-football-1603",
    oddsProvider: "THE_ODDS_API",
    oddsTeamNames: ["Vancouver Whitecaps FC"],
    source: comparisonEventSource("235d6733ba040815d12859e40de81c1e"),
    verifiedAt: MLS_VERIFIED_AT,
  },
  {
    canonicalTeamId: "fb-team-v1-api-football-4665",
    oddsProvider: "THE_ODDS_API",
    oddsTeamNames: ["Real Racing Club de Santander"],
    source: comparisonEventSource("f32c9c00fd77e4ec1abd5e34d67a6817"),
    verifiedAt: LA_LIGA_VERIFIED_AT,
  },
  {
    canonicalTeamId: "fb-team-v1-api-football-533",
    oddsProvider: "THE_ODDS_API",
    oddsTeamNames: ["Villarreal"],
    source: comparisonEventSource("f32c9c00fd77e4ec1abd5e34d67a6817"),
    verifiedAt: LA_LIGA_VERIFIED_AT,
  },
  {
    canonicalTeamId: "fb-team-v1-api-football-540",
    oddsProvider: "THE_ODDS_API",
    oddsTeamNames: ["Espanyol"],
    source: comparisonEventSource("4e24891d0ee382bfda6305eabbc54754"),
    verifiedAt: LA_LIGA_VERIFIED_AT,
  },
  {
    canonicalTeamId: "fb-team-v1-api-football-539",
    oddsProvider: "THE_ODDS_API",
    oddsTeamNames: ["Levante"],
    source: comparisonEventSource("4e24891d0ee382bfda6305eabbc54754"),
    verifiedAt: LA_LIGA_VERIFIED_AT,
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

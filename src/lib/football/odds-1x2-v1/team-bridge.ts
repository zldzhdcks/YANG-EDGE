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
const LA_LIGA_2026_08_18_EVIDENCE =
  "data/research/football/2026-08-18-la-liga-odds-identity-evidence-v0.json";
const LA_LIGA_2026_08_18_EVENT_ID = "7b9f4d89d66c48e0c496aab1679e4ae4";
const LA_LIGA_2026_08_18_VERIFIED_AT = "2026-08-17T14:17:15.455Z";
const INTAKE_2026_08_25 =
  "data/research/football/2026-08-25-odds-bridge-candidate-intake-v1.json";
/** Provider candidate /events observation time. Not human verification. */
export const INTAKE_2026_08_25_OBSERVED_AT = "2026-08-24T03:03:10.888Z";
/** Official owner manual review of candidate evidence. Minute precision. */
export const MANUAL_REVIEW_2026_08_25_VERIFIED_AT = "2026-08-25T02:20:00.000Z";
const INTAKE_2026_09_05 =
  "data/research/football/2026-09-05-odds-bridge-candidate-intake-v1.json";
/** Provider candidate /events observation time. Not human verification. */
export const INTAKE_2026_09_05_OBSERVED_AT = "2026-09-05T01:26:19.118Z";
/**
 * CTO/human review of 2026-09-05 candidate evidence. Frozen once.
 * Not a generic auto-approval of unanchored kickoff-window events.
 */
export const MANUAL_REVIEW_2026_09_05_VERIFIED_AT = "2026-09-05T01:31:58.382Z";

function comparisonEventSource(oddsProviderEventId: string): string {
  return `${CMP_V0} the-odds-api event id=${oddsProviderEventId}`;
}

function intake20260825EventSource(oddsProviderEventId: string): string {
  return `${INTAKE_2026_08_25} the-odds-api event id=${oddsProviderEventId}`;
}

function intake20260905EventSource(oddsProviderEventId: string): string {
  return `${INTAKE_2026_09_05} the-odds-api event id=${oddsProviderEventId}`;
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
  {
    canonicalTeamId: "fb-team-v1-api-football-544",
    oddsProvider: "THE_ODDS_API",
    oddsTeamNames: ["Deportivo La Coruña"],
    source: `${LA_LIGA_2026_08_18_EVIDENCE} the-odds-api event id=${LA_LIGA_2026_08_18_EVENT_ID}`,
    verifiedAt: LA_LIGA_2026_08_18_VERIFIED_AT,
  },
  {
    canonicalTeamId: "fb-team-v1-api-football-797",
    oddsProvider: "THE_ODDS_API",
    oddsTeamNames: ["Elche CF"],
    source: `${LA_LIGA_2026_08_18_EVIDENCE} the-odds-api event id=${LA_LIGA_2026_08_18_EVENT_ID}`,
    verifiedAt: LA_LIGA_2026_08_18_VERIFIED_AT,
  },
  {
    canonicalTeamId: "fb-team-v1-api-football-497",
    oddsProvider: "THE_ODDS_API",
    oddsTeamNames: ["AS Roma"],
    source: intake20260825EventSource("4164b325d120b7310921429a21496210"),
    verifiedAt: MANUAL_REVIEW_2026_08_25_VERIFIED_AT,
  },
  {
    canonicalTeamId: "fb-team-v1-api-football-502",
    oddsProvider: "THE_ODDS_API",
    oddsTeamNames: ["Fiorentina"],
    source: intake20260825EventSource("4164b325d120b7310921429a21496210"),
    verifiedAt: MANUAL_REVIEW_2026_08_25_VERIFIED_AT,
  },
  {
    canonicalTeamId: "fb-team-v1-api-football-500",
    oddsProvider: "THE_ODDS_API",
    oddsTeamNames: ["Bologna"],
    source: intake20260825EventSource("c23c70e25e6253ea30f33add6c73d299"),
    verifiedAt: MANUAL_REVIEW_2026_08_25_VERIFIED_AT,
  },
  {
    canonicalTeamId: "fb-team-v1-api-football-487",
    oddsProvider: "THE_ODDS_API",
    oddsTeamNames: ["Lazio"],
    source: intake20260825EventSource("c23c70e25e6253ea30f33add6c73d299"),
    verifiedAt: MANUAL_REVIEW_2026_08_25_VERIFIED_AT,
  },
  {
    canonicalTeamId: "fb-team-v1-api-football-36",
    oddsProvider: "THE_ODDS_API",
    oddsTeamNames: ["Fulham"],
    source: intake20260825EventSource("4e4a813bf4218cc527e6f8ef2351170d"),
    verifiedAt: MANUAL_REVIEW_2026_08_25_VERIFIED_AT,
  },
  {
    canonicalTeamId: "fb-team-v1-api-football-49",
    oddsProvider: "THE_ODDS_API",
    oddsTeamNames: ["Chelsea"],
    source: intake20260825EventSource("4e4a813bf4218cc527e6f8ef2351170d"),
    verifiedAt: MANUAL_REVIEW_2026_08_25_VERIFIED_AT,
  },
  {
    canonicalTeamId: "fb-team-v1-api-football-535",
    oddsProvider: "THE_ODDS_API",
    oddsTeamNames: ["Málaga"],
    source: intake20260825EventSource("030285b126b6a2f7e022261006ed770e"),
    verifiedAt: MANUAL_REVIEW_2026_08_25_VERIFIED_AT,
  },
  {
    canonicalTeamId: "fb-team-v1-api-football-727",
    oddsProvider: "THE_ODDS_API",
    oddsTeamNames: ["CA Osasuna"],
    source: intake20260825EventSource("b86f1854fe9f0915d4f9ee47f23a14bf"),
    verifiedAt: MANUAL_REVIEW_2026_08_25_VERIFIED_AT,
  },
  {
    canonicalTeamId: "fb-team-v1-api-football-2766",
    oddsProvider: "THE_ODDS_API",
    oddsTeamNames: ["FC Seoul"],
    source: intake20260825EventSource("d59c12d88d59e5a665b3fd8f626628d5"),
    verifiedAt: MANUAL_REVIEW_2026_08_25_VERIFIED_AT,
  },
  {
    canonicalTeamId: "fb-team-v1-api-football-2745",
    oddsProvider: "THE_ODDS_API",
    oddsTeamNames: ["Bucheon FC 1995"],
    source: intake20260825EventSource("d59c12d88d59e5a665b3fd8f626628d5"),
    verifiedAt: MANUAL_REVIEW_2026_08_25_VERIFIED_AT,
  },
  {
    canonicalTeamId: "fb-team-v1-api-football-503",
    oddsProvider: "THE_ODDS_API",
    oddsTeamNames: ["Torino"],
    source: intake20260905EventSource("cf4132fe69a1fb7d83fe0b38ae612076"),
    verifiedAt: MANUAL_REVIEW_2026_09_05_VERIFIED_AT,
  },
  {
    canonicalTeamId: "fb-team-v1-api-football-52",
    oddsProvider: "THE_ODDS_API",
    oddsTeamNames: ["Crystal Palace"],
    source: intake20260905EventSource("8f68612bf47c3193e7fa2d8783e79373"),
    verifiedAt: MANUAL_REVIEW_2026_09_05_VERIFIED_AT,
  },
  {
    canonicalTeamId: "fb-team-v1-api-football-316",
    oddsProvider: "THE_ODDS_API",
    oddsTeamNames: ["Avispa Fukuoka"],
    source: intake20260905EventSource("7ccec28ed7bd8fb5d12888def80a18fd"),
    verifiedAt: MANUAL_REVIEW_2026_09_05_VERIFIED_AT,
  },
  {
    canonicalTeamId: "fb-team-v1-api-football-305",
    oddsProvider: "THE_ODDS_API",
    oddsTeamNames: ["Mito HollyHock"],
    source: intake20260905EventSource("7ccec28ed7bd8fb5d12888def80a18fd"),
    verifiedAt: MANUAL_REVIEW_2026_09_05_VERIFIED_AT,
  },
  {
    canonicalTeamId: "fb-team-v1-api-football-34",
    oddsProvider: "THE_ODDS_API",
    oddsTeamNames: ["Newcastle United"],
    source: intake20260905EventSource("686358c484cc44fe8e617674c335d531"),
    verifiedAt: MANUAL_REVIEW_2026_09_05_VERIFIED_AT,
  },
  {
    canonicalTeamId: "fb-team-v1-api-football-35",
    oddsProvider: "THE_ODDS_API",
    oddsTeamNames: ["Bournemouth"],
    source: intake20260905EventSource("686358c484cc44fe8e617674c335d531"),
    verifiedAt: MANUAL_REVIEW_2026_09_05_VERIFIED_AT,
  },
  {
    canonicalTeamId: "fb-team-v1-api-football-531",
    oddsProvider: "THE_ODDS_API",
    oddsTeamNames: ["Athletic Bilbao"],
    source: intake20260905EventSource("3a2b53cf7ad98755cf07c3eac948b056"),
    verifiedAt: MANUAL_REVIEW_2026_09_05_VERIFIED_AT,
  },
  {
    canonicalTeamId: "fb-team-v1-api-football-530",
    oddsProvider: "THE_ODDS_API",
    oddsTeamNames: ["Atlético Madrid"],
    source: intake20260905EventSource("3a2b53cf7ad98755cf07c3eac948b056"),
    verifiedAt: MANUAL_REVIEW_2026_09_05_VERIFIED_AT,
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

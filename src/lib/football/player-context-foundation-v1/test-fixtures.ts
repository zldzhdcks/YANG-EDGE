/**
 * Synthetic TEST DATA for football player-context foundation parsers.
 * Not research evidence. Must not be stored under data/research/.
 *
 * synthetic=true  testOnly=true
 */
import { buildFootballRawPlayerContextObservation } from "./capture";
import { toFootballPagingMetaV1, planPlayerPagination } from "./pagination";
import type { FootballRawPlayerContextObservationV1 } from "./types";

export const SYNTHETIC_TEST_ONLY = true as const;
export const SYNTHETIC_FLAG = true as const;

export const SYNTHETIC_TEAM_ID = "33";
export const SYNTHETIC_BLOCKED_TEAM_ID = "276";
export const SYNTHETIC_SEASON = 2025;
export const SYNTHETIC_KICKOFF = "2026-09-01T19:00:00.000Z";
export const SYNTHETIC_PREGAME_AT = "2026-09-01T18:00:00.000Z";
export const SYNTHETIC_POST_KICKOFF_AT = "2026-09-01T19:00:00.000Z";
export const SYNTHETIC_SEALED_KICKOFF = "2026-08-26T10:00:00.000Z";

/** Goalkeeper with saves/conceded. Explicit zeros preserved. */
export const SYNTHETIC_GK_PLAYER = {
  player: {
    id: 1,
    name: "A. Onana",
    firstname: "Andre",
    lastname: "Onana",
    age: 28,
    nationality: "Cameroon",
    height: "190 cm",
    weight: "93 kg",
    injured: false,
    photo: "https://example.test/onana.png",
  },
  statistics: [
    {
      team: { id: 33, name: "Manchester United" },
      league: { id: 39, name: "Premier League", country: "England", season: 2025 },
      games: {
        appearences: 12,
        lineups: 12,
        minutes: 1080,
        number: 24,
        position: "Goalkeeper",
        rating: "6.80",
        captain: false,
      },
      substitutes: { in: 0, out: 0, bench: 2 },
      shots: { total: null, on: null },
      goals: { total: 0, conceded: 14, assists: null, saves: 38 },
      passes: { total: 320, key: 0, accuracy: 78 },
      tackles: { total: null, blocks: null, interceptions: null },
      duels: { total: null, won: null },
      dribbles: { attempts: null, success: null, past: null },
      fouls: { drawn: null, committed: null },
      cards: { yellow: 1, yellowred: 0, red: 0 },
      penalty: { won: null, commited: null, scored: null, missed: null, saved: 2 },
    },
  ],
};

/** Field player with two competition contexts — must not collapse. */
export const SYNTHETIC_MULTI_CONTEXT_PLAYER = {
  player: {
    id: 7,
    name: "B. Fernandes",
    firstname: "Bruno",
    lastname: "Fernandes",
    age: 30,
    nationality: "Portugal",
    height: "179 cm",
    weight: "69 kg",
    injured: false,
    photo: "https://example.test/bruno.png",
  },
  statistics: [
    {
      team: { id: 33, name: "Manchester United" },
      league: { id: 39, name: "Premier League", country: "England", season: 2025 },
      games: {
        appearences: 14,
        lineups: 14,
        minutes: 1250,
        number: 8,
        position: "Midfielder",
        rating: "7.40",
        captain: true,
      },
      substitutes: { in: 0, out: 1, bench: 0 },
      shots: { total: 32, on: 14 },
      goals: { total: 5, conceded: 0, assists: 6, saves: null },
      passes: { total: 810, key: 28, accuracy: 84 },
      tackles: { total: 22, blocks: 3, interceptions: 9 },
      duels: { total: 140, won: 71 },
      dribbles: { attempts: 18, success: 9, past: null },
      fouls: { drawn: 16, committed: 11 },
      cards: { yellow: 3, yellowred: 0, red: 0 },
      penalty: { won: null, commited: null, scored: 2, missed: 0, saved: null },
    },
    {
      team: { id: 33, name: "Manchester United" },
      league: { id: 2, name: "UEFA Champions League", country: "World", season: 2025 },
      games: {
        appearences: 4,
        lineups: 4,
        minutes: 360,
        number: 8,
        position: "Midfielder",
        rating: "7.10",
        captain: true,
      },
      substitutes: { in: 0, out: 0, bench: 0 },
      shots: { total: 8, on: 3 },
      goals: { total: 1, conceded: 0, assists: 1, saves: null },
      passes: { total: 210, key: 7, accuracy: 86 },
      tackles: { total: 6, blocks: 1, interceptions: 2 },
      duels: { total: 40, won: 21 },
      dribbles: { attempts: 4, success: 2, past: null },
      fouls: { drawn: 4, committed: 3 },
      cards: { yellow: 1, yellowred: 0, red: 0 },
      penalty: { won: null, commited: null, scored: 0, missed: 0, saved: null },
    },
  ],
};

/** Missing statistics object — all numeric stats stay null, not 0. */
export const SYNTHETIC_MISSING_STATS_PLAYER = {
  player: {
    id: 99,
    name: "Trialist Unknown",
    firstname: null,
    lastname: null,
    age: null,
    nationality: null,
    height: null,
    weight: null,
    injured: null,
    photo: null,
  },
  statistics: [],
};

/** Field player with null shots/assists (missing, not zero). */
export const SYNTHETIC_NULL_FIELDS_PLAYER = {
  player: {
    id: 10,
    name: "A. Diallo",
    firstname: "Amad",
    lastname: "Diallo",
    age: 22,
    nationality: "Ivory-Coast",
    height: "173 cm",
    weight: "72 kg",
    injured: false,
    photo: "https://example.test/diallo.png",
  },
  statistics: [
    {
      team: { id: 33, name: "Manchester United" },
      league: { id: 39, name: "Premier League", country: "England", season: 2025 },
      games: {
        appearences: 8,
        lineups: 5,
        minutes: 470,
        number: 16,
        position: "Attacker",
        rating: null,
        captain: false,
      },
      substitutes: { in: 3, out: 2, bench: 4 },
      shots: { total: null, on: null },
      goals: { total: 2, conceded: null, assists: null, saves: null },
      passes: { total: null, key: null, accuracy: null },
      tackles: { total: null, blocks: null, interceptions: null },
      duels: { total: null, won: null },
      dribbles: { attempts: 11, success: 6, past: null },
      fouls: { drawn: null, committed: null },
      cards: { yellow: 0, yellowred: 0, red: 0 },
      penalty: { won: null, commited: null, scored: null, missed: null, saved: null },
    },
  ],
};

/** Duplicate provider player item (same id, same context) — preserve both. */
export const SYNTHETIC_DUPLICATE_PLAYER = {
  ...SYNTHETIC_NULL_FIELDS_PLAYER,
};

export const SYNTHETIC_PLAYERS_PAGE_1 = [
  SYNTHETIC_GK_PLAYER,
  SYNTHETIC_MULTI_CONTEXT_PLAYER,
  SYNTHETIC_MISSING_STATS_PLAYER,
];

export const SYNTHETIC_PLAYERS_PAGE_2 = [
  SYNTHETIC_NULL_FIELDS_PLAYER,
  SYNTHETIC_DUPLICATE_PLAYER,
];

export const SYNTHETIC_PLAYERS_ALL_PAGES = [
  ...SYNTHETIC_PLAYERS_PAGE_1,
  ...SYNTHETIC_PLAYERS_PAGE_2,
];

export const SYNTHETIC_PLAYERS_PAGE_1_ENVELOPE = {
  get: "players",
  parameters: { team: "33", season: "2025" },
  errors: [],
  results: 3,
  paging: { current: 1, total: 2 },
  response: SYNTHETIC_PLAYERS_PAGE_1,
  synthetic: true,
  testOnly: true,
};

export const SYNTHETIC_PLAYERS_PAGE_2_ENVELOPE = {
  get: "players",
  parameters: { team: "33", season: "2025", page: "2" },
  errors: [],
  results: 2,
  paging: { current: 2, total: 2 },
  response: SYNTHETIC_PLAYERS_PAGE_2,
  synthetic: true,
  testOnly: true,
};

export const SYNTHETIC_PLAYERS_FIVE_PAGE_ENVELOPE = {
  get: "players",
  parameters: { team: "33", season: "2025" },
  errors: [],
  results: 20,
  paging: { current: 1, total: 5 },
  response: SYNTHETIC_PLAYERS_PAGE_1,
  synthetic: true,
  testOnly: true,
};

export const SYNTHETIC_SQUAD_PLAYERS = [
  { id: 1, name: "A. Onana", age: 28, number: 24, position: "Goalkeeper", photo: "https://example.test/onana.png" },
  { id: 7, name: "B. Fernandes", age: 30, number: 8, position: "Midfielder", photo: "https://example.test/bruno.png" },
  { id: 10, name: "A. Diallo", age: 22, number: 16, position: "Attacker", photo: "https://example.test/diallo.png" },
  { id: null, name: "Nameless Trialist", age: null, number: null, position: null, photo: null },
];

export const SYNTHETIC_SQUAD_RAW = [
  {
    team: { id: 33, name: "Manchester United", logo: "https://example.test/utd.png" },
    players: SYNTHETIC_SQUAD_PLAYERS,
  },
];

export const SYNTHETIC_EMPTY_SQUAD_RAW = [
  {
    team: { id: 33, name: "Manchester United" },
    players: [],
  },
];

export const SYNTHETIC_SQUAD_ENVELOPE = {
  get: "players/squads",
  parameters: { team: "33" },
  errors: [],
  results: 1,
  paging: { current: 1, total: 1 },
  response: SYNTHETIC_SQUAD_RAW,
  synthetic: true,
  testOnly: true,
};

export const SYNTHETIC_COACH_RAW = [
  {
    id: 19,
    name: "E. ten Hag",
    firstname: "Erik",
    lastname: "ten Hag",
    age: 54,
    birth: { date: "1970-02-02", place: "Haaksbergen", country: "Netherlands" },
    nationality: "Netherlands",
    photo: "https://example.test/tenhag.png",
    team: { id: 33, name: "Manchester United" },
    career: [
      { team: { id: 197, name: "Go Ahead Eagles" }, start: "2012-07-01", end: "2013-06-30" },
      { team: { id: 194, name: "Bayern München II" }, start: "2013-07-01", end: "2015-06-30" },
      { team: { id: 1940, name: "Utrecht" }, start: "2015-07-01", end: "2017-12-27" },
      { team: { id: 194, name: "Ajax" }, start: "2017-12-28", end: "2022-05-15" },
      { team: { id: 33, name: "Manchester United" }, start: "2022-07-01", end: null },
    ],
  },
];

export const SYNTHETIC_COACH_ENVELOPE = {
  get: "coachs",
  parameters: { team: "33" },
  errors: [],
  results: 1,
  paging: { current: 1, total: 1 },
  response: SYNTHETIC_COACH_RAW,
  synthetic: true,
  testOnly: true,
};

export const SYNTHETIC_BLOCKED_TEAM_SQUAD_RAW = [
  {
    team: { id: 276, name: "Jeonbuk Motors" },
    players: [{ id: 5001, name: "Blocked Team Player", age: 24, number: 9, position: "Attacker", photo: null }],
  },
];

function playersPagingMeta(totalPages: number, pagesFetched: number, maxPages = 8) {
  const plan = planPlayerPagination({
    current: 1,
    total: totalPages,
    pagingPresent: true,
    maxPages,
  });
  return {
    ...toFootballPagingMetaV1(plan),
    pagesFetched,
    current: pagesFetched,
  };
}

export function syntheticPlayersObservation(
  observedAt: string,
  raw: unknown = SYNTHETIC_PLAYERS_ALL_PAGES,
): FootballRawPlayerContextObservationV1 {
  return buildFootballRawPlayerContextObservation({
    kind: "PLAYERS",
    endpoint: "/players",
    providerTeamId: SYNTHETIC_TEAM_ID,
    leagueId: "39",
    season: SYNTHETIC_SEASON,
    observedAt,
    query: { team: SYNTHETIC_TEAM_ID, season: String(SYNTHETIC_SEASON) },
    paging: playersPagingMeta(2, 2),
    rawResponse: raw,
    syntheticTestData: true,
  });
}

export function syntheticSquadObservation(
  observedAt: string,
  raw: unknown = SYNTHETIC_SQUAD_RAW,
  providerTeamId = SYNTHETIC_TEAM_ID,
): FootballRawPlayerContextObservationV1 {
  return buildFootballRawPlayerContextObservation({
    kind: "SQUADS",
    endpoint: "/players/squads",
    providerTeamId,
    observedAt,
    query: { team: providerTeamId },
    rawResponse: raw,
    syntheticTestData: true,
  });
}

export function syntheticCoachesObservation(
  observedAt: string,
  raw: unknown = SYNTHETIC_COACH_RAW,
  providerTeamId = SYNTHETIC_TEAM_ID,
): FootballRawPlayerContextObservationV1 {
  return buildFootballRawPlayerContextObservation({
    kind: "COACHES",
    endpoint: "/coachs",
    providerTeamId,
    observedAt,
    query: { team: providerTeamId },
    rawResponse: raw,
    syntheticTestData: true,
  });
}

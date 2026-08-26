/**
 * Synthetic TEST DATA for football player/XI foundation parsers.
 * Not research evidence. Must not be stored under data/research/.
 */
import type { FootballRawPointInTimeObservationV1 } from "./types";

export const SYNTHETIC_FIXTURE_ID = "1234567";
export const SYNTHETIC_KICKOFF = "2026-09-01T19:00:00.000Z";
export const SYNTHETIC_PREGAME_AT = "2026-09-01T18:00:00.000Z";
export const SYNTHETIC_POST_KICKOFF_AT = "2026-09-01T19:00:00.000Z";

export const SYNTHETIC_INJURIES_RAW = [
  {
    player: {
      id: 276,
      name: "D. De Gea",
      type: "Missing Fixture",
      reason: "Knee Injury",
    },
    team: { id: 33, name: "Manchester United" },
    fixture: { id: 1234567 },
  },
  {
    player: {
      id: 882,
      name: "M. Rashford",
      type: "Questionable",
      reason: "Knock",
    },
    team: { id: 33, name: "Manchester United" },
    fixture: { id: 1234567 },
  },
  {
    player: {
      id: 909,
      name: "Casemiro",
      type: "Missing Fixture",
      reason: "Suspended",
    },
    team: { id: 33, name: "Manchester United" },
    fixture: { id: 1234567 },
  },
  {
    player: {
      id: 1485,
      name: "Unknown Status Player",
      type: "Medical Review",
      reason: "Unspecified",
    },
    team: { id: 33, name: "Manchester United" },
    fixture: { id: 1234567 },
  },
  {
    player: {
      id: null,
      name: "Nameless Trialist",
      type: "Missing Fixture",
      reason: "Injury",
    },
    team: { id: 33, name: "Manchester United" },
    fixture: { id: 1234567 },
  },
];

export const SYNTHETIC_LINEUPS_RAW = [
  {
    team: { id: 33, name: "Manchester United" },
    coach: { id: 19, name: "E. ten Hag" },
    formation: "4-2-3-1",
    startXI: [
      { player: { id: 1, name: "A. Onana", number: 24, pos: "G", grid: "1:1" } },
      { player: { id: 2, name: "D. Dalot", number: 20, pos: "D", grid: "2:4" } },
      { player: { id: 3, name: "H. Maguire", number: 5, pos: "D", grid: "2:3" } },
      { player: { id: 4, name: "L. Martinez", number: 6, pos: "D", grid: "2:2" } },
      { player: { id: 5, name: "L. Shaw", number: 23, pos: "D", grid: "2:1" } },
      { player: { id: 6, name: "K. Mainoo", number: 37, pos: "M", grid: "3:2" } },
      { player: { id: 7, name: "B. Fernandes", number: 8, pos: "M", grid: "3:1" } },
      { player: { id: 8, name: "A. Garnacho", number: 17, pos: "M", grid: "4:3" } },
      { player: { id: 9, name: "M. Mount", number: 7, pos: "M", grid: "4:2" } },
      { player: { id: 10, name: "A. Diallo", number: 16, pos: "M", grid: "4:1" } },
      { player: { id: 11, name: "R. Hojlund", number: 9, pos: "F", grid: "5:1" } },
    ],
    substitutes: [
      { player: { id: 12, name: "A. Bayindir", number: 1, pos: "G", grid: null } },
      { player: { id: 13, name: "J. Evans", number: 35, pos: "D", grid: null } },
    ],
  },
  {
    team: { id: 40, name: "Liverpool" },
    coach: { id: 7378, name: "A. Slot" },
    formation: "4-3-3",
    startXI: [
      { player: { id: 101, name: "A. Alisson", number: 1, pos: "G", grid: "1:1" } },
      { player: { id: 102, name: "T. Alexander-Arnold", number: 66, pos: "D", grid: "2:4" } },
      { player: { id: 103, name: "V. van Dijk", number: 4, pos: "D", grid: "2:3" } },
      { player: { id: 104, name: "I. Konate", number: 5, pos: "D", grid: "2:2" } },
      { player: { id: 105, name: "A. Robertson", number: 26, pos: "D", grid: "2:1" } },
      { player: { id: 106, name: "R. Gravenberch", number: 38, pos: "M", grid: "3:3" } },
      { player: { id: 107, name: "D. Szoboszlai", number: 8, pos: "M", grid: "3:2" } },
      { player: { id: 108, name: "A. Mac Allister", number: 10, pos: "M", grid: "3:1" } },
      { player: { id: 109, name: "M. Salah", number: 11, pos: "F", grid: "4:3" } },
      { player: { id: 110, name: "D. Nunez", number: 9, pos: "F", grid: "4:2" } },
      { player: { id: 111, name: "L. Diaz", number: 7, pos: "F", grid: "4:1" } },
    ],
    substitutes: [
      { player: { id: 112, name: "C. Kelleher", number: 62, pos: "G", grid: null } },
    ],
  },
];

export function syntheticInjuriesObservation(
  observedAt: string,
): FootballRawPointInTimeObservationV1 {
  const isBefore = Date.parse(observedAt) < Date.parse(SYNTHETIC_KICKOFF);
  return {
    schemaVersion: "yang-edge-football-raw-observation-v1",
    observationId: `synthetic-injuries-${observedAt}`,
    kind: "INJURIES",
    provider: "api-football",
    endpoint: "/injuries",
    providerFixtureId: SYNTHETIC_FIXTURE_ID,
    observedAt,
    fixtureKickoff: SYNTHETIC_KICKOFF,
    isBeforeKickoff: isBefore,
    pregameEligible: isBefore,
    observationPhase: isBefore ? "PRE_GAME" : "POST_KICKOFF_INVALID_FOR_PREGAME",
    appendOnly: true,
    overwriteForbidden: true,
    predictionInput: false,
    engineInput: false,
    researchOnly: true,
    syntheticTestData: true,
    raw: SYNTHETIC_INJURIES_RAW,
  };
}

export function syntheticLineupsObservation(
  observedAt: string,
): FootballRawPointInTimeObservationV1 {
  const isBefore = Date.parse(observedAt) < Date.parse(SYNTHETIC_KICKOFF);
  return {
    schemaVersion: "yang-edge-football-raw-observation-v1",
    observationId: `synthetic-lineups-${observedAt}`,
    kind: "LINEUPS",
    provider: "api-football",
    endpoint: "/fixtures/lineups",
    providerFixtureId: SYNTHETIC_FIXTURE_ID,
    observedAt,
    fixtureKickoff: SYNTHETIC_KICKOFF,
    isBeforeKickoff: isBefore,
    pregameEligible: isBefore,
    observationPhase: isBefore ? "PRE_GAME" : "POST_KICKOFF_INVALID_FOR_PREGAME",
    appendOnly: true,
    overwriteForbidden: true,
    predictionInput: false,
    engineInput: false,
    researchOnly: true,
    syntheticTestData: true,
    raw: SYNTHETIC_LINEUPS_RAW,
  };
}

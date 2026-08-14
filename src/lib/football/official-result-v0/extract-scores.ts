/**
 * API-Football score extraction.
 *
 * Documented provider fields (FixtureRaw.score / goals):
 * - score.fulltime → 90-minute regulation (including stoppage, excluding ET/PEN)
 * - score.extratime → extra-time period payload as provided (no conversion)
 * - score.penalty → penalty shootout
 * - goals → current/final aggregate (not used as 90-minute 1X2)
 *
 * Do not fall back from goals to regularTime.
 */
import type { FixtureRaw } from "../types";
import type {
  FootballAdvancementWinner,
  FootballScorePair,
} from "../result-foundation-v0/types";

function readPair(
  raw: { home?: number | null; away?: number | null } | null | undefined,
): FootballScorePair {
  if (raw == null) return { home: null, away: null };
  return {
    home: raw.home ?? null,
    away: raw.away ?? null,
  };
}

function pairHasAny(p: FootballScorePair): boolean {
  return p.home != null || p.away != null;
}

export function extractApiFootballResultScores(fixture: FixtureRaw): {
  regularTime: FootballScorePair;
  extraTime: FootballScorePair;
  penalties: FootballScorePair;
  finalScore: FootballScorePair;
  reasonCodes: string[];
} {
  const reasonCodes: string[] = [];
  const regularTime = readPair(fixture.score?.fulltime);
  const extraTime = readPair(fixture.score?.extratime);
  const penalties = readPair(fixture.score?.penalty);
  const goals = readPair(fixture.goals);
  const finalScore = pairHasAny(goals) ? goals : { home: null, away: null };

  if (fixture.score == null) {
    reasonCodes.push("PROVIDER_SCORE_OBJECT_MISSING");
  }
  if (!pairHasAny(regularTime)) {
    reasonCodes.push("REGULAR_TIME_MISSING_FROM_FULLTIME");
  }

  return { regularTime, extraTime, penalties, finalScore, reasonCodes };
}

export function extractApiFootballProviderAdvancementWinner(
  fixture: FixtureRaw,
): {
  winner: FootballAdvancementWinner | null;
  reasonCodes: string[];
} {
  const home = fixture.teams?.home?.winner;
  const away = fixture.teams?.away?.winner;
  if (home === true && away === false) {
    return { winner: "HOME", reasonCodes: [] };
  }
  if (home === false && away === true) {
    return { winner: "AWAY", reasonCodes: [] };
  }
  if (
    (home === true && away === true) ||
    (home === true && away == null) ||
    (away === true && home == null)
  ) {
    return {
      winner: null,
      reasonCodes: ["PROVIDER_WINNER_AMBIGUOUS"],
    };
  }
  return { winner: null, reasonCodes: [] };
}

export function scorePairOrNull(pair: FootballScorePair): FootballScorePair | null {
  if (pair.home == null && pair.away == null) return null;
  return { home: pair.home, away: pair.away };
}

export function scorePairsEqual(
  a: FootballScorePair,
  b: FootballScorePair,
): boolean {
  return a.home === b.home && a.away === b.away;
}

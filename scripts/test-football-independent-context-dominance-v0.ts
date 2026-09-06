/**
 * Pure dominance scorer tests. No network.
 * Run: npm run test:football-independent-context-dominance-v0
 */
import assert from "node:assert/strict";
import {
  scoreContextDominance,
  type FootballContextCountsV0,
} from "../src/lib/football/independent-context-dominance-v0";

function counts(
  over: Partial<FootballContextCountsV0> &
    Pick<FootballContextCountsV0, "fixturesPlayed">,
): FootballContextCountsV0 {
  return {
    wins: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    ...over,
  };
}

async function main() {
  const homeBoth = scoreContextDominance({
    home: counts({ fixturesPlayed: 10, wins: 8, goalsFor: 20, goalsAgainst: 5 }),
    away: counts({ fixturesPlayed: 10, wins: 3, goalsFor: 8, goalsAgainst: 12 }),
  });
  assert.equal(homeBoth.decision, "LEAN_HOME");
  assert.equal(homeBoth.metric1Winner, "HOME");
  assert.equal(homeBoth.metric2Winner, "HOME");

  const awayBoth = scoreContextDominance({
    home: counts({ fixturesPlayed: 10, wins: 3, goalsFor: 8, goalsAgainst: 12 }),
    away: counts({ fixturesPlayed: 10, wins: 8, goalsFor: 20, goalsAgainst: 5 }),
  });
  assert.equal(awayBoth.decision, "LEAN_AWAY");
  assert.equal(awayBoth.metric1Winner, "AWAY");
  assert.equal(awayBoth.metric2Winner, "AWAY");

  const split = scoreContextDominance({
    home: counts({ fixturesPlayed: 10, wins: 8, goalsFor: 8, goalsAgainst: 12 }),
    away: counts({ fixturesPlayed: 10, wins: 3, goalsFor: 20, goalsAgainst: 5 }),
  });
  assert.equal(split.decision, "PASS");
  assert.deepEqual(split.reasonCodes, ["NO_STRICT_DOMINANCE"]);
  assert.equal(split.metric1Winner, "HOME");
  assert.equal(split.metric2Winner, "AWAY");

  const tieWinRate = scoreContextDominance({
    home: counts({ fixturesPlayed: 10, wins: 5, goalsFor: 20, goalsAgainst: 5 }),
    away: counts({ fixturesPlayed: 10, wins: 5, goalsFor: 8, goalsAgainst: 12 }),
  });
  assert.equal(tieWinRate.decision, "PASS");
  assert.equal(tieWinRate.metric1Winner, "TIE");
  assert.deepEqual(tieWinRate.reasonCodes, ["NO_STRICT_DOMINANCE"]);

  const tieGd = scoreContextDominance({
    home: counts({ fixturesPlayed: 10, wins: 8, goalsFor: 10, goalsAgainst: 5 }),
    away: counts({ fixturesPlayed: 10, wins: 3, goalsFor: 12, goalsAgainst: 7 }),
  });
  assert.equal(tieGd.decision, "PASS");
  assert.equal(tieGd.metric2Winner, "TIE");
  assert.deepEqual(tieGd.reasonCodes, ["NO_STRICT_DOMINANCE"]);

  const zeroDenom = scoreContextDominance({
    home: counts({ fixturesPlayed: 0, wins: 0, goalsFor: 0, goalsAgainst: 0 }),
    away: counts({ fixturesPlayed: 10, wins: 5, goalsFor: 10, goalsAgainst: 5 }),
  });
  assert.equal(zeroDenom.decision, "PASS");
  assert.deepEqual(zeroDenom.reasonCodes, ["INSUFFICIENT_INDEPENDENT_DATA"]);
  assert.equal(zeroDenom.metric1Winner, "INSUFFICIENT");

  const missing = scoreContextDominance({
    home: {
      fixturesPlayed: 10,
      wins: null,
      goalsFor: 10,
      goalsAgainst: 5,
    },
    away: counts({ fixturesPlayed: 10, wins: 5, goalsFor: 8, goalsAgainst: 4 }),
  });
  assert.equal(missing.decision, "PASS");
  assert.deepEqual(missing.reasonCodes, ["INSUFFICIENT_INDEPENDENT_DATA"]);

  const negativeDenomRejected = scoreContextDominance({
    home: counts({
      fixturesPlayed: -1,
      wins: 1,
      goalsFor: 1,
      goalsAgainst: 0,
    }),
    away: counts({ fixturesPlayed: 10, wins: 1, goalsFor: 1, goalsAgainst: 0 }),
  });
  assert.equal(negativeDenomRejected.decision, "PASS");
  assert.deepEqual(negativeDenomRejected.reasonCodes, [
    "INSUFFICIENT_INDEPENDENT_DATA",
  ]);

  console.log("PASS football-independent-context-dominance-v0");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

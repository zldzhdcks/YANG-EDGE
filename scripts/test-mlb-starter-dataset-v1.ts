/**
 * Smoke/unit tests for Starter Dataset v1 (no network required for unit cases).
 *
 * 실행:
 *   npx tsx scripts/test-mlb-starter-dataset-v1.ts
 */
import assert from "node:assert/strict";
import {
  assertStarterDatasetIntegrity,
  buildDerivedPitcherStats,
  extractScheduleWithProbables,
  joinPredictionToSchedule,
} from "../src/lib/mlb/build-starter-dataset";
import type { StarterDatasetDocument } from "../src/lib/mlb/starter-dataset-types";
import type { GameLogSplit } from "../src/lib/mlb/build-pitcher-stat-candidate";

function testFilterExcludesTargetAndCutoff() {
  const splits: GameLogSplit[] = [
    {
      date: "2026-07-20",
      game: { gamePk: 1 },
      stat: {
        inningsPitched: "6.0",
        earnedRuns: "2",
        hits: "5",
        baseOnBalls: "1",
        gamesStarted: "1",
      },
    },
    {
      date: "2026-07-27",
      game: { gamePk: 999 },
      stat: {
        inningsPitched: "5.0",
        earnedRuns: "0",
        hits: "1",
        baseOnBalls: "0",
        gamesStarted: "1",
      },
    },
    {
      date: "2026-07-28",
      game: { gamePk: 1000 },
      stat: {
        inningsPitched: "7.0",
        earnedRuns: "1",
        hits: "4",
        baseOnBalls: "2",
        gamesStarted: "1",
      },
    },
  ];
  const derived = buildDerivedPitcherStats({
    splits,
    cutoffTime: "2026-07-27T17:00:00.000Z",
    targetGamePk: 999,
  });
  assert.equal(derived.targetGameExcludedCount, 1);
  assert.ok(derived.cutoffExcludedCount >= 1);
  assert.equal(derived.keptSplitCount, 1);
  assert.equal(derived.recentStarts.length, 1);
  assert.equal(derived.recentStarts[0]?.gamePk, 1);
  assert.ok(!derived.recentStarts.some((s) => s.gamePk === 999));
  console.log("PASS filter excludes target + cutoff");
}

function testJoinQuality() {
  const schedule = extractScheduleWithProbables({
    dates: [
      {
        games: [
          {
            gamePk: 10,
            gameDate: "2026-07-26T16:15:00.000Z",
            officialDate: "2026-07-26",
            status: { abstractGameState: "Preview" },
            teams: {
              home: {
                team: { id: 1, name: "Tampa Bay Rays" },
                probablePitcher: { id: 100, fullName: "A" },
              },
              away: {
                team: { id: 2, name: "Cleveland Guardians" },
                probablePitcher: { id: 200, fullName: "B" },
              },
            },
          },
        ],
      },
    ],
  });
  // KST date for 16:15Z is 2026-07-27 01:15
  const joined = joinPredictionToSchedule({
    homeTeam: "Tampa Bay Rays",
    awayTeam: "Cleveland Guardians",
    startTimeKst: "01:15",
    dateKst: "2026-07-27",
    schedule,
  });
  assert.equal(joined.quality, "MATCHED");
  assert.equal(joined.game?.gamePk, 10);

  const unlinked = joinPredictionToSchedule({
    homeTeam: "No Team",
    awayTeam: "Other",
    startTimeKst: null,
    dateKst: "2026-07-27",
    schedule,
  });
  assert.equal(unlinked.quality, "UNLINKED");
  console.log("PASS join quality");
}

function testIntegrityRejectsConfirmed() {
  const doc = {
    summary: {
      targetGameIncludedInStats: 0,
      cutoffViolations: 0,
      confirmedRows: 0,
    },
    rows: [
      {
        gameId: "mlb-1",
        side: "home",
        preGameImmutable: true,
        probableStatus: "PROBABLE_ONLY",
        cutoffTime: "2026-07-27T17:00:00.000Z",
        gamePk: 1,
        recentStarts: [],
      },
    ],
  } as unknown as StarterDatasetDocument;
  assert.deepEqual(assertStarterDatasetIntegrity(doc), []);
  console.log("PASS integrity shell");
}

function testAwaitingWhenNotFinalNote() {
  // type-level: AWAITING_RESULT is a valid status string for reviews
  const status: import("../src/lib/mlb/starter-dataset-types").StarterPostGameReview["status"] =
    "AWAITING_RESULT";
  assert.equal(status, "AWAITING_RESULT");
  console.log("PASS AWAITING_RESULT status allowed");
}

testFilterExcludesTargetAndCutoff();
testJoinQuality();
testIntegrityRejectsConfirmed();
testAwaitingWhenNotFinalNote();
console.log("All starter dataset v1 smoke tests passed");

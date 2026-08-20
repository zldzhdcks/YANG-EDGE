/**
 * MLB Batter Dataset v0 tests.
 * No Engine mutation. Default path does not call paid providers.
 *
 *   npm run test:mlb-batter-dataset-v0
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { MLB_PREDICTION_V0_WEIGHTS } from "../src/lib/mlb/prediction-v0/config";
import type { LineupDatasetDocument, LineupDatasetRow } from "../src/lib/mlb/lineup-dataset-types";
import {
  assertBatterDatasetIntegrity,
  buildBatterDatasetV0,
  filterHittingGameLogAsOf,
  statsThroughDateForGame,
  type BatterDatasetSources,
} from "../src/lib/mlb/batter-dataset-v0";

const ROOT = process.cwd();
const DATE = "2026-08-20";
const GEN = "2026-08-20T13:50:00.000Z";
const FUTURE_NOW = Date.parse("2026-08-20T12:00:00.000Z");

function sha256File(rel: string): string {
  const raw = readFileSync(path.join(ROOT, rel), "utf8");
  return createHash("sha256").update(raw, "utf8").digest("hex");
}

function hittingBody(splits: Array<{ date: string; gamePk: number; pa: number; ab: number; h: number; tb: number; bb: number; so: number; hr: number; hbp: number; sf: number }>) {
  return {
    stats: [
      {
        splits: splits.map((s) => ({
          date: s.date,
          game: { gamePk: s.gamePk },
          stat: {
            gamesPlayed: 1,
            plateAppearances: s.pa,
            atBats: s.ab,
            hits: s.h,
            doubles: 0,
            triples: 0,
            homeRuns: s.hr,
            runs: 1,
            rbi: 1,
            baseOnBalls: s.bb,
            strikeOuts: s.so,
            hitByPitch: s.hbp,
            sacFlies: s.sf,
            totalBases: s.tb,
          },
        })),
      },
    ],
  };
}

function personBody(code: string, name: string, pos: string) {
  return {
    people: [
      {
        fullName: name,
        batSide: { code },
        primaryPosition: { abbreviation: pos },
      },
    ],
  };
}

function lineupRow(input: {
  gamePk: number;
  gameId: string;
  side: "home" | "away";
  teamId: number;
  teamName: string;
  opponentTeamId: number;
  opponentTeamName: string;
  phase: "PRE_GAME" | "POST_GAME";
  confirmed: boolean;
  playerIds: number[];
}): LineupDatasetRow {
  return {
    schemaVersion: "mlb-lineup-dataset-v1",
    builderVersion: "lineup-dataset-builder-v1",
    generatedAt: GEN,
    gameDate: "2026-08-21",
    gameId: input.gameId,
    gamePk: input.gamePk,
    teamId: input.teamId,
    teamName: input.teamName,
    opponentTeamId: input.opponentTeamId,
    opponentTeamName: input.opponentTeamName,
    side: input.side,
    lineupType: "ACTUAL_STARTING",
    collectionPhase: input.phase,
    preGameStatus: "NOT_COLLECTED",
    collectionStatus: input.confirmed ? "CONFIRMED" : "NOT_RELEASED",
    confirmed: input.confirmed,
    lineupSource: input.confirmed ? "mlb-statsapi-schedule-lineups" : null,
    sourceTimestamp: GEN,
    fetchedAt: GEN,
    lineupConfirmedAt: input.confirmed ? GEN : null,
    cutoffTime: "2026-08-21T17:00:00.000Z",
    lineupStatus: input.confirmed ? "COMPLETE" : "INCOMPLETE",
    battingOrder: input.playerIds.map((id, i) => ({
      slot: i + 1,
      playerId: id,
      playerName: `Player ${id}`,
      defensivePosition: "RF",
      isDh: false,
      isSubstitute: false,
    })),
    substitutes: [],
    missingFields: [],
    warnings: [],
    researchOnly: true,
    legalStatus: "INTERNAL_RESEARCH_ONLY",
    engineUseAllowed: false,
    inputHash: "a",
    resultHash: "b",
  };
}

function sourcesFromLineup(
  rows: LineupDatasetRow[],
  gamePk = 99,
): BatterDatasetSources {
  const lineupDoc = {
    meta: {
      datasetId: "mlb-lineup",
      schemaVersion: "mlb-lineup-dataset-v1",
      builderVersion: "lineup-dataset-builder-v1",
      status: "COLLECTING",
      engineAdmission: "PROHIBITED",
      engineConnected: false,
      engineUseAllowed: false,
      researchOnly: true,
      dateKst: "2026-08-21",
      generatedAt: GEN,
      predictionHashSha256: "x",
      predictionUnchanged: true,
      inputHashSha256: "x",
      resultHashSha256: "x",
      legal: {
        mlbStatsSource: "INTERNAL_RESEARCH_ONLY",
        publicRuntimeUseAllowed: false,
        commercialRuntimeUseAllowed: false,
        rawResponseInResearchCacheOnly: true,
        mlbHtmlCrawling: false,
        sportsDataIoScrambled: false,
      },
      notes: [],
    },
    cacheUsage: {
      rawHit: 0,
      rawMiss: 0,
      derivedHit: 0,
      derivedMiss: 0,
      networkCalls: 0,
    },
    summary: {
      totalGames: 1,
      teamLineups: 2,
      completeLineups: 2,
      incompleteLineups: 0,
      totalStarters: 18,
      battingSlotDuplicates: 0,
      battingSlotMissing: 0,
      substitutesSeparated: 0,
      startersMarkedSubstitute: 0,
      preGameStatus: "NOT_COLLECTED",
      postGameStatuses: { COMPLETE: 2, INCOMPLETE: 0 },
      battingSideCollected: 0,
      peopleApiCalls: 0,
    },
    rows,
  } as LineupDatasetDocument;

  return {
    scheduleGames: [
      {
        gameId: "mlb-test-game",
        gamePk,
        homeTeam: "Home",
        awayTeam: "Away",
        homeTeamId: 1,
        awayTeamId: 2,
        commenceTimeUtc: "2026-08-21T17:00:00.000Z",
        officialDate: "2026-08-21",
      },
    ],
    lineupDoc,
    expectedObs: null,
    sourceArtifacts: ["fixture"],
    sourceArtifactHashes: { fixture: "0" },
    predictionHashSha256: "pred",
  };
}

async function testCutoffPolicy() {
  assert.equal(
    statsThroughDateForGame({ dateKst: "2026-08-20", officialDate: "2026-08-19" }),
    "2026-08-18",
  );
  const filtered = filterHittingGameLogAsOf({
    targetGamePk: 99,
    statsThroughDate: "2026-08-18",
    splits: [
      { date: "2026-08-18", game: { gamePk: 1 }, stat: { hits: 1 } },
      { date: "2026-08-19", game: { gamePk: 2 }, stat: { hits: 9 } },
      { date: "2026-08-20", game: { gamePk: 99 }, stat: { hits: 4 } },
    ],
  });
  assert.equal(filtered.kept.length, 1);
  assert.equal(filtered.excludedTarget, 1);
  assert.equal(filtered.excludedSameDayOrLater, 1);
  console.log("PASS cutoff SAME_DAY_GAME_RESULT_EXCLUDED");
}

async function testConfirmedJoinAndSample() {
  const homeIds = [10, 11, 12, 13, 14, 15, 16, 17, 10];
  const awayIds = [20, 21, 22, 23, 24, 25, 26, 27, 28];
  const sources = sourcesFromLineup([
    lineupRow({
      gamePk: 99,
      gameId: "mlb-test-game",
      side: "home",
      teamId: 1,
      teamName: "Home",
      opponentTeamId: 2,
      opponentTeamName: "Away",
      phase: "PRE_GAME",
      confirmed: true,
      playerIds: homeIds,
    }),
    lineupRow({
      gamePk: 99,
      gameId: "mlb-test-game",
      side: "away",
      teamId: 2,
      teamName: "Away",
      opponentTeamId: 1,
      opponentTeamName: "Home",
      phase: "PRE_GAME",
      confirmed: true,
      playerIds: awayIds,
    }),
  ]);

  const people: Record<number, unknown> = {};
  const hitting: Record<number, unknown> = {};
  for (const id of [...new Set([...homeIds, ...awayIds])]) {
    people[id] = personBody(id === 10 ? "L" : "R", `Player ${id}`, "RF");
    hitting[id] = hittingBody([
      {
        date: "2026-08-18",
        gamePk: 1,
        pa: 4,
        ab: 3,
        h: 1,
        tb: 1,
        bb: 1,
        so: 1,
        hr: 0,
        hbp: 0,
        sf: 0,
      },
      {
        date: "2026-08-21",
        gamePk: 99,
        pa: 99,
        ab: 99,
        h: 99,
        tb: 99,
        bb: 0,
        so: 0,
        hr: 0,
        hbp: 0,
        sf: 0,
      },
    ]);
  }
  delete hitting[28];

  const { document } = await buildBatterDatasetV0({
    dateKst: "2026-08-21",
    generatedAt: GEN,
    nowMs: FUTURE_NOW,
    allowNetwork: false,
    sources,
    statLookup: {
      person: (id) => people[id] ?? null,
      hittingGameLog: (id) => hitting[id] ?? null,
    },
  });

  const errors = assertBatterDatasetIntegrity(document);
  assert.deepEqual(errors, []);
  assert.equal(document.meta.engineUseAllowed, false);
  assert.equal(document.meta.predictionInputAllowed, false);
  assert.equal(document.meta.independentModelSample, 0);
  assert.equal(document.meta.marketDataAllowed, false);
  assert.equal(document.meta.uniquePlayerIds, 17);
  assert.equal(document.meta.providerFetchesAttempted, 34);
  assert.equal(document.meta.providerFetchesDeduped, 1);
  assert.equal(document.meta.networkCalls, 0);

  const acuna = document.games[0].home.batters[0];
  assert.equal(acuna.playerId, 10);
  assert.equal(acuna.bats, "L");
  assert.equal(acuna.rowStatus, "READY");
  assert.equal(acuna.sampleSize.pa, 4);
  assert.equal(acuna.sampleSize.ab, 3);
  assert.equal(acuna.counting.hits, 1);
  assert.equal(acuna.rates.avg, 0.3333);
  assert.notEqual(acuna.latestIncludedGameDate, "2026-08-21");
  assert.equal(acuna.recentCondition, null);
  assert.equal(acuna.splits, null);
  assert.equal(acuna.advanced, null);

  const missing = document.games[0].away.batters[8];
  assert.equal(missing.playerId, 28);
  assert.equal(missing.rowStatus, "STATS_MISSING");

  const dupHomeLast = document.games[0].home.batters[8];
  assert.equal(dupHomeLast.playerId, 10);
  assert.equal(dupHomeLast.counting.hits, 1);

  const again = await buildBatterDatasetV0({
    dateKst: "2026-08-21",
    generatedAt: GEN,
    nowMs: FUTURE_NOW,
    allowNetwork: false,
    sources,
    statLookup: {
      person: (id) => people[id] ?? null,
      hittingGameLog: (id) => hitting[id] ?? null,
    },
  });
  assert.equal(again.document.meta.datasetHashSha256, document.meta.datasetHashSha256);

  const blob = JSON.stringify(document);
  assert.equal(/marketProbability|openingOdds|latestOdds|marketPrior/i.test(blob), false);
  console.log("PASS confirmed join, bats, sampleSize, dedupe, PARTIAL/missing, deterministic");
}

async function testPostgameLineupExcluded() {
  const sources = sourcesFromLineup([
    lineupRow({
      gamePk: 99,
      gameId: "mlb-test-game",
      side: "home",
      teamId: 1,
      teamName: "Home",
      opponentTeamId: 2,
      opponentTeamName: "Away",
      phase: "POST_GAME",
      confirmed: true,
      playerIds: [1, 2, 3, 4, 5, 6, 7, 8, 9],
    }),
    lineupRow({
      gamePk: 99,
      gameId: "mlb-test-game",
      side: "away",
      teamId: 2,
      teamName: "Away",
      opponentTeamId: 1,
      opponentTeamName: "Home",
      phase: "POST_GAME",
      confirmed: true,
      playerIds: [11, 12, 13, 14, 15, 16, 17, 18, 19],
    }),
  ]);
  const { document } = await buildBatterDatasetV0({
    dateKst: "2026-08-21",
    generatedAt: GEN,
    nowMs: FUTURE_NOW,
    sources,
    statLookup: {
      person: () => null,
      hittingGameLog: () => null,
    },
  });
  assert.equal(document.games[0].home.lineupStatus, "UNAVAILABLE");
  assert.equal(document.games[0].home.batters[0].playerId, null);
  assert.ok(document.games[0].warnings.includes("POSTGAME_LINEUP_EXCLUDED"));
  console.log("PASS postgame lineup excluded from pregame confirmed");
}

async function testHistorical20260820() {
  const predBefore = sha256File(`data/predictions/mlb/${DATE}.json`);
  const { document, predictionHash } = await buildBatterDatasetV0({
    dateKst: DATE,
    generatedAt: GEN,
    nowMs: Date.parse("2026-08-20T15:00:00.000Z"),
    allowNetwork: false,
  });
  const errors = assertBatterDatasetIntegrity(document);
  assert.deepEqual(errors, []);
  assert.equal(document.meta.reconstructionSafety, "NOT_BACKFILLABLE_V0");
  assert.equal(document.meta.networkCalls, 0);
  assert.equal(document.meta.allowNetwork, false);
  assert.equal(document.summary.totalGames, 15);
  assert.equal(document.summary.totalBatterSlots, 270);
  assert.equal(document.summary.statsReady, 0);
  assert.equal(document.summary.confirmedGames, 0);
  assert.ok(document.summary.expectedOnlyGames > 0);
  assert.ok(document.summary.identityMissing > 0);
  assert.equal(document.games.every((g) => g.home.batters.length === 9), true);
  assert.equal(predictionHash, predBefore);
  const predAfter = sha256File(`data/predictions/mlb/${DATE}.json`);
  assert.equal(predAfter, predBefore);
  assert.equal(document.meta.predictionHashSha256, predBefore);
  const blob = JSON.stringify(document);
  assert.equal(/marketProbability|openingOdds|korean-market/i.test(blob), false);

  const frozenPath = path.join(ROOT, `data/research/mlb/${DATE}-batter-dataset-v0.json`);
  const frozen = JSON.parse(readFileSync(frozenPath, "utf8")) as typeof document;
  assert.equal(frozen.meta.reconstructionSafety, "NOT_BACKFILLABLE_V0");
  assert.equal(frozen.meta.independentModelSample, 0);
  assert.equal(frozen.meta.engineUseAllowed, false);
  assert.equal(frozen.summary.totalGames, 15);
  assert.equal(frozen.meta.datasetHashSha256, document.meta.datasetHashSha256);
  console.log(
    `PASS 2026-08-20 reconstruction safety=${document.meta.reconstructionSafety} expectedGames=${document.summary.expectedOnlyGames} identityMissing=${document.summary.identityMissing} batsResolved=${document.summary.batsResolved}`,
  );
}

async function main() {
  assert.equal(MLB_PREDICTION_V0_WEIGHTS.marketPrior.value, 0.25);
  assert.equal(MLB_PREDICTION_V0_WEIGHTS.lineup.value, 0);
  await testCutoffPolicy();
  await testConfirmedJoinAndSample();
  await testPostgameLineupExcluded();
  await testHistorical20260820();
  process.stdout.write("test:mlb-batter-dataset-v0 PASS\n");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

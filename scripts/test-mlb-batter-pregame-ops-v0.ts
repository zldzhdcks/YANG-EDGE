/**
 * MLB Batter Pregame live sidecar v0 tests.
 * Fixture / dry-run / existing cache only. No live Stats API fetch.
 * Does not mutate frozen prediction snapshots or `리포트/`.
 *
 *   npm run test:mlb-batter-pregame-ops-v0
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { MLB_PREDICTION_V0_WEIGHTS } from "../src/lib/mlb/prediction-v0/config";
import type { LineupDatasetDocument, LineupDatasetRow } from "../src/lib/mlb/lineup-dataset-types";
import type { MlbExpectedLineupObservationV0 } from "../src/lib/mlb/expected-lineup-observation-v0/types";
import {
  assertBatterDatasetIntegrity,
  BATTER_FETCH_GATE_POLICY,
  buildBatterDatasetV0,
  evaluateFullSlateFetchGate,
  formatBatterPregameOpsSummary,
  runBatterPregameOps,
  type BatterDatasetSources,
} from "../src/lib/mlb/batter-dataset-v0";
import { MANDATORY_STAGE_WEIGHTS } from "../src/lib/reporting/v1/types";

const ROOT = process.cwd();
const DATE_HIST = "2026-08-20";
const GEN = "2026-08-20T13:50:00.000Z";
const FUTURE_NOW = Date.parse("2026-08-21T12:00:00.000Z");
const PAST_NOW = Date.parse("2026-08-21T18:00:00.000Z");
const COMMENCE = "2026-08-21T17:00:00.000Z";

function sha256File(rel: string): string {
  const raw = readFileSync(path.join(ROOT, rel), "utf8");
  return createHash("sha256").update(raw, "utf8").digest("hex");
}

function sha256Text(raw: string): string {
  return createHash("sha256").update(raw, "utf8").digest("hex");
}

function hittingBody(
  splits: Array<{
    date: string;
    gamePk: number;
    pa: number;
    ab: number;
    h: number;
    tb: number;
    bb: number;
    so: number;
    hr: number;
    hbp: number;
    sf: number;
  }>,
) {
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
    preGameStatus:
      input.phase === "PRE_GAME" && input.confirmed
        ? "COLLECTED"
        : "NOT_COLLECTED",
    collectionStatus: input.confirmed ? "CONFIRMED" : "NOT_RELEASED",
    confirmed: input.confirmed,
    lineupSource: input.confirmed ? "mlb-statsapi-schedule-lineups" : null,
    sourceTimestamp: GEN,
    fetchedAt: GEN,
    lineupConfirmedAt: input.confirmed ? GEN : null,
    cutoffTime: COMMENCE,
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

function expectedObs(gamePk: number): MlbExpectedLineupObservationV0 {
  const nine = (prefix: string) =>
    Array.from({ length: 9 }, (_, i) => ({
      battingOrder: i + 1,
      displayName: `${prefix} ${i + 1}`,
      position: "RF",
      bats: "R",
      providerPlayerId: null as const,
    }));
  return {
    schemaVersion: "mlb-expected-lineup-observation-v0",
    dateKst: "2026-08-21",
    league: "MLB",
    observationType: "EXPECTED_LINEUP",
    sourceType: "MANUAL_OBSERVATION",
    sourceLabel: "test",
    lineupStatus: "EXPECTED",
    observedAt: GEN,
    enteredBy: "OPERATOR",
    note: "fixture",
    expectedLineupHash: "x",
    games: [
      {
        gamePk,
        internalGameId: "mlb-test-game",
        awayTeam: "Away",
        homeTeam: "Home",
        firstPitchAt: COMMENCE,
        joinStatus: "NOT_MATCHED",
        lineupStatus: "EXPECTED",
        observationStatus: "OBSERVED",
        awayLineup: nine("Away"),
        homeLineup: nine("Home"),
        observedAt: GEN,
        isBeforeFirstPitch: true,
        cutoffLabel: "PRE_GAME_OBSERVATION",
      },
    ],
    summary: {
      scheduleGames: 1,
      matchedGames: 0,
      teamLineups: 2,
      expectedBattingSlots: 18,
      expectedGames: 1,
      confirmedGames: 0,
      missingGames: 0,
      preGameObservations: 1,
      lateObservations: 0,
      joinErrors: 0,
    },
  };
}

function sourcesFromLineup(
  rows: LineupDatasetRow[],
  gamePk = 99,
  expected: MlbExpectedLineupObservationV0 | null = null,
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
        commenceTimeUtc: COMMENCE,
        officialDate: "2026-08-21",
      },
    ],
    lineupDoc,
    expectedObs: expected,
    sourceArtifacts: ["fixture"],
    sourceArtifactHashes: { fixture: "0" },
    predictionHashSha256: "pred",
  };
}

function confirmedSources(): BatterDatasetSources {
  const homeIds = [10, 11, 12, 13, 14, 15, 16, 17, 10];
  const awayIds = [20, 21, 22, 23, 24, 25, 26, 27, 28];
  return sourcesFromLineup([
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
}

function lookupForConfirmed(): NonNullable<
  Parameters<typeof buildBatterDatasetV0>[0]["statLookup"]
> {
  const homeIds = [10, 11, 12, 13, 14, 15, 16, 17, 10];
  const awayIds = [20, 21, 22, 23, 24, 25, 26, 27, 28];
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
        gamePk: 88,
        pa: 4,
        ab: 4,
        h: 4,
        tb: 4,
        bb: 0,
        so: 0,
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
  return {
    person: (id) => people[id] ?? null,
    hittingGameLog: (id) => hitting[id] ?? null,
  };
}

function cacheKey(pathQuery: string): string {
  return pathQuery.replace(/^\//, "").replace(/[?&=]/g, "_");
}

async function withTmp<T>(fn: (cwd: string) => Promise<T>): Promise<T> {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "mlb-batter-ops-"));
  try {
    return await fn(cwd);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}

function testFetchGate() {
  const future = evaluateFullSlateFetchGate(
    ["2026-08-21T17:00:00.000Z", "2026-08-21T23:00:00.000Z"],
    Date.parse("2026-08-21T12:00:00.000Z"),
  );
  assert.equal(future.policy, BATTER_FETCH_GATE_POLICY);
  assert.equal(future.policy, "FULL_SLATE_BEFORE_FIRST_PITCH_ONLY");
  assert.equal(future.window, "OPEN");
  assert.equal(future.commencedCount, 0);
  assert.equal(future.remainingCount, 2);

  const closed = evaluateFullSlateFetchGate(
    ["2026-08-21T17:00:00.000Z", "2026-08-21T23:00:00.000Z"],
    Date.parse("2026-08-21T18:00:00.000Z"),
  );
  assert.equal(closed.window, "CLOSED");
  assert.equal(closed.commencedCount, 1);
  assert.equal(closed.remainingCount, 1);
  console.log("PASS future slate OPEN; commenced slate CLOSED (full-slate policy)");
}

async function testDryRunNoProvider() {
  await withTmp(async (cwd) => {
    const sources = confirmedSources();
    const summary = await runBatterPregameOps({
      dateKst: "2026-08-21",
      cwd,
      dryRun: true,
      nowMs: FUTURE_NOW,
      sources,
    });
    assert.equal(summary.providerCalls, 0);
    assert.equal(summary.written, false);
    assert.equal(summary.fetchGate.window, "OPEN");
    assert.equal(summary.canFetch, true);
    assert.equal(summary.uniquePlayerIds, 17);
    assert.equal(summary.expectedProviderCallsIfLive, 34);
    assert.equal(summary.predictionExecuted, false);
    assert.equal(summary.independentModelSample, 0);
    assert.equal(summary.marketUsed, false);
    assert.ok(formatBatterPregameOpsSummary(summary).includes("Prediction executed: NO"));
  });
  console.log("PASS dry-run provider calls = 0, playerIds counted");
}

async function testCommencedRefusesFetchAndWrite() {
  await withTmp(async (cwd) => {
    const sources = confirmedSources();
    const lookup = lookupForConfirmed();
    const summary = await runBatterPregameOps({
      dateKst: "2026-08-21",
      cwd,
      dryRun: false,
      nowMs: PAST_NOW,
      sources,
      statLookup: lookup,
    });
    assert.equal(summary.fetchGate.window, "CLOSED");
    assert.equal(summary.datasetStatus, "CUTOFF_CLOSED");
    assert.equal(summary.written, false);
    assert.equal(summary.providerCalls, 0);
    assert.equal(summary.canFetch, false);
    assert.equal(
      existsSync(path.join(cwd, "data/research/mlb/2026-08-21-batter-dataset-v0.json")),
      false,
    );
  });
  console.log("PASS commenced slate does not fetch or write");
}

async function testPostgameAndExpectedPolicies() {
  const postgame = sourcesFromLineup(
    [
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
    ],
    99,
    expectedObs(99),
  );
  await withTmp(async (cwd) => {
    const dry = await runBatterPregameOps({
      dateKst: "2026-08-21",
      cwd,
      dryRun: true,
      nowMs: FUTURE_NOW,
      sources: postgame,
    });
    assert.equal(dry.lineup.confirmedPreGame, 0);
    assert.equal(dry.lineup.expectedPreGame, 2);
    assert.equal(dry.uniquePlayerIds, 0);
    assert.equal(dry.leakage.postgameLineupExcluded, 2);
    assert.equal(dry.canFetch, false);
  });

  const { document } = await buildBatterDatasetV0({
    dateKst: "2026-08-21",
    generatedAt: GEN,
    nowMs: FUTURE_NOW,
    sources: postgame,
    statLookup: { person: () => null, hittingGameLog: () => null },
  });
  assert.equal(document.games[0].home.lineupStatus, "EXPECTED");
  assert.equal(document.games[0].home.batters[0].playerId, null);
  assert.equal(document.games[0].home.batters[0].rowStatus, "IDENTITY_MISSING");
  assert.ok(document.games[0].warnings.includes("POSTGAME_LINEUP_EXCLUDED"));
  console.log("PASS postgame excluded; expected not promoted; missing playerId explicit");
}

async function testWriteDedupeCutoffImmutable() {
  await withTmp(async (cwd) => {
    const sources = confirmedSources();
    const lookup = lookupForConfirmed();
    const first = await runBatterPregameOps({
      dateKst: "2026-08-21",
      cwd,
      dryRun: false,
      nowMs: FUTURE_NOW,
      generatedAt: GEN,
      sources,
      statLookup: lookup,
    });
    assert.equal(first.written, true);
    assert.equal(first.providerCalls, 0);
    assert.equal(first.uniquePlayerIds, 17);
    assert.equal(first.datasetStatus, "PREGAME_SAFE");
    assert.equal(first.leakage.targetGameExcluded > 0, true);
    assert.equal(first.leakage.sameDayExcluded > 0, true);
    assert.equal(first.predictionExecuted, false);

    const out = path.join(cwd, "data/research/mlb/2026-08-21-batter-dataset-v0.json");
    const raw1 = readFileSync(out, "utf8");
    const doc = JSON.parse(raw1) as Awaited<
      ReturnType<typeof buildBatterDatasetV0>
    >["document"];
    assert.deepEqual(assertBatterDatasetIntegrity(doc), []);
    assert.equal(doc.meta.uniquePlayerIds, 17);
    assert.equal(doc.meta.providerFetchesDeduped, 1);
    assert.equal(doc.meta.marketDataAllowed, false);
    assert.equal(doc.meta.independentModelSample, 0);
    const slot = doc.games[0].home.batters[0];
    assert.equal(slot.latestIncludedGameDate, "2026-08-18");
    assert.ok(slot.warnings.includes("TARGET_GAME_EXCLUDED_FROM_STATS"));
    assert.ok(slot.warnings.includes("SAME_DAY_OR_LATER_EXCLUDED"));
    assert.equal(/marketProbability|openingOdds|latestOdds|marketPrior/i.test(raw1), false);

    const again = await buildBatterDatasetV0({
      dateKst: "2026-08-21",
      generatedAt: GEN,
      nowMs: FUTURE_NOW,
      sources,
      statLookup: lookup,
    });
    assert.equal(again.document.meta.datasetHashSha256, doc.meta.datasetHashSha256);

    const second = await runBatterPregameOps({
      dateKst: "2026-08-21",
      cwd,
      dryRun: false,
      nowMs: FUTURE_NOW,
      generatedAt: "2099-01-01T00:00:00.000Z",
      sources,
      statLookup: lookup,
    });
    assert.equal(second.written, false);
    assert.equal(second.skippedImmutable, true);
    const raw2 = readFileSync(out, "utf8");
    assert.equal(raw2, raw1);
  });
  console.log("PASS dedupe, cutoff exclusions, deterministic hash, frozen mutation blocked");
}

async function testCacheReuse() {
  await withTmp(async (cwd) => {
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
        playerIds: [10, 10, 10, 10, 10, 10, 10, 10, 10],
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
        playerIds: [10, 10, 10, 10, 10, 10, 10, 10, 10],
      }),
    ]);
    const personKey = cacheKey("/api/v1/people/10");
    const hittingKey = cacheKey(
      "/api/v1/people/10/stats?stats=gameLog&group=hitting&season=2026&sportId=1",
    );
    const cacheDir = path.join(cwd, "data/cache/research/mlb/raw/statsapi");
    const personFile = path.join(cacheDir, `${personKey}.json`);
    const hittingFile = path.join(cacheDir, `${hittingKey}.json`);
    mkdirSync(path.dirname(personFile), { recursive: true });
    mkdirSync(path.dirname(hittingFile), { recursive: true });
    writeFileSync(
      personFile,
      `${JSON.stringify({
        meta: {
          source: "INTERNAL_RESEARCH_ONLY",
          pathQuery: "/api/v1/people/10",
          fetchedAt: GEN,
          endpointCategory: "people",
          statsThroughDate: "2026-08-20",
        },
        body: personBody("L", "Player 10", "RF"),
      })}\n`,
    );
    writeFileSync(
      hittingFile,
      `${JSON.stringify({
        meta: {
          source: "INTERNAL_RESEARCH_ONLY",
          pathQuery:
            "/api/v1/people/10/stats?stats=gameLog&group=hitting&season=2026&sportId=1",
          fetchedAt: GEN,
          endpointCategory: "hitting-gameLog",
          statsThroughDate: "2026-08-20",
        },
        body: hittingBody([
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
        ]),
      })}\n`,
    );

    const first = await runBatterPregameOps({
      dateKst: "2026-08-21",
      cwd,
      dryRun: false,
      nowMs: FUTURE_NOW,
      generatedAt: GEN,
      sources,
    });
    assert.equal(first.written, true);
    assert.equal(first.providerCalls, 0);
    assert.equal(first.cacheHits >= 2, true);
    assert.equal(first.uniquePlayerIds, 1);
    assert.equal(first.datasetStatus, "PREGAME_SAFE");

    const second = await runBatterPregameOps({
      dateKst: "2026-08-21",
      cwd,
      dryRun: false,
      nowMs: FUTURE_NOW,
      generatedAt: GEN,
      sources,
    });
    assert.equal(second.written, false);
    assert.equal(second.skippedImmutable, true);
    assert.equal(second.providerCalls, 0);
  });
  console.log("PASS cache reuse, playerId dedupe, PREGAME_SAFE when confirmed stats ready");
}

async function testHistoricalFrozenAndNoSideEffects() {
  const pred720 = sha256File("data/predictions/mlb/2026-07-30.json");
  const pred820 = sha256File(`data/predictions/mlb/${DATE_HIST}.json`);
  const frozen = readFileSync(
    path.join(ROOT, `data/research/mlb/${DATE_HIST}-batter-dataset-v0.json`),
    "utf8",
  );
  const reportBefore = existsSync(path.join(ROOT, "리포트"));

  const dry = await runBatterPregameOps({
    dateKst: DATE_HIST,
    dryRun: true,
    nowMs: Date.parse("2026-08-20T16:00:00.000Z"),
  });
  assert.equal(dry.providerCalls, 0);
  assert.equal(dry.written, false);
  assert.equal(dry.datasetStatus, "NOT_BACKFILLABLE_V0");
  assert.equal(dry.fetchGate.window, "CLOSED");
  assert.equal(dry.skippedImmutable, true);

  const liveSkip = await runBatterPregameOps({
    dateKst: DATE_HIST,
    dryRun: false,
    nowMs: Date.parse("2026-08-20T16:00:00.000Z"),
  });
  assert.equal(liveSkip.written, false);
  assert.equal(liveSkip.providerCalls, 0);
  assert.equal(liveSkip.skippedImmutable, true);

  const frozenAfter = readFileSync(
    path.join(ROOT, `data/research/mlb/${DATE_HIST}-batter-dataset-v0.json`),
    "utf8",
  );
  assert.equal(frozenAfter, frozen);
  assert.equal(sha256File("data/predictions/mlb/2026-07-30.json"), pred720);
  assert.equal(sha256File(`data/predictions/mlb/${DATE_HIST}.json`), pred820);
  assert.equal(existsSync(path.join(ROOT, "리포트")), reportBefore);

  const liveOpsSrc = readFileSync(
    path.join(ROOT, "src/lib/mlb/batter-dataset-v0/live-ops.ts"),
    "utf8",
  );
  const cliSrc = readFileSync(
    path.join(ROOT, "scripts/run-mlb-batter-pregame-ops-v0.ts"),
    "utf8",
  );
  assert.equal(/loadAndPredictMlbV0|runMlbDailyPregameV0|buildPredictionSnapshotV0/.test(liveOpsSrc), false);
  assert.equal(/loadAndPredictMlbV0|runMlbDailyPregameV0|buildPredictionSnapshotV0/.test(cliSrc), false);
  assert.equal(MLB_PREDICTION_V0_WEIGHTS.marketPrior.value, 0.25);
  assert.equal(MLB_PREDICTION_V0_WEIGHTS.lineup.value, 0);
  assert.equal(MANDATORY_STAGE_WEIGHTS.B_PREGAME_INPUT, 20);
  assert.equal(MANDATORY_STAGE_WEIGHTS.A_SLATE_SCHEDULE, 10);
  console.log("PASS 2026-08-20 frozen, no prediction invocation, snapshot hashes unchanged, 리포트 untouched");
}

async function main() {
  testFetchGate();
  await testDryRunNoProvider();
  await testCommencedRefusesFetchAndWrite();
  await testPostgameAndExpectedPolicies();
  await testWriteDedupeCutoffImmutable();
  await testCacheReuse();
  await testHistoricalFrozenAndNoSideEffects();
  process.stdout.write("test:mlb-batter-pregame-ops-v0 PASS\n");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

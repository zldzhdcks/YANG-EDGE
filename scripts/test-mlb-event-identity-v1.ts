/**
 * MLB event identity contract v1.
 * Fixture / temp-cwd only — zero Provider calls. No historical rewrite.
 *
 *   npm run test:mlb-event-identity-v1
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  MLB_AMBIGUOUS_MATCHUP_ID,
  MLB_IDENTITY_AMBIGUOUS,
  mlbEventIdFromGamePk,
  mlbGamePkFromEventId,
  parsePositiveMlbGamePk,
  resolveMlbRequestedGameIds,
} from "../src/lib/mlb/event-identity";
import { auditSchedule } from "../src/lib/mlb/daily-pregame-v0/audit-artifacts";
import { deriveEffectiveEarliestStart } from "../src/lib/mlb/daily-pregame-v0/window-freshness";
import { loadMlbPredictionConsumerInput } from "../src/lib/mlb/load-mlb-prediction-consumer-input";
import { buildPredictionSnapshotV0 } from "../src/lib/mlb/prediction-v0/build-snapshot";
import type { GamePredictionV0 } from "../src/lib/mlb/prediction-v0/types";
import { gradeMlbPredictionsV1 } from "../src/lib/mlb/grade-mlb-predictions-v1";
import { loadDailyPicksV1 } from "../src/lib/mlb/daily-picks-v1/load-daily-picks";
import {
  canonicalSchedulerGameId,
  detectLockedPrediction,
  loadScheduleGames,
} from "../src/lib/scheduler/load-schedule";
import { buildLockKey } from "../src/lib/scheduler/resolve-stage";
import { runPregameScheduler } from "../src/lib/scheduler";
import { MLB_DAILY_RESEARCH_SUMMARY_SCHEMA } from "../src/lib/mlb/mlb-daily-research-summary-types";
import {
  MLB_OFFICIAL_RESULTS_SCHEMA,
  type MlbOfficialResultsDocument,
} from "../src/lib/mlb/mlb-prediction-review-types";
import { MLB_SCHEDULE_BUILDER_VERSION, MLB_SCHEDULE_DATASET_ID, MLB_SCHEDULE_SCHEMA_VERSION } from "../src/lib/mlb/mlb-schedule-artifact-types";

const REPO = process.cwd();
const DATE_0830 = "2026-08-30";
const MATCHUP_NYY = "mlb-new-york-yankees-boston-red-sox";
const MATCHUP_SF = "mlb-san-francisco-giants-arizona-diamondbacks";
const PK = {
  nyy1: 823539,
  nyy2: 823501,
  sf1: 823177,
  sf2: 823176,
} as const;

function sha256File(rel: string): string {
  return createHash("sha256").update(readFileSync(path.join(REPO, rel))).digest("hex");
}

function writeJson(cwd: string, rel: string, body: unknown) {
  const abs = path.join(cwd, rel);
  mkdirSync(path.dirname(abs), { recursive: true });
  writeFileSync(abs, `${JSON.stringify(body, null, 2)}\n`, "utf8");
}

function stubMarket(homeP: number): GamePredictionV0["marketPredictions"][number] {
  return {
    marketType: "MONEYLINE_2WAY",
    line: null,
    homeProbability: homeP,
    awayProbability: 1 - homeP,
    marketHomeProbability: null,
    marketAwayProbability: null,
    modelEdgeHome: null,
    modelEdgeAway: null,
    confidence: 50,
    officialStatus: "PASS",
    officialPick: null,
    researchBaseline: {
      selection: homeP >= 0.5 ? "HOME" : "AWAY",
      probability: Math.max(homeP, 1 - homeP),
      researchOnly: true,
    },
    components: {
      base: 0,
      starter: 0,
      bullpen: 0,
      lineup: 0,
      homeAdvantage: 0,
      marketPrior: 0,
    },
    missingInputs: [],
    warnings: [],
    explanations: [],
    inputQuality: "LIMITED_INPUT",
    calibration: {
      rawHomeProbability: homeP,
      clampedHomeProbability: homeP,
      shrinkStrength: 0,
      clampMin: 0.35,
      clampMax: 0.65,
    },
  };
}

function stubGame(input: {
  eventId: string;
  gamePk: number;
  matchupId: string;
  homeP: number;
}): GamePredictionV0 {
  const mp = stubMarket(input.homeP);
  return {
    eventId: input.eventId,
    gamePk: input.gamePk,
    matchupId: input.matchupId,
    gameId: input.matchupId,
    externalId: String(input.gamePk),
    dateKst: "2099-08-30",
    startTimeKst: "18:00",
    commenceTimeUtc: "2099-08-30T09:00:00.000Z",
    league: "MLB",
    homeTeam: "New York Yankees",
    awayTeam: "Boston Red Sox",
    marketPredictions: [mp],
    baselinePick: "New York Yankees",
    modelProbability: Math.round(input.homeP * 1000) / 10,
    edgeScore: 0,
    confidence: 50,
    baselineStatus: "PASS",
    marketProbability: null,
    valueEdge: null,
    openingOdds: 1.9,
    latestOdds: 1.85,
    oddsMovement: "DOWN",
    officialStatus: "PASS",
    officialPick: null,
    passReasons: [],
    missingInputs: [],
    researchBaseline: {
      pick: "New York Yankees",
      confidence: 50,
      modelProbability: Math.round(input.homeP * 1000) / 10,
      researchOnly: true,
    },
    inputStatus: "LIMITED_INPUT",
    inputWarnings: [],
    features: {
      homeStarter: {
        playerName: null,
        era: null,
        whip: null,
        inningsPitched: null,
        strikeouts: null,
        walks: null,
        throws: null,
        score: 0,
        quality: "MISSING",
        provenance: {
          sourceArtifact: null,
          sourceTimestamp: null,
          statsAsOf: null,
          cutoffTime: null,
          leakageEligible: false,
          warning: [],
        },
      },
      awayStarter: {
        playerName: null,
        era: null,
        whip: null,
        inningsPitched: null,
        strikeouts: null,
        walks: null,
        throws: null,
        score: 0,
        quality: "MISSING",
        provenance: {
          sourceArtifact: null,
          sourceTimestamp: null,
          statsAsOf: null,
          cutoffTime: null,
          leakageEligible: false,
          warning: [],
        },
      },
      market: {
        homeOdds: 1.9,
        awayOdds: 2.0,
        oddsFormat: "DECIMAL",
        marketProbabilityHome: null,
        marketProbabilityAway: null,
        overround: null,
        oddsQuality: "GOOD",
        provenance: {
          sourceArtifact: null,
          sourceTimestamp: null,
          statsAsOf: null,
          cutoffTime: null,
          leakageEligible: false,
          warning: [],
        },
      },
      lineup: {
        confirmed: false,
        completeness: 0,
        missingCoreHitters: 0,
        performanceEdgeWeight: 0,
        provenance: {
          sourceArtifact: null,
          sourceTimestamp: null,
          statsAsOf: null,
          cutoffTime: null,
          leakageEligible: false,
          warning: [],
        },
      },
      homeBullpen: {
        score: 0,
        dataQuality: "DISABLED",
        edge: 0,
        provenance: {
          sourceArtifact: null,
          sourceTimestamp: null,
          statsAsOf: null,
          cutoffTime: null,
          leakageEligible: false,
          warning: [],
        },
      },
      awayBullpen: {
        score: 0,
        dataQuality: "DISABLED",
        edge: 0,
        provenance: {
          sourceArtifact: null,
          sourceTimestamp: null,
          statsAsOf: null,
          cutoffTime: null,
          leakageEligible: false,
          warning: [],
        },
      },
    },
    leakage: { blocked: false, reasons: [] },
  };
}

function scheduleDoc(dateKst: string, games: Array<Record<string, unknown>>) {
  return {
    meta: {
      datasetId: MLB_SCHEDULE_DATASET_ID,
      schemaVersion: MLB_SCHEDULE_SCHEMA_VERSION,
      builderVersion: MLB_SCHEDULE_BUILDER_VERSION,
      dateKst,
      generatedAt: "1970-01-01T00:00:00.000Z",
      source: "mlb-stats-api" as const,
      researchOnly: true as const,
      engineAdmission: "PROHIBITED" as const,
      engineConnected: false as const,
    },
    summary: { totalGames: games.length },
    games,
  };
}

async function main() {
  const historicalRels = [
    "data/research/mlb/2026-07-30-schedule-v1.json",
    "data/research/mlb/2026-08-18-schedule-v1.json",
    "data/research/mlb/2026-08-30-schedule-v1.json",
  ];
  const historicalHashes = Object.fromEntries(
    historicalRels.filter((rel) => existsSync(path.join(REPO, rel))).map((rel) => [rel, sha256File(rel)]),
  );

  // --- helper ---
  assert.equal(mlbEventIdFromGamePk(823539), "mlb-game-823539");
  assert.equal(mlbEventIdFromGamePk("823501"), "mlb-game-823501");
  assert.equal(mlbGamePkFromEventId("mlb-game-823539"), 823539);
  assert.equal(parsePositiveMlbGamePk(0), null);
  assert.equal(parsePositiveMlbGamePk(-1), null);
  assert.equal(parsePositiveMlbGamePk(1.5), null);
  assert.equal(parsePositiveMlbGamePk("mlb-game-823539"), null);
  assert.throws(() => mlbEventIdFromGamePk(0));

  // --- 2026-08-30 real schedule (read-only) ---
  const audit = await auditSchedule(DATE_0830, REPO);
  const nyy = audit.games.filter((g) => g.matchupId === MATCHUP_NYY);
  const sf = audit.games.filter((g) => g.matchupId === MATCHUP_SF);
  assert.equal(nyy.length, 2);
  assert.equal(sf.length, 2);
  const nyyPks = nyy.map((g) => g.gamePk).sort();
  const sfPks = sf.map((g) => g.gamePk).sort();
  assert.deepEqual(nyyPks, [PK.nyy2, PK.nyy1].sort());
  assert.deepEqual(sfPks, [PK.sf2, PK.sf1].sort());
  assert.equal(
    nyy.find((g) => g.gamePk === PK.nyy1)?.eventId,
    "mlb-game-823539",
  );
  assert.equal(
    nyy.find((g) => g.gamePk === PK.nyy2)?.eventId,
    "mlb-game-823501",
  );
  assert.equal(
    sf.find((g) => g.gamePk === PK.sf1)?.eventId,
    "mlb-game-823177",
  );
  assert.equal(
    sf.find((g) => g.gamePk === PK.sf2)?.eventId,
    "mlb-game-823176",
  );
  const eventIds = audit.games.map((g) => g.eventId);
  assert.equal(new Set(eventIds).size, eventIds.length);
  assert.equal(audit.duplicateGameIds.length, 0);
  assert.ok(audit.duplicateMatchupIds.includes(MATCHUP_NYY));
  assert.ok(audit.duplicateMatchupIds.includes(MATCHUP_SF));

  const loaded0830 = await loadScheduleGames({
    league: "MLB",
    dateKst: DATE_0830,
    cwd: REPO,
  });
  const dhIds = loaded0830.games
    .map((g) => g.gameId)
    .filter((id) =>
      ["mlb-game-823539", "mlb-game-823501", "mlb-game-823177", "mlb-game-823176"].includes(id),
    );
  assert.equal(new Set(dhIds).size, 4);
  const locks = dhIds.map((gameId) =>
    buildLockKey({
      league: "MLB",
      dateKst: DATE_0830,
      gameId,
      stage: "PREGAME_LOCK",
    }),
  );
  assert.equal(new Set(locks).size, 4);
  assert.ok(locks.every((k) => k.includes("mlb-game-")));

  const slugResolve = resolveMlbRequestedGameIds(audit.games, [MATCHUP_NYY]);
  assert.deepEqual(slugResolve.eventIds, []);
  assert.deepEqual(slugResolve.ambiguousRequested, [MATCHUP_NYY]);
  const eventResolve = resolveMlbRequestedGameIds(audit.games, [
    "mlb-game-823539",
    "mlb-game-823501",
  ]);
  assert.deepEqual(eventResolve.eventIds.sort(), ["mlb-game-823501", "mlb-game-823539"]);
  assert.equal(eventResolve.ambiguousRequested.length, 0);

  const nyy1 = nyy.find((g) => g.gamePk === PK.nyy1)!;
  const nyy2 = nyy.find((g) => g.gamePk === PK.nyy2)!;
  const earliestOne = deriveEffectiveEarliestStart({
    games: [nyy1, nyy2],
    filterIds: ["mlb-game-823539"],
    fallbackEarliestStart: nyy2.commenceTimeUtc,
  });
  assert.equal(earliestOne, nyy1.commenceTimeUtc);
  assert.notEqual(nyy1.commenceTimeUtc, nyy2.commenceTimeUtc);

  // --- scheduler batch: two DH events, one window ---
  const batchCwd = mkdtempSync(path.join(tmpdir(), "mlb-eid-batch-"));
  const start = "2099-08-30T12:00:00.000Z";
  const now = new Date("2099-08-30T10:40:00.000Z");
  writeJson(batchCwd, "data/research/mlb/2099-08-30-schedule-v1.json", {
    dateKst: "2099-08-30",
    games: [
      {
        internalGameId: MATCHUP_NYY,
        gamePk: PK.nyy1,
        commenceTimeUtc: start,
        statusAbstract: "Preview",
      },
      {
        internalGameId: MATCHUP_NYY,
        gamePk: PK.nyy2,
        commenceTimeUtc: start,
        statusAbstract: "Preview",
      },
    ],
  });
  const calls: string[][] = [];
  const batch = await runPregameScheduler({
    dateKst: "2099-08-30",
    league: "MLB",
    dryRun: false,
    noProvider: true,
    includePostgame: false,
    json: false,
    now,
    cwd: batchCwd,
    persist: false,
    executeRunner: async (action) => {
      calls.push(action.args ?? []);
      return 0;
    },
  });
  const batchIds = batch.plans.map((p) => p.gameId).sort();
  assert.deepEqual(batchIds, ["mlb-game-823501", "mlb-game-823539"]);
  assert.equal(new Set(batch.plans.map((p) => p.lockKey)).size, 2);
  assert.equal(calls.length, 1);
  const gidIdx = calls[0]!.flatMap((a, i) => (a === "--game-id" ? [i] : []));
  const spawnedIds = gidIdx.map((i) => calls[0]![i + 1]).sort();
  assert.deepEqual(spawnedIds, ["mlb-game-823501", "mlb-game-823539"]);

  assert.equal(
    await detectLockedPrediction({
      league: "MLB",
      dateKst: "2099-08-30",
      gameId: "mlb-game-823539",
      cwd: batchCwd,
    }),
    false,
  );

  // --- consumer isolation ---
  const consCwd = mkdtempSync(path.join(tmpdir(), "mlb-eid-cons-"));
  const consDate = "2099-08-30";
  const matchup = MATCHUP_NYY;
  writeJson(
    consCwd,
    `data/research/mlb/${consDate}-daily-research-summary-v1.json`,
    {
      schemaVersion: MLB_DAILY_RESEARCH_SUMMARY_SCHEMA,
      dateKst: consDate,
      generatedAt: "2099-08-30T01:00:00.000Z",
      pipelineVersion: "test",
      researchReady: {
        percent: 100,
        datasets: [
          {
            dataset: "Schedule",
            status: "READY",
            artifact: `data/research/mlb/${consDate}-schedule-v1.json`,
          },
          {
            dataset: "Starter",
            status: "READY",
            artifact: `data/research/mlb/${consDate}-starter-dataset-v1.json`,
          },
          {
            dataset: "Odds",
            status: "READY",
            artifact: `data/research/mlb/${consDate}-odds-history-dataset-v1.json`,
          },
          {
            dataset: "Lineup",
            status: "READY",
            artifact: `data/research/mlb/${consDate}-lineup-dataset-v1.json`,
          },
        ],
      },
    },
  );
  writeJson(
    consCwd,
    `data/research/mlb/${consDate}-schedule-v1.json`,
    scheduleDoc(consDate, [
      {
        internalGameId: matchup,
        gamePk: PK.nyy1,
        homeTeam: "New York Yankees",
        awayTeam: "Boston Red Sox",
        homeTeamId: 147,
        awayTeamId: 111,
        startTimeKst: "18:00",
        commenceTimeUtc: "2099-08-30T09:00:00.000Z",
        officialDate: consDate,
        statusAbstract: "Preview",
        statusDetailed: "Scheduled",
        codedGameState: "S",
        league: "MLB",
      },
      {
        internalGameId: matchup,
        gamePk: PK.nyy2,
        homeTeam: "New York Yankees",
        awayTeam: "Boston Red Sox",
        homeTeamId: 147,
        awayTeamId: 111,
        startTimeKst: "21:00",
        commenceTimeUtc: "2099-08-30T12:00:00.000Z",
        officialDate: consDate,
        statusAbstract: "Preview",
        statusDetailed: "Scheduled",
        codedGameState: "S",
        league: "MLB",
      },
    ]),
  );
  writeJson(consCwd, `data/research/mlb/${consDate}-starter-dataset-v1.json`, {
    meta: { generatedAt: "2099-08-30T01:00:00.000Z", schemaVersion: "v1" },
    summary: { targetGameIncludedInStats: 0, cutoffViolations: 0 },
    rows: [
      {
        gameId: matchup,
        gamePk: PK.nyy1,
        side: "home",
        probablePitcherName: "Gerrit Cole",
        probablePitcherId: 543037,
      },
      {
        gameId: matchup,
        gamePk: PK.nyy1,
        side: "away",
        probablePitcherName: "Brayan Bello",
        probablePitcherId: 678394,
      },
      {
        gameId: matchup,
        gamePk: PK.nyy2,
        side: "home",
        probablePitcherName: "Carlos Rodon",
        probablePitcherId: 607074,
      },
      {
        gameId: matchup,
        gamePk: PK.nyy2,
        side: "away",
        probablePitcherName: "Lucas Giolito",
        probablePitcherId: 608337,
      },
    ],
  });
  writeJson(consCwd, `data/research/mlb/${consDate}-odds-history-dataset-v1.json`, {
    meta: { generatedAt: "2099-08-30T01:00:00.000Z", schemaVersion: "v1" },
    rows: [
      {
        gameId: matchup,
        gamePk: PK.nyy1,
        eventId: "mlb-game-823539",
        collectionStatus: "COLLECTED",
        openingOdds: 1.7,
        latestOdds: 1.72,
        movement: "UP",
        markets: [
          { marketType: "moneyline", selection: "home", priceDecimal: 1.7 },
          { marketType: "moneyline", selection: "away", priceDecimal: 2.2 },
        ],
      },
      {
        gameId: matchup,
        gamePk: PK.nyy2,
        eventId: "mlb-game-823501",
        collectionStatus: "COLLECTED",
        openingOdds: 2.1,
        latestOdds: 2.05,
        movement: "DOWN",
        markets: [
          { marketType: "moneyline", selection: "home", priceDecimal: 2.1 },
          { marketType: "moneyline", selection: "away", priceDecimal: 1.8 },
        ],
      },
    ],
  });
  writeJson(consCwd, `data/research/mlb/${consDate}-lineup-dataset-v1.json`, {
    meta: { generatedAt: "2099-08-30T01:00:00.000Z", schemaVersion: "v1" },
    rows: [
      {
        gameId: matchup,
        gamePk: PK.nyy1,
        side: "home",
        collectionStatus: "CONFIRMED",
        lineupStatus: "COMPLETE",
        batters: [{ slot: 1, name: "Judge" }],
      },
      {
        gameId: matchup,
        gamePk: PK.nyy1,
        side: "away",
        collectionStatus: "CONFIRMED",
        lineupStatus: "COMPLETE",
        batters: [{ slot: 1, name: "Devers" }],
      },
      {
        gameId: matchup,
        gamePk: PK.nyy2,
        side: "home",
        collectionStatus: "CONFIRMED",
        lineupStatus: "COMPLETE",
        batters: [{ slot: 1, name: "Stanton" }],
      },
      {
        gameId: matchup,
        gamePk: PK.nyy2,
        side: "away",
        collectionStatus: "CONFIRMED",
        lineupStatus: "COMPLETE",
        batters: [{ slot: 1, name: "Yoshida" }],
      },
    ],
  });

  const prevCwd = process.cwd();
  process.chdir(consCwd);
  let consumer;
  try {
    consumer = await loadMlbPredictionConsumerInput(consDate);
  } finally {
    process.chdir(prevCwd);
  }
  assert.equal(consumer.kind, "ready");
  if (consumer.kind !== "ready") throw new Error("consumer blocked");
  assert.equal(consumer.games.length, 2);
  const e1 = consumer.games.find((g) => g.gamePk === PK.nyy1)!;
  const e2 = consumer.games.find((g) => g.gamePk === PK.nyy2)!;
  assert.equal(e1.eventId, "mlb-game-823539");
  assert.equal(e2.eventId, "mlb-game-823501");
  assert.equal(e1.matchupId, matchup);
  assert.equal(e2.matchupId, matchup);
  assert.notEqual(
    e1.analysisData.home.startingPitcher?.name,
    e2.analysisData.home.startingPitcher?.name,
  );
  assert.equal(e1.analysisData.home.startingPitcher?.name, "Gerrit Cole");
  assert.equal(e2.analysisData.home.startingPitcher?.name, "Carlos Rodon");
  assert.notEqual(e1.homeOdds, e2.homeOdds);
  assert.equal(e1.homeOdds, 1.7);
  assert.equal(e2.homeOdds, 2.1);
  assert.notEqual(
    e1.inputWarnings.join(),
    "IDENTITY_AMBIGUOUS",
  );
  assert.equal(e1.inputStatus, "ELIGIBLE");
  assert.equal(e2.inputStatus, "ELIGIBLE");

  // --- snapshot uniqueness ---
  const snap = buildPredictionSnapshotV0({
    load: {
      kind: "ready",
      dateKst: consDate,
      predictedAt: "2099-08-30T01:00:00.000Z",
      inputManifestHash: "abc",
      games: [
        stubGame({
          eventId: "mlb-game-823539",
          gamePk: PK.nyy1,
          matchupId: matchup,
          homeP: 0.55,
        }),
        stubGame({
          eventId: "mlb-game-823501",
          gamePk: PK.nyy2,
          matchupId: matchup,
          homeP: 0.45,
        }),
      ],
      sourceSnapshotVersions: {},
      consumer,
    },
    generatedAt: "2099-08-30T01:00:00.000Z",
    dryRun: true,
    observationOnly: true,
    useMarketPrior: true,
  });
  const pA = snap.predictions.find((p) => p.gamePk === PK.nyy1)!;
  const pB = snap.predictions.find((p) => p.gamePk === PK.nyy2)!;
  assert.equal(pA.eventId, "mlb-game-823539");
  assert.equal(pB.eventId, "mlb-game-823501");
  assert.equal(pA.matchupId, pB.matchupId);
  assert.notEqual(pA.predictionId, pB.predictionId);
  assert.equal(pA.predictionId, "mlb-game-823539:mlb-baseline-v0");
  assert.equal(pB.predictionId, "mlb-game-823501:mlb-baseline-v0");

  // --- grade A vs B ---
  const gradeCwd = mkdtempSync(path.join(tmpdir(), "mlb-eid-grade-"));
  const gradeDate = "2099-08-31";
  writeJson(
    gradeCwd,
    `data/research/mlb/${gradeDate}-schedule-v1.json`,
    scheduleDoc(gradeDate, [
      {
        internalGameId: matchup,
        gamePk: PK.nyy1,
        homeTeam: "New York Yankees",
        awayTeam: "Boston Red Sox",
        homeTeamId: 147,
        awayTeamId: 111,
        startTimeKst: "18:00",
        commenceTimeUtc: "2099-08-31T09:00:00.000Z",
        officialDate: gradeDate,
        statusAbstract: "Final",
        statusDetailed: "Final",
        codedGameState: "F",
        league: "MLB",
      },
      {
        internalGameId: matchup,
        gamePk: PK.nyy2,
        homeTeam: "New York Yankees",
        awayTeam: "Boston Red Sox",
        homeTeamId: 147,
        awayTeamId: 111,
        startTimeKst: "21:00",
        commenceTimeUtc: "2099-08-31T12:00:00.000Z",
        officialDate: gradeDate,
        statusAbstract: "Final",
        statusDetailed: "Final",
        codedGameState: "F",
        league: "MLB",
      },
    ]),
  );
  writeJson(gradeCwd, `data/predictions/mlb/${gradeDate}.json`, {
    meta: { dateKst: gradeDate, modelStatus: "RESEARCH_BASELINE_V0" },
    predictions: [
      {
        gameId: matchup,
        eventId: "mlb-game-823539",
        gamePk: PK.nyy1,
        matchupId: matchup,
        homeTeam: "New York Yankees",
        awayTeam: "Boston Red Sox",
        baselinePick: "New York Yankees",
        inputStatus: "ELIGIBLE",
        officialStatus: "PASS",
      },
      {
        gameId: matchup,
        eventId: "mlb-game-823501",
        gamePk: PK.nyy2,
        matchupId: matchup,
        homeTeam: "New York Yankees",
        awayTeam: "Boston Red Sox",
        baselinePick: "Boston Red Sox",
        inputStatus: "ELIGIBLE",
        officialStatus: "PASS",
      },
    ],
  });
  const results: MlbOfficialResultsDocument = {
    schemaVersion: MLB_OFFICIAL_RESULTS_SCHEMA,
    dateKst: gradeDate,
    generatedAt: "2099-08-31T20:00:00.000Z",
    provider: "mlb-stats-api",
    scheduleArtifact: `data/research/mlb/${gradeDate}-schedule-v1.json`,
    resultHash: "",
    games: [
      {
        gamePk: PK.nyy1,
        internalGameId: matchup,
        status: "FINAL",
        awayTeam: "Boston Red Sox",
        homeTeam: "New York Yankees",
        awayScore: 1,
        homeScore: 5,
        winner: "HOME",
        resultTimestamp: "2099-08-31T12:00:00.000Z",
      },
      {
        gamePk: PK.nyy2,
        internalGameId: matchup,
        status: "FINAL",
        awayTeam: "Boston Red Sox",
        homeTeam: "New York Yankees",
        awayScore: 4,
        homeScore: 2,
        winner: "AWAY",
        resultTimestamp: "2099-08-31T15:00:00.000Z",
      },
    ],
  };
  const graded = await gradeMlbPredictionsV1({
    dateKst: gradeDate,
    cwd: gradeCwd,
    results,
  });
  const gA = graded.document.games.find((g) => g.gamePk === PK.nyy1)!;
  const gB = graded.document.games.find((g) => g.gamePk === PK.nyy2)!;
  assert.equal(gA.matchStatus, "MATCHED");
  assert.equal(gB.matchStatus, "MATCHED");
  assert.equal(gA.actualWinner, "HOME");
  assert.equal(gB.actualWinner, "AWAY");
  assert.notEqual(gA.gamePk, gB.gamePk);

  const legacyCwd = mkdtempSync(path.join(tmpdir(), "mlb-eid-legacy-"));
  writeJson(
    legacyCwd,
    `data/research/mlb/${gradeDate}-schedule-v1.json`,
    scheduleDoc(gradeDate, [
      {
        internalGameId: matchup,
        gamePk: PK.nyy1,
        homeTeam: "New York Yankees",
        awayTeam: "Boston Red Sox",
        homeTeamId: 147,
        awayTeamId: 111,
        startTimeKst: "18:00",
        commenceTimeUtc: "2099-08-31T09:00:00.000Z",
        officialDate: gradeDate,
        statusAbstract: "Final",
        statusDetailed: "Final",
        codedGameState: "F",
        league: "MLB",
      },
      {
        internalGameId: matchup,
        gamePk: PK.nyy2,
        homeTeam: "New York Yankees",
        awayTeam: "Boston Red Sox",
        homeTeamId: 147,
        awayTeamId: 111,
        startTimeKst: "21:00",
        commenceTimeUtc: "2099-08-31T12:00:00.000Z",
        officialDate: gradeDate,
        statusAbstract: "Final",
        statusDetailed: "Final",
        codedGameState: "F",
        league: "MLB",
      },
    ]),
  );
  writeJson(legacyCwd, `data/predictions/mlb/${gradeDate}.json`, {
    meta: { dateKst: gradeDate },
    predictions: [
      {
        gameId: matchup,
        homeTeam: "New York Yankees",
        awayTeam: "Boston Red Sox",
        baselinePick: "New York Yankees",
        inputStatus: "ELIGIBLE",
      },
      {
        gameId: matchup,
        homeTeam: "New York Yankees",
        awayTeam: "Boston Red Sox",
        baselinePick: "Boston Red Sox",
        inputStatus: "ELIGIBLE",
      },
    ],
  });
  const legacyGraded = await gradeMlbPredictionsV1({
    dateKst: gradeDate,
    cwd: legacyCwd,
    results,
  });
  assert.ok(
    legacyGraded.document.games.every((g) => g.matchStatus === "DUPLICATE_MATCH"),
  );
  assert.ok(legacyGraded.document.games.every((g) => g.grade === "MATCH_ERROR"));
  assert.ok(
    legacyGraded.document.games.some((g) =>
      g.warnings.includes(MLB_IDENTITY_AMBIGUOUS),
    ),
  );

  // --- daily picks two cards ---
  const picksCwd = mkdtempSync(path.join(tmpdir(), "mlb-eid-picks-"));
  writeJson(picksCwd, `data/predictions/mlb/${consDate}.json`, {
    meta: {
      dateKst: consDate,
      generatedAt: "2099-08-30T01:00:00.000Z",
      predictionHashSha256: "abc",
      modelStatus: "RESEARCH_BASELINE_V0",
    },
    predictions: [
      {
        gameId: matchup,
        eventId: "mlb-game-823539",
        gamePk: PK.nyy1,
        homeTeam: "New York Yankees",
        awayTeam: "Boston Red Sox",
        baselinePick: "New York Yankees",
        confidence: 40,
        modelProbability: 55,
        researchOnly: true,
        officialPick: null,
        inputStatus: "ELIGIBLE",
      },
      {
        gameId: matchup,
        eventId: "mlb-game-823501",
        gamePk: PK.nyy2,
        homeTeam: "New York Yankees",
        awayTeam: "Boston Red Sox",
        baselinePick: "Boston Red Sox",
        confidence: 41,
        modelProbability: 45,
        researchOnly: true,
        officialPick: null,
        inputStatus: "ELIGIBLE",
      },
    ],
  });
  const picks = await loadDailyPicksV1({
    dateKst: consDate,
    cwd: picksCwd,
    sealDeliveryRecord: false,
  });
  const cards = [
    ...picks.strongPicks,
    ...picks.goodPicks,
    ...picks.reconstructedPicks,
    ...picks.leanPicks,
    ...picks.passGames,
    ...picks.avoidGames,
  ];
  assert.equal(cards.length, 2);
  const c1 = cards.find((c) => c.gamePk === PK.nyy1)!;
  const c2 = cards.find((c) => c.gamePk === PK.nyy2)!;
  assert.equal(c1.eventId, "mlb-game-823539");
  assert.equal(c2.eventId, "mlb-game-823501");
  assert.notEqual(c1.detailHref, c2.detailHref);
  assert.match(c1.detailHref ?? "", /\/823539\?/);
  assert.match(c2.detailHref ?? "", /\/823501\?/);

  assert.equal(canonicalSchedulerGameId("KBO", { gamePk: 12, internalGameId: "kbo-slug" }), "12");
  assert.equal(MLB_AMBIGUOUS_MATCHUP_ID, "AMBIGUOUS_MATCHUP_ID");

  for (const [rel, hash] of Object.entries(historicalHashes)) {
    assert.equal(sha256File(rel), hash, `HISTORICAL_ARTIFACT_REWRITE ${rel}`);
  }

  console.log("test:mlb-event-identity-v1 PASS");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

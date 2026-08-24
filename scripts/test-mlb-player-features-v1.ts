/**
 * MLB Pregame Player Feature Dataset v1 tests.
 * Research sidecar only. No live Stats API. No 2026-08-24 provider run.
 *
 *   npm run test:mlb-player-features-v1
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  mkdtempSync,
  readFileSync,
  readdirSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { BASEBALL_EDGE_WEIGHTS } from "../src/lib/edge/weights";
import { MLB_PREDICTION_V0_WEIGHTS } from "../src/lib/mlb/prediction-v0/config";
import {
  PLAYER_FEATURES_TEMPORAL_POLICY,
  assertNoOfficialDateLeak,
  bbRate,
  buildPlayerFeatureDataset,
  filterGameLogAsOf,
  hashPlayerFeatureDataset,
  hrRate,
  kRate,
  recentWindowStartDate,
  runPlayerFeatures,
  statsThroughDateForGame,
  type GameIdentity,
  type IdentityBatter,
  type PlayerFeatureSources,
  type PlayerFeatureStatLookup,
  type ScheduleGameLite,
} from "../src/lib/mlb/player-features-v1";
import { MANDATORY_STAGE_WEIGHTS } from "../src/lib/reporting/v1/types";

const ROOT = process.cwd();
const DATE = "2026-08-25";
const OFFICIAL = "2026-08-25";
const D1 = "2026-08-24";
const GEN = "2026-08-24T12:00:00.000Z";
const BEFORE_CUTOFF_MS = Date.parse("2026-08-25T16:00:00.000Z");
const AFTER_CUTOFF_MS = Date.parse("2026-08-25T17:20:00.000Z");
const COMMENCE = "2026-08-25T17:10:00.000Z";

const FROZEN_PATHS = [
  "data/audits/2026-08-24-stage-b-pregame-inputs-close-v1.json",
  "data/audits/2026-08-24-stage-c-prediction-close-v1.json",
  "data/audits/2026-08-24-daily-scope-lock-v1.json",
  "data/audits/2026-08-24-pregame-close-v1.json",
  "data/research/mlb/2026-08-24-schedule-v1.json",
  "data/research/mlb/lineup-refresh/2026-08-24/manifest-v1.json",
  "data/research/mlb/batter-pregame/2026-08-24/manifest-v1.json",
  "data/predictions/mlb/2026-08-20.json",
  "data/recommendations/mlb/2026-08-17-engine-recommendations-v1.json",
  "src/lib/mlb/prediction-v0/config.ts",
  "src/lib/reporting/v1/types.ts",
  "src/lib/edge/weights.ts",
];

function sha256File(rel: string): string {
  return createHash("sha256")
    .update(readFileSync(path.join(ROOT, rel)))
    .digest("hex");
}

function snapshotFrozen(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const rel of FROZEN_PATHS) out[rel] = sha256File(rel);
  return out;
}

function nineBatters(startId: number): IdentityBatter[] {
  return Array.from({ length: 9 }, (_, i) => ({
    battingOrder: i + 1,
    playerId: startId + i,
    playerName: `Batter ${startId + i}`,
    defensivePosition: i === 1 ? "C" : "RF",
    bats: i % 2 === 0 ? "L" : "R",
  }));
}

function scheduleGame(
  gamePk: number,
  extra?: Partial<ScheduleGameLite>,
): ScheduleGameLite {
  return {
    gameId: `g-${gamePk}`,
    gamePk,
    homeTeam: "NYY",
    awayTeam: "BOS",
    commenceTimeUtc: COMMENCE,
    officialDate: OFFICIAL,
    ...extra,
  };
}

function confirmedIdentity(
  gamePk: number,
  extra?: Partial<GameIdentity>,
): GameIdentity {
  return {
    gamePk,
    lineupStatus: "CONFIRMED",
    collectionPhase: "PRE_GAME",
    home: { teamName: "NYY", batters: nineBatters(1000) },
    away: { teamName: "BOS", batters: nineBatters(2000) },
    homeStarter: {
      playerId: 10,
      playerName: "Home Starter",
      throws: "R",
      starterStatus: "PROBABLE",
    },
    awayStarter: {
      playerId: 20,
      playerName: "Away Starter",
      throws: "L",
      starterStatus: "PROBABLE",
    },
    lineupObservationId: `obs-${gamePk}`,
    lineupPayloadHash: `payload-${gamePk}`,
    lineupRel: `data/research/mlb/lineup-refresh/${DATE}/raw/${gamePk}/observations/obs.json`,
    ...extra,
  };
}

function hittingSplit(input: {
  date: string;
  gamePk: number;
  pa: number;
  ab?: number;
  h?: number;
  hr?: number;
  bb?: number;
  so?: number;
  tb?: number;
}): unknown {
  return {
    date: input.date,
    game: { gamePk: input.gamePk },
    stat: {
      gamesPlayed: 1,
      plateAppearances: input.pa,
      atBats: input.ab ?? input.pa,
      hits: input.h ?? 0,
      doubles: 0,
      triples: 0,
      homeRuns: input.hr ?? 0,
      baseOnBalls: input.bb ?? 0,
      strikeOuts: input.so ?? 0,
      totalBases: input.tb ?? input.h ?? 0,
      avg: 0.25,
      obp: 0.32,
      slg: 0.4,
      ops: 0.72,
      babip: 0.28,
    },
  };
}

function gameLogBody(splits: unknown[]): unknown {
  return { stats: [{ splits }] };
}

function personBody(name: string, bats: string, throws: string): unknown {
  return {
    people: [
      {
        fullName: name,
        batSide: { code: bats },
        pitchHand: { code: throws },
        primaryPosition: { abbreviation: "RF" },
      },
    ],
  };
}

function platoonBody(): unknown {
  return {
    stats: [
      {
        splits: [
          {
            split: { code: "vl" },
            stat: {
              plateAppearances: 80,
              avg: 0.26,
              obp: 0.33,
              slg: 0.42,
              ops: 0.75,
              babip: 0.29,
              homeRuns: 6,
              baseOnBalls: 10,
              strikeOuts: 18,
            },
          },
          {
            split: { code: "vr" },
            stat: {
              plateAppearances: 210,
              avg: 0.24,
              obp: 0.3,
              slg: 0.38,
              ops: 0.68,
              babip: 0.27,
              homeRuns: 12,
              baseOnBalls: 18,
              strikeOuts: 40,
            },
          },
        ],
      },
    ],
  };
}

function pitchingBody(): unknown {
  return gameLogBody([
    {
      date: "2026-08-20",
      game: { gamePk: 9 },
      stat: {
        inningsPitched: "6.0",
        earnedRuns: 2,
        hits: 5,
        baseOnBalls: 2,
        strikeOuts: 8,
        homeRuns: 1,
        gamesStarted: 1,
        battersFaced: 24,
      },
    },
    {
      date: OFFICIAL,
      game: { gamePk: 777001 },
      stat: {
        inningsPitched: "5.0",
        earnedRuns: 9,
        hits: 12,
        baseOnBalls: 6,
        strikeOuts: 1,
        homeRuns: 4,
        gamesStarted: 1,
        battersFaced: 28,
      },
    },
  ]);
}

function defaultHitting(targetGamePk = 777001): unknown {
  return gameLogBody([
    hittingSplit({
      date: D1,
      gamePk: 11,
      pa: 4,
      ab: 3,
      h: 1,
      hr: 1,
      bb: 1,
      so: 1,
      tb: 4,
    }),
    hittingSplit({
      date: "2026-08-11",
      gamePk: 12,
      pa: 4,
      ab: 4,
      h: 1,
      so: 1,
      tb: 1,
    }),
    hittingSplit({
      date: "2026-08-10",
      gamePk: 13,
      pa: 4,
      ab: 4,
      so: 1,
    }),
    hittingSplit({
      date: OFFICIAL,
      gamePk: 14,
      pa: 4,
      ab: 4,
      h: 4,
      hr: 4,
      tb: 16,
    }),
    hittingSplit({
      date: D1,
      gamePk: targetGamePk,
      pa: 4,
      ab: 4,
      h: 4,
      hr: 4,
      tb: 16,
    }),
  ]);
}

function lookupForIds(playerIds: number[]): PlayerFeatureStatLookup {
  const idSet = new Set(playerIds);
  return {
    person: (id) =>
      idSet.has(id) ? personBody(`Player ${id}`, "L", "R") : null,
    hittingGameLog: (id) => (idSet.has(id) ? defaultHitting() : null),
    pitchingGameLog: (id) => (id === 10 || id === 20 ? pitchingBody() : null),
    hittingSplits: (id) => (idSet.has(id) ? platoonBody() : null),
    hittingSplitsDateBounded: () => true,
  };
}

function sourcesFor(
  games: ScheduleGameLite[],
  identities: GameIdentity[],
): PlayerFeatureSources {
  const identityByGamePk: Record<number, GameIdentity> = {};
  for (const identity of identities) identityByGamePk[identity.gamePk] = identity;
  return { scheduleGames: games, identityByGamePk };
}

function moduleSourceScan(): string {
  const dir = path.join(ROOT, "src/lib/mlb/player-features-v1");
  return readdirSync(dir)
    .filter((f) => f.endsWith(".ts"))
    .map((f) => readFileSync(path.join(dir, f), "utf8"))
    .join("\n");
}

const FULL_LOOKUP_IDS = [
  ...nineBatters(1000).map((b) => b.playerId),
  ...nineBatters(2000).map((b) => b.playerId),
  10,
  20,
];

async function testA_PostCutoffZeroFetches() {
  const result = await buildPlayerFeatureDataset({
    dateKst: DATE,
    nowMs: AFTER_CUTOFF_MS,
    generatedAt: GEN,
    sources: sourcesFor([scheduleGame(777001)], [confirmedIdentity(777001)]),
    lookup: lookupForIds(FULL_LOOKUP_IDS),
  });
  assert.equal(result.featureFetchAttempts, 0);
  assert.equal(result.networkCalls, 0);
  assert.equal(result.document.games[0]!.featureStatus, "BLOCKED_POST_CUTOFF");
  assert.equal(result.document.games[0]!.home.batters.length, 9);
  assert.equal(
    result.document.games[0]!.home.batters[0]!.seasonToDate.availability,
    "NOT_AVAILABLE",
  );
  console.log("PASS A post-cutoff: 0 provider calls, no pregame feature capture");
}

async function testB_ConfirmedLineupJoin() {
  const identity = confirmedIdentity(777001);
  const result = await buildPlayerFeatureDataset({
    dateKst: DATE,
    nowMs: BEFORE_CUTOFF_MS,
    generatedAt: GEN,
    sources: sourcesFor([scheduleGame(777001)], [identity]),
    lookup: lookupForIds(FULL_LOOKUP_IDS),
  });
  assert.deepEqual(
    result.document.games[0]!.home.batters.map((b) => b.playerId),
    identity.home.batters.map((b) => b.playerId),
  );
  assert.equal(result.document.games[0]!.home.batters.length, 9);
  assert.equal(result.document.games[0]!.away.batters.length, 9);
  assert.equal(result.document.games[0]!.featureStatus, "READY");
  assert.equal(result.document.games[0]!.home.batters[0]!.role, "BATTER");
  assert.equal(result.document.games[0]!.home.starter.role, "STARTER");
  console.log("PASS B confirmed PRE_GAME lineup joins batter features");
}

async function testC_PartialLineupNotFabricated() {
  const identity = confirmedIdentity(777001, {
    lineupStatus: "PARTIAL",
    home: { teamName: "NYY", batters: nineBatters(1000).slice(0, 5) },
  });
  const result = await buildPlayerFeatureDataset({
    dateKst: DATE,
    nowMs: BEFORE_CUTOFF_MS,
    generatedAt: GEN,
    sources: sourcesFor([scheduleGame(777001)], [identity]),
    lookup: lookupForIds(FULL_LOOKUP_IDS),
  });
  assert.equal(result.document.games[0]!.home.batters.length, 5);
  assert.equal(result.document.games[0]!.away.batters.length, 9);
  assert.equal(result.document.games[0]!.featureStatus, "PARTIAL");
  console.log("PASS C partial lineup: missing players are not fabricated");
}

function testD_D1Cutoff() {
  const through = statsThroughDateForGame({
    dateKst: DATE,
    officialDate: OFFICIAL,
  });
  assert.equal(through, D1);
  assert.equal(PLAYER_FEATURES_TEMPORAL_POLICY, "OFFICIAL_DATE_MINUS_ONE_DAY");
  assert.equal(recentWindowStartDate(through, 14), "2026-08-11");
  assert.equal(recentWindowStartDate(through, 30), "2026-07-26");
  assert.ok(through < OFFICIAL);
  console.log("PASS D D-1 cutoff: officialDate never inside stats window");
}

async function testE_NoResultFields() {
  const result = await buildPlayerFeatureDataset({
    dateKst: DATE,
    nowMs: BEFORE_CUTOFF_MS,
    generatedAt: GEN,
    sources: sourcesFor([scheduleGame(777001)], [confirmedIdentity(777001)]),
    lookup: lookupForIds(FULL_LOOKUP_IDS),
  });
  const blob = JSON.stringify(result.document.games[0]);
  assert.equal(/"runsScored"|"winLoss"|"officialResult"|"scoreboard"/i.test(blob), false);
  assert.equal(
    "runs" in result.document.games[0]!.home.batters[0]!.seasonToDate.counting,
    false,
  );
  console.log("PASS E no target-game result fields in player feature rows");
}

async function testF_NoMarketFields() {
  const result = await buildPlayerFeatureDataset({
    dateKst: DATE,
    nowMs: BEFORE_CUTOFF_MS,
    generatedAt: GEN,
    sources: sourcesFor([scheduleGame(777001)], [confirmedIdentity(777001)]),
    lookup: lookupForIds(FULL_LOOKUP_IDS),
  });
  const blob = JSON.stringify(result.document);
  assert.equal(result.document.marketDataAllowed, false);
  assert.equal(result.document.predictionInputAllowed, false);
  assert.equal(/marketProbability|openingOdds|korean-market|impliedProbability/i.test(blob), false);
  console.log("PASS F no market / odds / marketProbability fields");
}

function testG_DerivedRateFormulas() {
  const k = kRate(10, 40);
  const bb = bbRate(8, 40);
  const hr = hrRate(2, 40);
  assert.equal(k.formula, "SO / PA");
  assert.equal(bb.formula, "BB / PA");
  assert.equal(hr.formula, "HR / PA");
  assert.equal(k.value, 0.25);
  assert.equal(bb.value, 0.2);
  assert.equal(hr.value, 0.05);
  assert.equal(k.parentAvailable, true);
  console.log("PASS G derived K_RATE / BB_RATE / HR_RATE formulas");
}

function testH_PaZeroNullRates() {
  assert.equal(kRate(0, 0).value, null);
  assert.equal(bbRate(5, 0).value, null);
  assert.equal(hrRate(null, 0).value, null);
  assert.equal(kRate(null, null).value, null);
  console.log("PASS H PA=0 produces null rates, not fake 0");
}

async function testI_WindowsEndAtD1() {
  const result = await buildPlayerFeatureDataset({
    dateKst: DATE,
    nowMs: BEFORE_CUTOFF_MS,
    generatedAt: GEN,
    sources: sourcesFor([scheduleGame(777001)], [confirmedIdentity(777001)]),
    lookup: lookupForIds(FULL_LOOKUP_IDS),
  });
  const batter = result.document.games[0]!.home.batters[0]!;
  assert.equal(batter.seasonToDate.windowEndDate, D1);
  assert.equal(batter.last14Days.windowEndDate, D1);
  assert.equal(batter.last30Days.windowEndDate, D1);
  assert.equal(batter.last14Days.windowStartDate, "2026-08-11");
  assert.equal(batter.last30Days.windowStartDate, "2026-07-26");
  assert.equal(batter.last14Days.counting.pa, 8);
  assert.equal(batter.last30Days.counting.pa, 12);
  assert.equal(batter.seasonToDate.counting.pa, 12);
  console.log("PASS I LAST_14 and LAST_30 windows end at D-1");
}

async function testJ_PlatoonIncludesPa() {
  const result = await buildPlayerFeatureDataset({
    dateKst: DATE,
    nowMs: BEFORE_CUTOFF_MS,
    generatedAt: GEN,
    sources: sourcesFor([scheduleGame(777001)], [confirmedIdentity(777001)]),
    lookup: lookupForIds(FULL_LOOKUP_IDS),
  });
  const batter = result.document.games[0]!.home.batters[0]!;
  assert.equal(batter.platoon.vsLhp.pa, 80);
  assert.equal(batter.platoon.vsRhp.pa, 210);
  assert.equal(batter.platoon.vsLhp.sampleSizePa, 80);
  assert.equal(batter.platoon.opponentStarterThrows, "L");
  assert.equal(batter.platoon.selectedPlatoonSplit, "VS_LHP");
  assert.equal(batter.platoon.numericMatchupAdjustment, null);
  console.log("PASS J platoon feature always includes PA/sample size");
}

async function testK_DoubleheaderGamePkUnique() {
  const result = await buildPlayerFeatureDataset({
    dateKst: DATE,
    nowMs: BEFORE_CUTOFF_MS,
    generatedAt: GEN,
    sources: sourcesFor(
      [
        scheduleGame(777001, { commenceTimeUtc: "2026-08-25T17:10:00.000Z" }),
        scheduleGame(777002, { commenceTimeUtc: "2026-08-25T21:10:00.000Z" }),
      ],
      [confirmedIdentity(777001), confirmedIdentity(777002)],
    ),
    lookup: lookupForIds(FULL_LOOKUP_IDS),
  });
  const pks = result.document.games.map((g) => g.gamePk);
  assert.deepEqual(pks, [777001, 777002]);
  assert.equal(new Set(pks).size, 2);
  console.log("PASS K doubleheader: gamePk remains unique");
}

async function testL_WriteOnce() {
  const cwd = mkdtempSync(path.join(tmpdir(), "player-features-"));
  const sources = sourcesFor([scheduleGame(777001)], [confirmedIdentity(777001)]);
  const lookup = lookupForIds(FULL_LOOKUP_IDS);
  const first = await runPlayerFeatures({
    dateKst: DATE,
    cwd,
    nowMs: BEFORE_CUTOFF_MS,
    generatedAt: GEN,
    sources,
    lookup,
  });
  assert.equal(first.written, true);
  const datasetRel = path.join(
    cwd,
    "data/research/mlb/player-features",
    DATE,
    "dataset-v1.json",
  );
  const before = readFileSync(datasetRel, "utf8");
  const second = await runPlayerFeatures({
    dateKst: DATE,
    cwd,
    nowMs: BEFORE_CUTOFF_MS,
    generatedAt: "2026-08-24T18:00:00.000Z",
    sources,
    lookup,
  });
  assert.equal(second.written, false);
  assert.equal(second.skippedExisting, true);
  assert.equal(second.featureFetchAttempts, 0);
  assert.equal(readFileSync(datasetRel, "utf8"), before);
  console.log("PASS L write-once: existing dataset is not overwritten");
}

async function testM_DryRun() {
  const cwd = mkdtempSync(path.join(tmpdir(), "player-features-dry-"));
  const result = await runPlayerFeatures({
    dateKst: DATE,
    cwd,
    nowMs: BEFORE_CUTOFF_MS,
    generatedAt: GEN,
    dryRun: true,
    sources: sourcesFor([scheduleGame(777001)], [confirmedIdentity(777001)]),
    lookup: lookupForIds(FULL_LOOKUP_IDS),
  });
  assert.equal(result.written, false);
  assert.equal(result.featureFetchAttempts, 0);
  assert.equal(result.networkCalls, 0);
  assert.equal(result.document?.games[0]!.featureStatus, "SKIPPED_DRY_RUN");
  let missing = false;
  try {
    readFileSync(
      path.join(cwd, "data/research/mlb/player-features", DATE, "dataset-v1.json"),
    );
  } catch {
    missing = true;
  }
  assert.equal(missing, true);
  console.log("PASS M --dry-run: 0 provider calls, 0 writes");
}

async function testN_CacheOnly() {
  const cwd = mkdtempSync(path.join(tmpdir(), "player-features-cache-"));
  const result = await buildPlayerFeatureDataset({
    dateKst: DATE,
    cwd,
    nowMs: BEFORE_CUTOFF_MS,
    generatedAt: GEN,
    cacheOnly: true,
    sources: sourcesFor([scheduleGame(777001)], [confirmedIdentity(777001)]),
  });
  assert.equal(result.networkCalls, 0);
  console.log("PASS N --cache-only: 0 network calls");
}

async function testO_StableHash() {
  const input = {
    dateKst: DATE,
    nowMs: BEFORE_CUTOFF_MS,
    sources: sourcesFor([scheduleGame(777001)], [confirmedIdentity(777001)]),
    lookup: lookupForIds(FULL_LOOKUP_IDS),
  };
  const a = await buildPlayerFeatureDataset({ ...input, generatedAt: GEN });
  const b = await buildPlayerFeatureDataset({
    ...input,
    generatedAt: "2026-08-24T18:00:00.000Z",
  });
  assert.equal(a.document.datasetHash, b.document.datasetHash);
  assert.equal(hashPlayerFeatureDataset(a.document), a.document.datasetHash);
  a.document.generatedAt = "changed";
  assert.equal(hashPlayerFeatureDataset(a.document), b.document.datasetHash);
  console.log("PASS O stable canonical dataset hash");
}

async function testPQR_Isolation(before: Record<string, string>) {
  await buildPlayerFeatureDataset({
    dateKst: DATE,
    nowMs: BEFORE_CUTOFF_MS,
    generatedAt: GEN,
    sources: sourcesFor([scheduleGame(777001)], [confirmedIdentity(777001)]),
    lookup: lookupForIds(FULL_LOOKUP_IDS),
  });
  const after = snapshotFrozen();
  for (const rel of FROZEN_PATHS) {
    assert.equal(after[rel], before[rel], rel);
  }
  assert.equal(MLB_PREDICTION_V0_WEIGHTS.marketPrior.value, 0.25);
  assert.equal(MLB_PREDICTION_V0_WEIGHTS.lineup.value, 0);
  assert.equal(MANDATORY_STAGE_WEIGHTS.B_PREGAME_INPUT, 20);
  assert.equal(BASEBALL_EDGE_WEIGHTS.startingPitcher, 20);
  console.log("PASS P Prediction Snapshot unchanged");
  console.log("PASS Q Recommendation Record unchanged");
  console.log("PASS R Engine/Weight files unmodified");
}

function testS_NoMarketImport() {
  const src = moduleSourceScan();
  assert.equal(/from ["'].*odds/i.test(src), false);
  assert.equal(/from ["'].*market/i.test(src), false);
  assert.equal(/from ["'].*prediction-v0/i.test(src), false);
  assert.equal(/from ["'].*recommendation/i.test(src), false);
  assert.equal(/from ["'].*edge\/weights/i.test(src), false);
  console.log("PASS S no market import is required by the player-feature builder");
}

function testT_HistoricalLeakageRejected() {
  const leaky = [
    { date: OFFICIAL, game: { gamePk: 99 }, stat: { plateAppearances: 4 } },
    { date: "2026-08-26", game: { gamePk: 100 }, stat: { plateAppearances: 4 } },
  ];
  const filtered = filterGameLogAsOf({
    splits: leaky,
    targetGamePk: 777001,
    statsThroughDate: D1,
  });
  assert.equal(filtered.kept.length, 0);
  assert.ok(filtered.excludedSameDayOrLater >= 2);
  assert.throws(() => {
    assertNoOfficialDateLeak({
      splits: leaky,
      officialDate: OFFICIAL,
      statsThroughDate: D1,
    });
  });
  console.log("PASS T mock stat dated on/after officialDate is rejected");
}

function testForceRejected() {
  const proc = spawnSync(
    "npx",
    ["tsx", "scripts/run-mlb-player-features-v1.ts", "--force"],
    { encoding: "utf8", cwd: ROOT, shell: true },
  );
  assert.notEqual(proc.status, 0);
  assert.match(`${proc.stderr}${proc.stdout}`, /write-once|not allowed/i);
  console.log("PASS --force overwrite is rejected");
}

async function testUnavailableLineup() {
  const result = await buildPlayerFeatureDataset({
    dateKst: DATE,
    nowMs: BEFORE_CUTOFF_MS,
    generatedAt: GEN,
    sources: sourcesFor(
      [scheduleGame(777001)],
      [
        confirmedIdentity(777001, {
          lineupStatus: "UNAVAILABLE",
          home: { teamName: "NYY", batters: [] },
          away: { teamName: "BOS", batters: [] },
        }),
      ],
    ),
    lookup: lookupForIds(FULL_LOOKUP_IDS),
  });
  assert.equal(result.featureFetchAttempts, 0);
  assert.equal(
    result.document.games[0]!.featureStatus,
    "BLOCKED_NO_CONFIRMED_LINEUP",
  );
  assert.equal(result.document.games[0]!.home.batters.length, 0);
  assert.equal(result.document.independentModelSample, 0);
  assert.equal(result.document.engineAdmission, "PROHIBITED");
  assert.equal(result.document.bullpenImplemented, false);
  assert.equal(result.document.playerStrengthGenerated, false);
  assert.equal(result.document.winProbabilityGenerated, false);
  console.log("PASS unavailable lineup blocks feature fetch; independent sample 0");
}

async function main() {
  const before = snapshotFrozen();
  testD_D1Cutoff();
  testG_DerivedRateFormulas();
  testH_PaZeroNullRates();
  testS_NoMarketImport();
  testT_HistoricalLeakageRejected();
  await testA_PostCutoffZeroFetches();
  await testB_ConfirmedLineupJoin();
  await testC_PartialLineupNotFabricated();
  await testE_NoResultFields();
  await testF_NoMarketFields();
  await testI_WindowsEndAtD1();
  await testJ_PlatoonIncludesPa();
  await testK_DoubleheaderGamePkUnique();
  await testL_WriteOnce();
  await testM_DryRun();
  await testN_CacheOnly();
  await testO_StableHash();
  await testPQR_Isolation(before);
  await testUnavailableLineup();
  testForceRejected();
  const after = snapshotFrozen();
  for (const rel of FROZEN_PATHS) {
    assert.equal(after[rel], before[rel], `frozen path mutated: ${rel}`);
  }
  process.stdout.write("test:mlb-player-features-v1 PASS\n");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.stack ?? err.message : err);
  process.exitCode = 1;
});

/**
 * Lineup temporal provenance vs source provenance.
 * Boxscore is a source, not a postgame phase.
 *
 *   npm run test:mlb-lineup-temporal-provenance-v1
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { MLB_PREDICTION_V0_WEIGHTS } from "../src/lib/mlb/prediction-v0/config";
import type { LineupDatasetDocument, LineupDatasetRow } from "../src/lib/mlb/lineup-dataset-types";
import {
  resolveLineupSource,
  resolveLineupTemporalPhase,
  resolvePreGameLineupStatus,
  isProvenPregameConfirmedLineup,
  TEMPORAL_PROVENANCE_UNPROVEN,
} from "../src/lib/mlb/lineup-temporal-phase";
import {
  buildBatterDatasetV0,
  type BatterDatasetSources,
} from "../src/lib/mlb/batter-dataset-v0";
import { MANDATORY_STAGE_WEIGHTS } from "../src/lib/reporting/v1/types";

const ROOT = process.cwd();
const GEN = "2026-08-20T14:09:18.381Z";
const CUTOFF = "2026-08-20T16:40:00.000Z";
const BEFORE = "2026-08-20T14:09:18.381Z";
const AFTER = "2026-08-20T17:00:00.000Z";
const FUTURE_NOW = Date.parse("2026-08-20T15:00:00.000Z");

function sha256File(rel: string): string {
  const raw = readFileSync(path.join(ROOT, rel), "utf8");
  return createHash("sha256").update(raw, "utf8").digest("hex");
}

function testSourceVsPhase() {
  assert.equal(
    resolveLineupSource({ usedBoxscore: true, usedScheduleLineups: false }),
    "mlb-statsapi-boxscore",
  );
  assert.equal(
    resolveLineupSource({ usedBoxscore: false, usedScheduleLineups: true }),
    "mlb-statsapi-schedule-lineups",
  );

  const boxBefore = resolveLineupTemporalPhase({
    sourceTimestamp: BEFORE,
    cutoffTime: CUTOFF,
  });
  assert.equal(boxBefore.collectionPhase, "PRE_GAME");
  assert.equal(boxBefore.beforeCutoff, true);

  const boxAfter = resolveLineupTemporalPhase({
    sourceTimestamp: AFTER,
    cutoffTime: CUTOFF,
  });
  assert.equal(boxAfter.collectionPhase, "POST_GAME");
  assert.equal(boxAfter.beforeCutoff, false);

  const schedBefore = resolveLineupTemporalPhase({
    sourceTimestamp: BEFORE,
    cutoffTime: CUTOFF,
  });
  assert.equal(schedBefore.collectionPhase, "PRE_GAME");

  const schedAfter = resolveLineupTemporalPhase({
    sourceTimestamp: AFTER,
    cutoffTime: CUTOFF,
  });
  assert.equal(schedAfter.collectionPhase, "POST_GAME");

  const missing = resolveLineupTemporalPhase({
    sourceTimestamp: null,
    cutoffTime: CUTOFF,
  });
  assert.equal(missing.collectionPhase, "UNKNOWN");
  assert.ok(missing.warnings.includes(TEMPORAL_PROVENANCE_UNPROVEN));
  assert.notEqual(missing.collectionPhase, "PRE_GAME");

  const completePregame = resolvePreGameLineupStatus({
    collectionPhase: "PRE_GAME",
    hasCollectedLineupData: true,
  });
  assert.equal(completePregame, "COLLECTED");

  const noData = resolvePreGameLineupStatus({
    collectionPhase: "PRE_GAME",
    hasCollectedLineupData: false,
  });
  assert.equal(noData, "NOT_COLLECTED");

  const post = resolvePreGameLineupStatus({
    collectionPhase: "POST_GAME",
    hasCollectedLineupData: true,
  });
  assert.equal(post, "NOT_COLLECTED");

  console.log("PASS source vs temporal phase (boxscore before/after cutoff, missing ts)");
}

function lineupRow(input: {
  phase: "PRE_GAME" | "POST_GAME" | "UNKNOWN";
  confirmed: boolean;
  partial?: boolean;
  playerIds: number[];
  sourceTimestamp: string | null;
  cutoffTime: string;
  preGameStatus?: "COLLECTED" | "NOT_COLLECTED";
  lineupSource?: string | null;
}): LineupDatasetRow {
  const complete = input.playerIds.length === 9;
  const collectionStatus = input.partial
    ? "PARTIAL"
    : input.confirmed
      ? "CONFIRMED"
      : "NOT_RELEASED";
  const preGameStatus =
    input.preGameStatus ??
    (input.phase === "PRE_GAME" && (input.confirmed || input.partial)
      ? "COLLECTED"
      : "NOT_COLLECTED");
  return {
    schemaVersion: "mlb-lineup-dataset-v1",
    builderVersion: "lineup-dataset-builder-v1",
    generatedAt: GEN,
    gameDate: "2026-08-21",
    gameId: "mlb-test-game",
    gamePk: 99,
    teamId: 1,
    teamName: "Home",
    opponentTeamId: 2,
    opponentTeamName: "Away",
    side: "home",
    lineupType: "ACTUAL_STARTING",
    collectionPhase: input.phase,
    preGameStatus,
    collectionStatus,
    confirmed: input.confirmed,
    lineupSource: input.lineupSource ?? "mlb-statsapi-boxscore",
    sourceTimestamp: input.sourceTimestamp,
    fetchedAt: input.sourceTimestamp,
    lineupConfirmedAt: input.confirmed ? input.sourceTimestamp : null,
    cutoffTime: input.cutoffTime,
    lineupStatus: complete ? "COMPLETE" : "INCOMPLETE",
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

function sourcesFromRows(rows: LineupDatasetRow[]): BatterDatasetSources {
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
      preGameStatus: "COLLECTED",
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
        gamePk: 99,
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

const NINE = [10, 11, 12, 13, 14, 15, 16, 17, 18];
const AWAY = [20, 21, 22, 23, 24, 25, 26, 27, 28];

async function testBatterAcceptsProvenPregame() {
  const home = lineupRow({
    phase: "PRE_GAME",
    confirmed: true,
    playerIds: NINE,
    sourceTimestamp: BEFORE,
    cutoffTime: CUTOFF,
    lineupSource: "mlb-statsapi-boxscore",
  });
  const away = {
    ...lineupRow({
      phase: "PRE_GAME",
      confirmed: true,
      playerIds: AWAY,
      sourceTimestamp: BEFORE,
      cutoffTime: CUTOFF,
      lineupSource: "mlb-statsapi-boxscore",
    }),
    side: "away" as const,
    teamId: 2,
    teamName: "Away",
    opponentTeamId: 1,
    opponentTeamName: "Home",
  };
  assert.equal(isProvenPregameConfirmedLineup(home), true);
  const { document } = await buildBatterDatasetV0({
    dateKst: "2026-08-21",
    generatedAt: GEN,
    nowMs: FUTURE_NOW,
    sources: sourcesFromRows([home, away]),
    statLookup: {
      person: () => null,
      hittingGameLog: () => null,
    },
  });
  assert.equal(document.games[0].home.lineupStatus, "CONFIRMED");
  assert.equal(document.games[0].home.batters[0].playerId, 10);
  assert.equal(document.summary.joinedPlayerIds, 18);
  console.log("PASS batter accepts proven CONFIRMED_PRE_GAME playerIds from pregame boxscore");
}

async function testBatterExcludesUnknownPostgamePartial() {
  const postgame = lineupRow({
    phase: "POST_GAME",
    confirmed: true,
    playerIds: NINE,
    sourceTimestamp: AFTER,
    cutoffTime: CUTOFF,
  });
  const unknown = lineupRow({
    phase: "UNKNOWN",
    confirmed: true,
    playerIds: NINE,
    sourceTimestamp: null,
    cutoffTime: CUTOFF,
    preGameStatus: "NOT_COLLECTED",
  });
  const partial = lineupRow({
    phase: "PRE_GAME",
    confirmed: false,
    partial: true,
    playerIds: NINE,
    sourceTimestamp: BEFORE,
    cutoffTime: CUTOFF,
  });
  assert.equal(isProvenPregameConfirmedLineup(postgame), false);
  assert.equal(isProvenPregameConfirmedLineup(unknown), false);
  assert.equal(isProvenPregameConfirmedLineup(partial), false);

  const postDoc = await buildBatterDatasetV0({
    dateKst: "2026-08-21",
    generatedAt: GEN,
    nowMs: FUTURE_NOW,
    sources: sourcesFromRows([
      postgame,
      { ...postgame, side: "away", teamId: 2, teamName: "Away" },
    ]),
    statLookup: { person: () => null, hittingGameLog: () => null },
  });
  assert.equal(postDoc.document.games[0].home.lineupStatus, "UNAVAILABLE");
  assert.equal(postDoc.document.games[0].home.batters[0].playerId, null);
  assert.ok(postDoc.document.games[0].warnings.includes("POSTGAME_LINEUP_EXCLUDED"));

  const unkDoc = await buildBatterDatasetV0({
    dateKst: "2026-08-21",
    generatedAt: GEN,
    nowMs: FUTURE_NOW,
    sources: sourcesFromRows([
      unknown,
      { ...unknown, side: "away", teamId: 2, teamName: "Away" },
    ]),
    statLookup: { person: () => null, hittingGameLog: () => null },
  });
  assert.equal(unkDoc.document.games[0].home.lineupStatus, "UNAVAILABLE");
  assert.ok(
    unkDoc.document.games[0].warnings.includes("TEMPORAL_PROVENANCE_UNPROVEN"),
  );

  const partDoc = await buildBatterDatasetV0({
    dateKst: "2026-08-21",
    generatedAt: GEN,
    nowMs: FUTURE_NOW,
    sources: sourcesFromRows([
      partial,
      { ...partial, side: "away", teamId: 2, teamName: "Away", battingOrder: [] },
    ]),
    statLookup: { person: () => null, hittingGameLog: () => null },
  });
  assert.notEqual(partDoc.document.games[0].home.lineupStatus, "CONFIRMED");
  assert.equal(partDoc.document.games[0].home.batters[0].playerId, null);
  console.log("PASS batter excludes postgame, unknown, and partial (never promoted)");
}

function testFrozenAndNoEngineChange() {
  const pred720 = sha256File("data/predictions/mlb/2026-07-30.json");
  const pred820 = sha256File("data/predictions/mlb/2026-08-20.json");
  const lineup820 = sha256File("data/research/mlb/2026-08-20-lineup-dataset-v1.json");
  const batter820 = sha256File("data/research/mlb/2026-08-20-batter-dataset-v0.json");
  assert.match(pred720, /^[a-f0-9]{64}$/);
  assert.equal(MLB_PREDICTION_V0_WEIGHTS.marketPrior.value, 0.25);
  assert.equal(MLB_PREDICTION_V0_WEIGHTS.lineup.value, 0);
  assert.equal(MANDATORY_STAGE_WEIGHTS.B_PREGAME_INPUT, 20);
  const pred720b = sha256File("data/predictions/mlb/2026-07-30.json");
  const pred820b = sha256File("data/predictions/mlb/2026-08-20.json");
  const lineup820b = sha256File("data/research/mlb/2026-08-20-lineup-dataset-v1.json");
  const batter820b = sha256File("data/research/mlb/2026-08-20-batter-dataset-v0.json");
  assert.equal(pred720b, pred720);
  assert.equal(pred820b, pred820);
  assert.equal(lineup820b, lineup820);
  assert.equal(batter820b, batter820);
  console.log("PASS 2026-08-20 frozen artifacts and prediction snapshots unchanged");
}

async function main() {
  testSourceVsPhase();
  await testBatterAcceptsProvenPregame();
  await testBatterExcludesUnknownPostgamePartial();
  testFrozenAndNoEngineChange();
  process.stdout.write("test:mlb-lineup-temporal-provenance-v1 PASS\n");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

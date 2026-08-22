/**
 * MLB Lineup Auto Refresh v1 — payload blobs vs observation events,
 * per-game cutoff, temporal admissibility, incremental batter capture.
 *
 *   npm run test:mlb-lineup-refresh-v1
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { MLB_PREDICTION_V0_WEIGHTS } from "../src/lib/mlb/prediction-v0/config";
import {
  BATTER_FETCH_GATE_POLICY,
  filterHittingGameLogAsOf,
  statsThroughDateForGame,
} from "../src/lib/mlb/batter-dataset-v0";
import {
  LATEST_ADMISSIBLE_PREGAME_SNAPSHOT_RULE,
  classifyBoxscoreBody,
  formatMlbLineupRefreshSummary,
  hashLineupPayload,
  latestAdmissiblePregameSnapshot,
  listLineupObservations,
  listLineupPayloadHashes,
  mlbBatterPregameGameAbs,
  mlbLineupObservationDir,
  mlbLineupPayloadDir,
  observationIdFor,
  resolveRefreshTemporalProvenance,
  runMlbLineupRefresh,
  selectAdmissiblePregameSnapshot,
  type LineupRefreshFetchFn,
  type LineupRefreshFetchResult,
} from "../src/lib/mlb/lineup-refresh-v1";

const ROOT = process.cwd();
const DATE = "2026-08-22";
const CUTOFF = "2026-08-22T16:40:00.000Z";
const NOW_PRE = Date.parse("2026-08-22T12:00:00.000Z");
const NOW_POST = Date.parse("2026-08-22T17:00:00.000Z");
const TS_EARLY = "2026-08-22T10:00:00.000Z";
const TS_MID = "2026-08-22T13:00:00.000Z";
const TS_LATE_OK = "2026-08-22T15:00:00.000Z";
const TS_AFTER_CUTOFF = "2026-08-22T16:50:00.000Z";
const EARLY_CUTOFF = "2026-08-22T09:40:00.000Z";
const LATE_CUTOFF = "2026-08-22T18:10:00.000Z";

const FROZEN_BATTER = "data/research/mlb/2026-08-21-batter-dataset-v0.json";
const FROZEN_PRED = "data/predictions/mlb/2026-07-30.json";
const FROZEN_0822_CLOSE = "data/audits/2026-08-22-pregame-close-v1.json";
const FROZEN_0822_STAGE_C = "data/audits/2026-08-22-stage-c-prediction-close-v1.json";
const tmpDirs: string[] = [];

function sha256File(rel: string): string {
  return createHash("sha256")
    .update(readFileSync(path.join(ROOT, rel)))
    .digest("hex");
}

function src(rel: string): string {
  return readFileSync(path.join(ROOT, rel), "utf8");
}

function ids(start: number, n: number): number[] {
  return Array.from({ length: n }, (_, i) => start + i);
}

function side(
  teamId: number,
  name: string,
  playerIds: number[],
): Record<string, unknown> {
  const players: Record<string, unknown> = {};
  playerIds.forEach((id, i) => {
    players[`ID${id}`] = {
      person: { id, fullName: `Player ${id}` },
      battingOrder: `${i + 1}00`,
      position: { abbreviation: "RF" },
      gameStatus: { isSubstitute: false },
    };
  });
  return { team: { id: teamId, name }, players };
}

function boxscore(homeIds: number[], awayIds: number[]): Record<string, unknown> {
  return {
    teams: {
      home: side(147, "Home", homeIds),
      away: side(121, "Away", awayIds),
    },
  };
}

function fetched(
  body: unknown,
  fetchedAt: string,
  sourceTimestamp: string | null | undefined = fetchedAt,
): LineupRefreshFetchResult {
  return {
    ok: true,
    status: 200,
    body,
    fetchedAt,
    sourceTimestamp,
  };
}

async function tmpCwd(prefix: string): Promise<string> {
  const cwd = await mkdtemp(path.join(os.tmpdir(), prefix));
  tmpDirs.push(cwd);
  return cwd;
}

function writeSchedule(
  cwd: string,
  games: Array<{
    gamePk: number;
    commence: string;
    home?: string;
    away?: string;
  }>,
): void {
  const doc = {
    meta: {
      datasetId: "mlb-schedule",
      schemaVersion: "mlb-schedule-v1",
      builderVersion: "schedule-artifact-builder-v1",
      dateKst: DATE,
      generatedAt: "2026-08-22T00:00:00.000Z",
      source: "mlb-stats-api",
      researchOnly: true,
      engineAdmission: "PROHIBITED",
      engineConnected: false,
    },
    summary: { totalGames: games.length },
    games: games.map((g) => ({
      internalGameId: `mlb-${g.away ?? "Away"}-${g.home ?? "Home"}-${g.gamePk}`,
      gamePk: g.gamePk,
      homeTeam: g.home ?? "Home",
      awayTeam: g.away ?? "Away",
      homeTeamId: 147,
      awayTeamId: 121,
      startTimeKst: "01:40",
      commenceTimeUtc: g.commence,
      scheduledStartTime: g.commence,
      officialDate: DATE,
      statusAbstract: "Preview",
      statusDetailed: "Pre-Game",
      codedGameState: "P",
      league: "MLB",
    })),
  };
  const abs = path.join(cwd, "data/research/mlb", `${DATE}-schedule-v1.json`);
  mkdirSync(path.dirname(abs), { recursive: true });
  writeFileSync(abs, `${JSON.stringify(doc, null, 2)}\n`, "utf8");
}

function jsonNames(dir: string): string[] {
  try {
    return readdirSync(dir)
      .filter((n) => n.endsWith(".json"))
      .sort();
  } catch {
    return [];
  }
}

function observationNames(cwd: string, gamePk: number): string[] {
  return jsonNames(mlbLineupObservationDir(DATE, gamePk, cwd));
}

function payloadNames(cwd: string, gamePk: number): string[] {
  return jsonNames(mlbLineupPayloadDir(DATE, gamePk, cwd));
}

function readText(abs: string): string {
  return readFileSync(abs, "utf8");
}

function countJsonUnder(dir: string): number {
  if (!existsSync(dir)) return 0;
  let n = 0;
  const walk = (d: string) => {
    for (const name of readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, name.name);
      if (name.isDirectory()) walk(p);
      else if (name.name.endsWith(".json")) n += 1;
    }
  };
  walk(dir);
  return n;
}

async function main() {
  const batterBefore = sha256File(FROZEN_BATTER);
  const predBefore = sha256File(FROZEN_PRED);
  const close22Before = sha256File(FROZEN_0822_CLOSE);
  const stageC22Before = sha256File(FROZEN_0822_STAGE_C);

  const emptyBody = boxscore([], []);
  const confirmedA = boxscore(ids(100, 9), ids(200, 9));
  const confirmedB = boxscore(ids(300, 9), ids(400, 9));
  const partialBody = boxscore(ids(100, 9), ids(200, 3));
  const hashA = hashLineupPayload(emptyBody);
  const hashConfirmed = hashLineupPayload(confirmedA);
  const hashConfirmedB = hashLineupPayload(confirmedB);

  const clsEmpty = classifyBoxscoreBody(emptyBody);
  assert.equal(clsEmpty.collectionStatus, "NOT_RELEASED");
  const clsPartial = classifyBoxscoreBody(partialBody);
  assert.equal(clsPartial.collectionStatus, "PARTIAL");
  const clsFull = classifyBoxscoreBody(confirmedA);
  assert.equal(clsFull.confirmed, true);
  assert.equal(clsFull.playerIds.length, 18);

  const cwd = await tmpCwd("mlb-lineup-obs-");
  const PK = 770001;
  writeSchedule(cwd, [{ gamePk: PK, commence: CUTOFF }]);
  const fetchQueue: LineupRefreshFetchResult[] = [];
  const fetchFn: LineupRefreshFetchFn = async () => {
    const next = fetchQueue.shift();
    if (!next) throw new Error("unexpected fetch");
    return next;
  };

  // A. same payload at T1 and T2 → one payload blob, TWO observations, T1 unchanged, resolver selects T2
  fetchQueue.push(fetched(confirmedA, TS_EARLY));
  const r1 = await runMlbLineupRefresh({
    dateKst: DATE,
    cwd,
    nowMs: NOW_PRE,
    fetchBoxscore: fetchFn,
  });
  assert.equal(r1.manifest.engineAdmission, "PROHIBITED");
  assert.equal(payloadNames(cwd, PK).length, 1);
  assert.equal(observationNames(cwd, PK).length, 1);
  assert.ok(payloadNames(cwd, PK).includes(`${hashConfirmed}.json`));
  const obsIdT1 = observationIdFor({
    gamePk: PK,
    capturedAt: TS_EARLY,
    payloadHash: hashConfirmed,
    provider: "mlb-stats-api",
  });
  const obsT1Abs = path.join(
    mlbLineupObservationDir(DATE, PK, cwd),
    `${obsIdT1}.json`,
  );
  const payloadAbs = path.join(
    mlbLineupPayloadDir(DATE, PK, cwd),
    `${hashConfirmed}.json`,
  );
  const t1ObsRaw = readText(obsT1Abs);
  const t1PayloadRaw = readText(payloadAbs);
  assert.equal(r1.manifest.games[0]?.observationWritten, true);
  assert.equal(r1.manifest.games[0]?.identicalPayload, false);
  assert.equal(r1.manifest.summary.observationsWritten, 1);
  assert.equal(r1.manifest.summary.uniquePayloadCount, 1);

  fetchQueue.push(fetched(confirmedA, TS_MID));
  const r2 = await runMlbLineupRefresh({
    dateKst: DATE,
    cwd,
    nowMs: NOW_PRE,
    fetchBoxscore: fetchFn,
  });
  assert.equal(payloadNames(cwd, PK).length, 1);
  assert.equal(observationNames(cwd, PK).length, 2);
  assert.equal(readText(obsT1Abs), t1ObsRaw);
  assert.equal(readText(payloadAbs), t1PayloadRaw);
  assert.equal(r2.manifest.games[0]?.observationWritten, true);
  assert.equal(r2.manifest.games[0]?.identicalPayload, true);
  assert.equal(r2.manifest.games[0]?.exactDuplicateSkip, false);
  assert.equal(r2.manifest.summary.identicalPayloadObservations, 1);
  const obsIdT2 = observationIdFor({
    gamePk: PK,
    capturedAt: TS_MID,
    payloadHash: hashConfirmed,
    provider: "mlb-stats-api",
  });
  assert.notEqual(obsIdT1, obsIdT2);
  const selectedAfterT2 = selectAdmissiblePregameSnapshot(
    await listLineupObservations({ dateKst: DATE, gamePk: PK, cwd }),
  );
  assert.equal(selectedAfterT2.observationId, obsIdT2);
  assert.equal(selectedAfterT2.payloadHash, hashConfirmed);
  assert.equal(r2.manifest.games[0]?.selected.observationId, obsIdT2);
  assert.equal(r2.manifest.games[0]?.batterCapture, "SKIPPED_SEALED");

  // B. exact same observation twice → idempotent skip, observation count unchanged
  fetchQueue.push(fetched(confirmedA, TS_MID));
  const rExact = await runMlbLineupRefresh({
    dateKst: DATE,
    cwd,
    nowMs: NOW_PRE,
    fetchBoxscore: fetchFn,
  });
  assert.equal(observationNames(cwd, PK).length, 2);
  assert.equal(payloadNames(cwd, PK).length, 1);
  assert.equal(rExact.manifest.games[0]?.exactDuplicateSkip, true);
  assert.equal(rExact.manifest.games[0]?.observationWritten, false);
  assert.equal(rExact.manifest.games[0]?.skipReason, "IDEMPOTENT_EXACT_DUPLICATE");
  assert.equal(rExact.manifest.summary.idempotentExactDuplicateSkips, 1);

  // C. different payload at T1/T2 → two payloads, two observations, T2 selected
  const cwdDiff = await tmpCwd("mlb-lineup-diff-");
  writeSchedule(cwdDiff, [{ gamePk: 770002, commence: CUTOFF }]);
  await runMlbLineupRefresh({
    dateKst: DATE,
    cwd: cwdDiff,
    nowMs: NOW_PRE,
    fetchBoxscore: async () => fetched(emptyBody, TS_EARLY),
  });
  const rDiff2 = await runMlbLineupRefresh({
    dateKst: DATE,
    cwd: cwdDiff,
    nowMs: NOW_PRE,
    fetchBoxscore: async () => fetched(confirmedB, TS_LATE_OK),
  });
  assert.equal(payloadNames(cwdDiff, 770002).length, 2);
  assert.equal(observationNames(cwdDiff, 770002).length, 2);
  assert.ok(payloadNames(cwdDiff, 770002).includes(`${hashA}.json`));
  assert.ok(payloadNames(cwdDiff, 770002).includes(`${hashConfirmedB}.json`));
  assert.equal(rDiff2.manifest.games[0]?.selected.payloadHash, hashConfirmedB);
  const listedDiff = await listLineupObservations({
    dateKst: DATE,
    gamePk: 770002,
    cwd: cwdDiff,
  });
  const once = selectAdmissiblePregameSnapshot(listedDiff);
  const twice = selectAdmissiblePregameSnapshot(listedDiff);
  assert.deepEqual(once, twice);
  assert.equal(latestAdmissiblePregameSnapshot(listedDiff)?.payloadHash, hashConfirmedB);
  assert.match(LATEST_ADMISSIBLE_PREGAME_SNAPSHOT_RULE, /PRE_GAME observations only/);

  // D. started game → zero provider call, no new PRE_GAME observation
  const countObsBeforePost = observationNames(cwd, PK).length;
  const rPost = await runMlbLineupRefresh({
    dateKst: DATE,
    cwd,
    nowMs: NOW_POST,
    fetchBoxscore: async () => {
      throw new Error("must not fetch after cutoff");
    },
  });
  assert.equal(rPost.providerCalls, 0);
  assert.equal(rPost.manifest.games[0]?.skipReason, "POST_CUTOFF_SKIPPED");
  assert.equal(observationNames(cwd, PK).length, countObsBeforePost);
  assert.equal(rPost.manifest.summary.postCutoffSkips, 1);

  // E. mixed slate
  const cwdPg = await tmpCwd("mlb-lineup-mix-");
  writeSchedule(cwdPg, [
    { gamePk: 990001, commence: EARLY_CUTOFF },
    { gamePk: 990002, commence: LATE_CUTOFF },
  ]);
  const fetchedPks: number[] = [];
  const rPg = await runMlbLineupRefresh({
    dateKst: DATE,
    cwd: cwdPg,
    nowMs: Date.parse("2026-08-22T12:00:00.000Z"),
    fetchBoxscore: async ({ gamePk }) => {
      fetchedPks.push(gamePk);
      return fetched(confirmedA, TS_MID);
    },
  });
  assert.deepEqual(fetchedPks, [990002]);
  assert.equal(
    rPg.manifest.games.find((g) => g.gamePk === 990001)?.skipReason,
    "POST_CUTOFF_SKIPPED",
  );
  assert.equal(
    rPg.manifest.games.find((g) => g.gamePk === 990002)?.refreshAttempted,
    true,
  );
  assert.equal(observationNames(cwdPg, 990001).length, 0);
  assert.equal(observationNames(cwdPg, 990002).length, 1);

  // F. sourceTimestamp temporal proof
  const cwdTs = await tmpCwd("mlb-lineup-src-");
  writeSchedule(cwdTs, [{ gamePk: 770010, commence: CUTOFF }]);
  const rSrc = await runMlbLineupRefresh({
    dateKst: DATE,
    cwd: cwdTs,
    nowMs: NOW_PRE,
    fetchBoxscore: async () => fetched(confirmedA, TS_MID, TS_EARLY),
  });
  assert.equal(rSrc.manifest.games[0]?.selected.collectionPhase, "PRE_GAME");
  assert.equal(rSrc.manifest.games[0]?.selected.temporalProof, "SOURCE_TIMESTAMP");

  const rLateSrc = await runMlbLineupRefresh({
    dateKst: DATE,
    cwd: await (async () => {
      const d = await tmpCwd("mlb-lineup-late-src-");
      writeSchedule(d, [{ gamePk: 770011, commence: CUTOFF }]);
      return d;
    })(),
    nowMs: NOW_PRE,
    fetchBoxscore: async () => fetched(confirmedA, TS_MID, TS_AFTER_CUTOFF),
  });
  assert.equal(
    rLateSrc.manifest.games[0]?.selected.collectionPhase,
    "POST_GAME_OR_LATE",
  );
  assert.equal(rLateSrc.manifest.games[0]?.selected.selected, false);

  // G. captureTimestamp fallback
  const cwdCap = await tmpCwd("mlb-lineup-cap-");
  writeSchedule(cwdCap, [{ gamePk: 770019, commence: CUTOFF }]);
  const rCap = await runMlbLineupRefresh({
    dateKst: DATE,
    cwd: cwdCap,
    nowMs: NOW_PRE,
    fetchBoxscore: async () => fetched(confirmedA, TS_MID, null),
  });
  assert.equal(rCap.manifest.games[0]?.selected.collectionPhase, "PRE_GAME");
  assert.equal(rCap.manifest.games[0]?.selected.temporalProof, "CAPTURE_TIMESTAMP");
  assert.equal(rCap.manifest.games[0]?.selected.confirmed, true);

  // H. POST_GAME_OR_LATE and UNKNOWN never selected as PRE_GAME
  const cwdUnk = await tmpCwd("mlb-lineup-unk-");
  writeSchedule(cwdUnk, [{ gamePk: 770012, commence: CUTOFF }]);
  const rUnk = await runMlbLineupRefresh({
    dateKst: DATE,
    cwd: cwdUnk,
    nowMs: NOW_PRE,
    fetchBoxscore: async () => ({
      ok: false,
      status: 500,
      body: confirmedA,
      fetchedAt: TS_MID,
      sourceTimestamp: null,
    }),
  });
  assert.equal(rUnk.manifest.games[0]?.selected.selected, false);
  assert.equal(rUnk.manifest.games[0]?.selected.collectionPhase, "UNKNOWN");
  assert.equal(
    resolveRefreshTemporalProvenance({
      sourceTimestamp: null,
      capturedAt: TS_MID,
      cutoffTime: CUTOFF,
      admissibleProviderResponse: false,
    }).collectionPhase,
    "UNKNOWN",
  );
  assert.equal(rLateSrc.manifest.games[0]?.selected.blocker, "POST_CUTOFF");

  const cwdPart = await tmpCwd("mlb-lineup-part-");
  writeSchedule(cwdPart, [{ gamePk: 770013, commence: CUTOFF }]);
  const rPart = await runMlbLineupRefresh({
    dateKst: DATE,
    cwd: cwdPart,
    nowMs: NOW_PRE,
    fetchBoxscore: async () => fetched(partialBody, TS_MID),
  });
  assert.equal(rPart.manifest.games[0]?.selected.collectionStatus, "PARTIAL");
  assert.equal(rPart.manifest.games[0]?.batterCapture, "NOT_ELIGIBLE");
  assert.equal(existsSync(mlbBatterPregameGameAbs(DATE, 770013, cwdPart)), false);

  // I. dry-run: zero provider calls, zero writes
  const cwdDry = await tmpCwd("mlb-lineup-dry-");
  writeSchedule(cwdDry, [{ gamePk: 770030, commence: CUTOFF }]);
  const jsonBeforeDry = countJsonUnder(path.join(cwdDry, "data"));
  const rDry = await runMlbLineupRefresh({
    dateKst: DATE,
    cwd: cwdDry,
    nowMs: NOW_PRE,
    dryRun: true,
    fetchBoxscore: async () => {
      throw new Error("dry-run must not call provider");
    },
  });
  assert.equal(rDry.writtenManifest, false);
  assert.equal(rDry.providerCalls, 0);
  assert.equal(rDry.manifest.dryRun, true);
  assert.equal(countJsonUnder(path.join(cwdDry, "data")), jsonBeforeDry);

  // J. --no-provider / --cache-only resolve existing observations without calls
  const cwdNp = await tmpCwd("mlb-lineup-np-");
  writeSchedule(cwdNp, [{ gamePk: 770031, commence: CUTOFF }]);
  await runMlbLineupRefresh({
    dateKst: DATE,
    cwd: cwdNp,
    nowMs: NOW_PRE,
    fetchBoxscore: async () => fetched(confirmedA, TS_MID),
  });
  const obsBeforeNp = observationNames(cwdNp, 770031).length;
  const rNp = await runMlbLineupRefresh({
    dateKst: DATE,
    cwd: cwdNp,
    nowMs: NOW_PRE,
    noProvider: true,
    fetchBoxscore: async () => {
      throw new Error("no-provider must not call");
    },
  });
  assert.equal(rNp.providerCalls, 0);
  assert.equal(rNp.manifest.noProvider, true);
  assert.equal(rNp.manifest.games[0]?.skipReason, "NO_PROVIDER");
  assert.equal(rNp.manifest.summary.providerDisabledSkips, 1);
  assert.equal(observationNames(cwdNp, 770031).length, obsBeforeNp);
  assert.equal(rNp.manifest.games[0]?.selected.confirmed, true);

  const rCache = await runMlbLineupRefresh({
    dateKst: DATE,
    cwd: cwdNp,
    nowMs: NOW_PRE,
    cacheOnly: true,
    fetchBoxscore: async () => {
      throw new Error("cache-only must not call");
    },
  });
  assert.equal(rCache.providerCalls, 0);
  assert.equal(rCache.manifest.games[0]?.skipReason, "CACHE_ONLY");

  // Batter capture first-win + 18 slots
  const captureAbs = mlbBatterPregameGameAbs(DATE, PK, cwd);
  assert.equal(existsSync(captureAbs), true);
  const capture = JSON.parse(readText(captureAbs)) as {
    playerIds: number[];
    capturedBeforeGame: boolean;
    engineAdmission: string;
    predictionInputAllowed: boolean;
    lineupPayloadHash: string;
    statsThroughDate: string;
    home: { batters: unknown[] };
    away: { batters: unknown[] };
  };
  assert.equal(capture.playerIds.length, 18);
  assert.equal(capture.home.batters.length, 9);
  assert.equal(capture.away.batters.length, 9);
  assert.equal(capture.capturedBeforeGame, true);
  assert.equal(capture.engineAdmission, "PROHIBITED");
  assert.equal(capture.predictionInputAllowed, false);
  assert.equal(capture.lineupPayloadHash, hashConfirmed);
  assert.equal(
    capture.statsThroughDate,
    statsThroughDateForGame({ dateKst: DATE, officialDate: DATE }),
  );

  const hashes = await listLineupPayloadHashes({ dateKst: DATE, gamePk: PK, cwd });
  assert.deepEqual(hashes, [hashConfirmed]);

  // Isolation: writes stayed in temp dirs
  for (const dir of tmpDirs) {
    assert.equal(path.normalize(dir).startsWith(path.normalize(ROOT)), false);
  }

  // K. Prediction isolation
  const predIndex = src("src/lib/mlb/prediction-v0/load-and-predict.ts");
  const predConsumer = src("src/lib/mlb/load-mlb-prediction-consumer-input.ts");
  assert.equal(predIndex.includes("lineup-refresh-v1"), false);
  assert.equal(predIndex.includes("batter-pregame"), false);
  assert.equal(predConsumer.includes("lineup-refresh-v1"), false);
  assert.equal(predIndex.includes("batter-dataset-v0"), false);
  assert.equal(MLB_PREDICTION_V0_WEIGHTS.lineup.value, 0);
  assert.equal(MLB_PREDICTION_V0_WEIGHTS.starter.value, 0.55);

  const implSrc = [
    src("src/lib/mlb/lineup-refresh-v1/refresh.ts"),
    src("src/lib/mlb/lineup-refresh-v1/store.ts"),
    src("src/lib/mlb/lineup-refresh-v1/select.ts"),
    src("src/lib/mlb/lineup-refresh-v1/capture.ts"),
  ].join("\n");
  assert.equal(/build-mlb-official-results|postgame-ops|forceRefresh/.test(implSrc), false);
  assert.match(src("scripts/run-mlb-lineup-refresh-v1.ts"), /IMMUTABLE_APPEND_ONLY snapshots/);
  assert.match(src("src/lib/mlb/build-lineup-dataset.ts"), /pickBestPregameRawSnapshot/);
  assert.match(
    src("src/lib/mlb/expected-lineup-observation-v0/save-observation.ts"),
    /Rejects CONFIRMED promotion/,
  );

  const leak = filterHittingGameLogAsOf({
    splits: [
      { date: DATE, game: { gamePk: PK } },
      { date: "2026-08-21", game: { gamePk: 1 } },
    ] as never,
    targetGamePk: PK,
    statsThroughDate: "2026-08-21",
  });
  assert.equal(leak.excludedTarget, 1);
  assert.equal(BATTER_FETCH_GATE_POLICY, "FULL_SLATE_BEFORE_FIRST_PITCH_ONLY");

  const summary = formatMlbLineupRefreshSummary(r2.manifest);
  assert.match(summary, /Prediction executed: NO/);
  assert.match(summary, /Identical-payload observations/);
  assert.match(summary, /Engine admission: PROHIBITED/);

  // L. sealed 2026-08-21 and 2026-08-22 operational artifacts unchanged
  assert.equal(sha256File(FROZEN_BATTER), batterBefore);
  assert.equal(sha256File(FROZEN_PRED), predBefore);
  assert.equal(sha256File(FROZEN_0822_CLOSE), close22Before);
  assert.equal(sha256File(FROZEN_0822_STAGE_C), stageC22Before);

  for (const dir of tmpDirs) {
    rmSync(dir, { recursive: true, force: true });
  }

  process.stdout.write("test:mlb-lineup-refresh-v1 PASS\n");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

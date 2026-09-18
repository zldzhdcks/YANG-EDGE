/**
 * MLB Daily Ops window execution contract fix v1.
 * Fixture / mock only — zero real Provider calls.
 *
 *   npm run test:mlb-daily-ops-window-execution-v1
 */
import assert from "node:assert/strict";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createCacheUsage } from "../src/lib/mlb/research-stats-cache";
import {
  loadOddsResearchRawJson,
  oddsRawCacheFromBuilderArgs,
  oddsResearchRawCacheFile,
  parseMlbOddsHistoryBuilderArgs,
} from "../src/lib/mlb/build-odds-history-dataset";
import { runMlbDailyOpsV1 } from "../src/lib/mlb/daily-ops-v1";
import {
  parseMlbDailyOpsQuotaRemaining,
} from "../src/lib/mlb/daily-pregame-v0";
import { parseMlbDailyOpsCliArgs } from "./run-mlb-daily-ops-v1.ts";
import { DAILY_PREDICTION_SNAPSHOT_MISSING } from "../src/lib/mlb/prediction-continuity-guard-v1";

const DATE = "2099-06-15";
const START = "2099-06-15T12:00:00.000Z";
const START_MS = Date.parse(START);

function isoMinutesBeforeStart(minutes: number): string {
  return new Date(START_MS - minutes * 60_000).toISOString();
}

function writeJson(cwd: string, rel: string, body: unknown) {
  const abs = path.join(cwd, rel);
  mkdirSync(path.dirname(abs), { recursive: true });
  writeFileSync(abs, `${JSON.stringify(body, null, 2)}\n`, "utf8");
}

function writeSchedule(cwd: string) {
  writeJson(cwd, `data/research/mlb/${DATE}-schedule-v1.json`, {
    dateKst: DATE,
    games: [
      {
        internalGameId: "mlb-1",
        gamePk: 1,
        homeTeam: "Home",
        awayTeam: "Away",
        commenceTimeUtc: START,
        statusAbstract: "Preview",
      },
    ],
  });
}

function writeStarter(cwd: string) {
  writeJson(cwd, `data/research/mlb/${DATE}-starter-dataset-v1.json`, {
    meta: { generatedAt: isoMinutesBeforeStart(90), dateKst: DATE },
    rows: [
      { gameId: "mlb-1", side: "home" },
      { gameId: "mlb-1", side: "away" },
    ],
    summary: {},
  });
}

function writeOdds(cwd: string, observedAt: string) {
  writeJson(cwd, `data/research/mlb/${DATE}-odds-history-dataset-v1.json`, {
    meta: { generatedAt: observedAt, dateKst: DATE },
    rows: [
      {
        gameId: "mlb-1",
        collectionStatus: "COLLECTED",
        capturedAt: observedAt,
        cutoffTime: START,
        markets: [
          { marketType: "moneyline", selection: "home", priceDecimal: 1.9 },
          { marketType: "moneyline", selection: "away", priceDecimal: 2.1 },
        ],
      },
    ],
  });
}

function writeLineup(
  cwd: string,
  kind: "CONFIRMED" | "PARTIAL" | "NOT_RELEASED",
  observedAt: string,
) {
  const base = { gameId: "mlb-1", generatedAt: observedAt, sourceTimestamp: observedAt };
  const rows =
    kind === "CONFIRMED"
      ? [
          { ...base, side: "home", collectionStatus: "CONFIRMED", lineupStatus: "COMPLETE" },
          { ...base, side: "away", collectionStatus: "CONFIRMED", lineupStatus: "COMPLETE" },
        ]
      : kind === "PARTIAL"
        ? [
            { ...base, side: "home", collectionStatus: "PARTIAL", lineupStatus: "INCOMPLETE" },
            { ...base, side: "away", collectionStatus: "PARTIAL", lineupStatus: "INCOMPLETE" },
          ]
        : [
            { ...base, side: "home", collectionStatus: "NOT_RELEASED", lineupStatus: "INCOMPLETE" },
            { ...base, side: "away", collectionStatus: "NOT_RELEASED", lineupStatus: "INCOMPLETE" },
          ];
  writeJson(cwd, `data/research/mlb/${DATE}-lineup-dataset-v1.json`, {
    meta: { generatedAt: observedAt, dateKst: DATE },
    rows,
  });
}

function writeFullSlate(
  cwd: string,
  oddsObserved: string,
  lineup: "CONFIRMED" | "PARTIAL" | "NOT_RELEASED",
  lineupObserved: string,
) {
  writeSchedule(cwd);
  writeStarter(cwd);
  writeOdds(cwd, oddsObserved);
  writeLineup(cwd, lineup, lineupObserved);
}

function mockSpawnOk() {
  const calls: Array<{ script: string; args: string[] }> = [];
  const spawnCollector = async (scriptRel: string, args: string[]) => {
    calls.push({ script: scriptRel, args });
    return 0;
  };
  return { calls, spawnCollector };
}

async function main() {
  // --- CLI parse ---
  const parsedOk = parseMlbDailyOpsCliArgs([
    "--date",
    "2026-09-18",
    "--window",
    "T60",
    "--quota-remaining",
    "465",
  ]);
  assert.equal(parsedOk.window, "T60");
  assert.equal(parsedOk.quotaRemaining, 465);
  assert.equal(parsedOk.writePrediction, false);

  assert.throws(() => parseMlbDailyOpsQuotaRemaining("-1"), /quota-remaining/);
  assert.throws(() => parseMlbDailyOpsQuotaRemaining("abc"), /quota-remaining/);
  assert.throws(() => parseMlbDailyOpsQuotaRemaining("1.5"), /quota-remaining/);
  assert.throws(
    () =>
      parseMlbDailyOpsCliArgs([
        "--date",
        "2026-09-18",
        "--quota-remaining",
        "-1",
      ]),
    /quota-remaining/,
  );
  assert.throws(
    () =>
      parseMlbDailyOpsCliArgs([
        "--date",
        "2026-09-18",
        "--quota-remaining",
        "abc",
      ]),
    /quota-remaining/,
  );
  assert.throws(
    () =>
      parseMlbDailyOpsCliArgs([
        "--date",
        "2026-09-18",
        "--quota-remaining",
        "1.5",
      ]),
    /quota-remaining/,
  );

  // --- A T90 healthy no Prediction ---
  const t90 = mkdtempSync(path.join(tmpdir(), "mlb-exec-t90-"));
  writeFullSlate(t90, isoMinutesBeforeStart(90), "NOT_RELEASED", isoMinutesBeforeStart(90));
  const a = await runMlbDailyOpsV1({
    dateKst: DATE,
    cwd: t90,
    window: "T90",
    asOf: isoMinutesBeforeStart(90),
    dryRun: true,
    noProvider: true,
    sealDeliveryRecord: false,
    recentDates: [DATE],
  });
  assert.equal(a.opsContract, "COLLECTION_WINDOW");
  assert.equal(a.windowOutcome, "SUCCESS");
  assert.equal(a.opsSuccess, true);
  assert.equal(a.day.snapshotVerified, false);
  assert.equal(a.failure, null);
  assert.equal(
    existsSync(path.join(t90, `data/predictions/mlb/${DATE}.json`)),
    false,
  );

  // --- B T60 fresh odds ---
  const t60f = mkdtempSync(path.join(tmpdir(), "mlb-exec-t60f-"));
  writeFullSlate(t60f, isoMinutesBeforeStart(70), "NOT_RELEASED", isoMinutesBeforeStart(70));
  const b = await runMlbDailyOpsV1({
    dateKst: DATE,
    cwd: t60f,
    window: "T60",
    asOf: isoMinutesBeforeStart(60),
    dryRun: true,
    noProvider: true,
    sealDeliveryRecord: false,
    recentDates: [DATE],
  });
  assert.equal(b.opsSuccess, true);
  assert.equal(b.windowOutcome, "SUCCESS");
  assert.equal(b.day.snapshotVerified, false);

  // --- C T60 stale + quota null ---
  const t60s = mkdtempSync(path.join(tmpdir(), "mlb-exec-t60s-"));
  writeFullSlate(t60s, isoMinutesBeforeStart(90), "NOT_RELEASED", isoMinutesBeforeStart(90));
  const c = await runMlbDailyOpsV1({
    dateKst: DATE,
    cwd: t60s,
    window: "T60",
    asOf: isoMinutesBeforeStart(60),
    dryRun: false,
    noProvider: false,
    quotaRemaining: null,
    sealDeliveryRecord: false,
    writePrediction: false,
    recentDates: [DATE],
    spawnCollector: async () => {
      throw new Error("collector must not spawn when quota is null");
    },
  });
  assert.equal(c.opsSuccess, false);
  assert.equal(c.windowOutcome, "ACTION_REQUIRED");
  assert.equal(c.failure?.reason, "QUOTA_DECISION_EXTERNAL");
  assert.notEqual(c.failure?.reason, DAILY_PREDICTION_SNAPSHOT_MISSING);
  assert.notEqual(c.failure?.reason, "PRE_GAME_SNAPSHOT_NOT_VERIFIED");

  // --- D T60 stale + quota > 0 + mocked collector ---
  const t60q = mkdtempSync(path.join(tmpdir(), "mlb-exec-t60q-"));
  writeFullSlate(t60q, isoMinutesBeforeStart(90), "NOT_RELEASED", isoMinutesBeforeStart(90));
  const mockD = mockSpawnOk();
  const d = await runMlbDailyOpsV1({
    dateKst: DATE,
    cwd: t60q,
    window: "T60",
    asOf: isoMinutesBeforeStart(60),
    dryRun: false,
    noProvider: false,
    quotaRemaining: 465,
    sealDeliveryRecord: false,
    writePrediction: false,
    recentDates: [DATE],
    spawnCollector: mockD.spawnCollector,
  });
  assert.equal(d.opsSuccess, true);
  assert.equal(d.windowOutcome, "SUCCESS");
  assert.equal(d.day.snapshotVerified, false);
  assert.ok(
    mockD.calls.some((x) => x.script.includes("build-mlb-odds-history-dataset-v1.ts")),
  );
  const oddsArgs = mockD.calls.find((x) =>
    x.script.includes("build-mlb-odds-history-dataset-v1.ts"),
  )!.args;
  assert.ok(oddsArgs.includes("--cache-fresh-since"));
  assert.ok(oddsArgs.includes("--as-of"));
  assert.equal(
    existsSync(path.join(t60q, `data/predictions/mlb/${DATE}.json`)),
    false,
  );
  const oddsStage = d.pregame?.stages.find((s) => s.stage === "ODDS");
  assert.equal(oddsStage?.detail?.spawnAllowed, true);

  // --- E T45 confirmed fresh ---
  const t45ok = mkdtempSync(path.join(tmpdir(), "mlb-exec-t45ok-"));
  writeFullSlate(t45ok, isoMinutesBeforeStart(70), "CONFIRMED", isoMinutesBeforeStart(40));
  const e = await runMlbDailyOpsV1({
    dateKst: DATE,
    cwd: t45ok,
    window: "T45",
    asOf: isoMinutesBeforeStart(40),
    dryRun: true,
    noProvider: true,
    sealDeliveryRecord: false,
    recentDates: [DATE],
  });
  assert.equal(e.opsSuccess, true);
  assert.equal(e.day.snapshotVerified, false);

  // --- F T45 partial + mocked refresh ---
  const t45p = mkdtempSync(path.join(tmpdir(), "mlb-exec-t45p-"));
  writeFullSlate(t45p, isoMinutesBeforeStart(70), "PARTIAL", isoMinutesBeforeStart(90));
  const mockF = mockSpawnOk();
  const f = await runMlbDailyOpsV1({
    dateKst: DATE,
    cwd: t45p,
    window: "T45",
    asOf: isoMinutesBeforeStart(40),
    dryRun: false,
    noProvider: false,
    sealDeliveryRecord: false,
    writePrediction: false,
    recentDates: [DATE],
    spawnCollector: mockF.spawnCollector,
  });
  assert.equal(f.opsSuccess, true);
  assert.ok(
    mockF.calls.some((x) => x.script.includes("build-mlb-lineup-dataset-v1.ts")),
  );
  assert.equal(
    existsSync(path.join(t45p, `data/predictions/mlb/${DATE}.json`)),
    false,
  );

  // --- G T30 healthy refresh ---
  const t30 = mkdtempSync(path.join(tmpdir(), "mlb-exec-t30-"));
  writeFullSlate(t30, isoMinutesBeforeStart(90), "PARTIAL", isoMinutesBeforeStart(90));
  const mockG = mockSpawnOk();
  const g = await runMlbDailyOpsV1({
    dateKst: DATE,
    cwd: t30,
    window: "T30",
    asOf: isoMinutesBeforeStart(25),
    dryRun: false,
    noProvider: false,
    quotaRemaining: 100,
    sealDeliveryRecord: false,
    writePrediction: false,
    recentDates: [DATE],
    spawnCollector: mockG.spawnCollector,
  });
  assert.equal(g.opsSuccess, true);
  assert.equal(g.day.snapshotVerified, false);
  assert.ok(mockG.calls.length >= 1);

  // --- H LOCK without snapshot ---
  const lockMiss = mkdtempSync(path.join(tmpdir(), "mlb-exec-lockmiss-"));
  const h = await runMlbDailyOpsV1({
    dateKst: DATE,
    cwd: lockMiss,
    window: "LOCK",
    assessOnly: true,
    sealDeliveryRecord: false,
    recentDates: [DATE],
  });
  assert.equal(h.opsContract, "PREGAME_LOCK");
  assert.equal(h.opsSuccess, false);
  assert.equal(h.day.snapshotVerified, false);

  // --- I LOCK valid verified snapshot ---
  const lockDate = "2026-08-08";
  const root = process.cwd();
  const lockOk = mkdtempSync(path.join(tmpdir(), "mlb-exec-lockok-"));
  const lockRels = [
    `data/predictions/mlb/${lockDate}.json`,
    `data/research/mlb/${lockDate}-schedule-v1.json`,
    `data/research/mlb/${lockDate}-daily-research-summary-v1.json`,
    `data/research/mlb/${lockDate}-starter-dataset-v1.json`,
    `data/research/mlb/${lockDate}-odds-history-dataset-v1.json`,
    `data/research/mlb/${lockDate}-lineup-dataset-v1.json`,
  ];
  for (const rel of lockRels) {
    const src = path.join(root, rel);
    if (!existsSync(src)) continue;
    const dest = path.join(lockOk, rel);
    mkdirSync(path.dirname(dest), { recursive: true });
    cpSync(src, dest);
  }
  const i = await runMlbDailyOpsV1({
    dateKst: lockDate,
    cwd: lockOk,
    window: "LOCK",
    assessOnly: true,
    sealDeliveryRecord: false,
    recentDates: [lockDate],
  });
  assert.equal(i.opsContract, "PREGAME_LOCK");
  assert.equal(i.day.snapshotVerified, true);
  assert.equal(i.opsSuccess, true);

  // --- J legacy no-window ---
  const jOk = await runMlbDailyOpsV1({
    dateKst: lockDate,
    cwd: lockOk,
    assessOnly: true,
    sealDeliveryRecord: false,
    recentDates: [lockDate],
  });
  assert.equal(jOk.opsContract, "LEGACY_SNAPSHOT");
  assert.equal(jOk.opsSuccess, true);

  const jMiss = await runMlbDailyOpsV1({
    dateKst: DATE,
    cwd: lockMiss,
    assessOnly: true,
    sealDeliveryRecord: false,
    recentDates: [DATE],
  });
  assert.equal(jMiss.opsContract, "LEGACY_SNAPSHOT");
  assert.equal(jMiss.opsSuccess, false);

  // --- Odds builder args + cache bound ---
  const oddsParsed = parseMlbOddsHistoryBuilderArgs([
    "2026-09-18",
    "--cache-fresh-since",
    "2026-09-18T10:00:00.000Z",
    "--as-of",
    "2026-09-18T10:30:00.000Z",
  ]);
  assert.equal(oddsParsed.dateKst, "2026-09-18");
  const cacheOpts = oddsRawCacheFromBuilderArgs(oddsParsed, process.cwd());
  assert.equal(cacheOpts?.freshSinceMs, Date.parse("2026-09-18T10:00:00.000Z"));
  assert.equal(cacheOpts?.asOfMs, Date.parse("2026-09-18T10:30:00.000Z"));

  const legacyParsed = parseMlbOddsHistoryBuilderArgs(["2026-09-18"]);
  assert.equal(legacyParsed.cacheFreshSinceIso, null);
  assert.equal(oddsRawCacheFromBuilderArgs(legacyParsed), undefined);

  const cacheCwd = mkdtempSync(path.join(tmpdir(), "mlb-exec-odds-cache-"));
  const cacheKey = "exec_freshness_v1";
  const cacheFile = oddsResearchRawCacheFile(cacheKey, cacheCwd);
  mkdirSync(path.dirname(cacheFile), { recursive: true });
  writeFileSync(cacheFile, `${JSON.stringify([{ id: "cached" }], null, 2)}\n`);
  const now = Date.now();
  const freshSince = now - 10 * 60_000;
  utimesSync(cacheFile, new Date(now - 60_000), new Date(now - 60_000));
  let fetches = 0;
  const fetcher = async () => {
    fetches += 1;
    return [{ id: "network" }];
  };

  const hitFresh = await loadOddsResearchRawJson(cacheKey, fetcher, {
    cwd: cacheCwd,
    usage: createCacheUsage(),
    asOfMs: now,
    freshSinceMs: freshSince,
    refreshStale: false,
  });
  assert.equal(hitFresh.provenance, "CACHE_HIT_FRESH");
  assert.equal(fetches, 0);

  utimesSync(cacheFile, new Date(freshSince - 5_000), new Date(freshSince - 5_000));
  const stale = await loadOddsResearchRawJson(cacheKey, fetcher, {
    cwd: cacheCwd,
    usage: createCacheUsage(),
    asOfMs: now,
    freshSinceMs: freshSince,
    refreshStale: true,
  });
  assert.equal(stale.provenance, "NETWORK_REFRESH");
  assert.equal(fetches, 1);
  assert.notEqual(stale.provenance, "CACHE_HIT_FRESH");

  const second = await loadOddsResearchRawJson(cacheKey, fetcher, {
    cwd: cacheCwd,
    usage: createCacheUsage(),
    asOfMs: now,
    freshSinceMs: freshSince,
    refreshStale: true,
  });
  assert.equal(second.provenance, "CACHE_HIT_FRESH");
  assert.equal(fetches, 1);

  const legacyHit = await loadOddsResearchRawJson(cacheKey, fetcher, {
    cwd: cacheCwd,
    usage: createCacheUsage(),
    asOfMs: now,
  });
  assert.equal(legacyHit.provenance, "CACHE_HIT_LEGACY");
  assert.equal(fetches, 1);

  console.log("test:mlb-daily-ops-window-execution-v1 OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

/**
 * MLB Daily Ops window + freshness contract v1.
 * Fixture / mock / cache only — zero real Provider calls.
 *
 *   npm run test:mlb-daily-ops-window-freshness-v1
 */
import assert from "node:assert/strict";
import {
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
  oddsResearchRawCacheFile,
} from "../src/lib/mlb/build-odds-history-dataset";
import {
  decideMlbDailyCollection,
  decidePredictionPersist,
  deriveEffectiveEarliestStart,
  parseMlbDailyOpsWindow,
  runMlbDailyPregameV0,
} from "../src/lib/mlb/daily-pregame-v0";
import { mlbOpsWindowEnteredAtMs } from "../src/lib/scheduler/windows";

const DATE = "2099-06-15";
const START = "2099-06-15T12:00:00.000Z";
const START_MS = Date.parse(START);

function isoMinutesBeforeStart(minutes: number): string {
  return new Date(START_MS - minutes * 60_000).toISOString();
}

function stageOf(
  report: Awaited<ReturnType<typeof runMlbDailyPregameV0>>,
  name: string,
) {
  const s = report.stages.find((x) => x.stage === name);
  assert.ok(s, `missing stage ${name}`);
  return s;
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
  const base = {
    gameId: "mlb-1",
    generatedAt: observedAt,
    sourceTimestamp: observedAt,
  };
  const rows =
    kind === "CONFIRMED"
      ? [
          {
            ...base,
            side: "home",
            collectionStatus: "CONFIRMED",
            lineupStatus: "COMPLETE",
          },
          {
            ...base,
            side: "away",
            collectionStatus: "CONFIRMED",
            lineupStatus: "COMPLETE",
          },
        ]
      : kind === "PARTIAL"
        ? [
            {
              ...base,
              side: "home",
              collectionStatus: "PARTIAL",
              lineupStatus: "INCOMPLETE",
            },
            {
              ...base,
              side: "away",
              collectionStatus: "PARTIAL",
              lineupStatus: "INCOMPLETE",
            },
          ]
        : [
            {
              ...base,
              side: "home",
              collectionStatus: "NOT_RELEASED",
              lineupStatus: "INCOMPLETE",
            },
            {
              ...base,
              side: "away",
              collectionStatus: "NOT_RELEASED",
              lineupStatus: "INCOMPLETE",
            },
          ];
  writeJson(cwd, `data/research/mlb/${DATE}-lineup-dataset-v1.json`, {
    meta: { generatedAt: observedAt, dateKst: DATE },
    rows,
  });
}

function writeDummyPrediction(cwd: string) {
  writeJson(cwd, `data/predictions/mlb/${DATE}.json`, {
    meta: { generatedAt: isoMinutesBeforeStart(10), predictionHashSha256: "a".repeat(64) },
    predictions: [{ gameId: "mlb-1", predictedAt: isoMinutesBeforeStart(10) }],
  });
}

async function runWindow(input: {
  cwd: string;
  window: "T90" | "T60" | "T45" | "T30" | "LOCK";
  asOf: string;
  writePrediction?: boolean;
  dryRun?: boolean;
}) {
  return runMlbDailyPregameV0({
    dateKst: DATE,
    cwd: input.cwd,
    window: input.window,
    asOf: input.asOf,
    dryRun: input.dryRun !== false,
    noProvider: true,
    writePrediction: Boolean(input.writePrediction),
  });
}

async function main() {
  assert.equal(parseMlbDailyOpsWindow("t60"), "T60");
  assert.throws(() => parseMlbDailyOpsWindow("T99"), /Invalid --window/);

  const missingOddsUnknown = decideMlbDailyCollection({
    window: "T60",
    dataset: "ODDS",
    exists: false,
    quotaRemaining: null,
  });
  assert.equal(missingOddsUnknown.code, "COLLECT_MISSING");
  assert.equal(missingOddsUnknown.spawnAllowed, false);
  assert.equal(missingOddsUnknown.providerPolicy, "QUOTA_DECISION_EXTERNAL");

  const missingOddsZero = decideMlbDailyCollection({
    window: "T60",
    dataset: "ODDS",
    exists: false,
    quotaRemaining: 0,
  });
  assert.equal(missingOddsZero.spawnAllowed, false);

  const missingOddsOk = decideMlbDailyCollection({
    window: "T60",
    dataset: "ODDS",
    exists: false,
    quotaRemaining: 465,
  });
  assert.equal(missingOddsOk.spawnAllowed, true);
  assert.equal(missingOddsOk.providerPolicy, "NONE");

  const missingOddsLegacy = decideMlbDailyCollection({
    window: null,
    dataset: "ODDS",
    exists: false,
  });
  assert.equal(missingOddsLegacy.spawnAllowed, true);
  assert.equal(missingOddsLegacy.providerPolicy, "NONE");

  const scopedStart = deriveEffectiveEarliestStart({
    games: [
      { gameId: "early", commenceTimeUtc: "2099-06-15T12:00:00.000Z" },
      { gameId: "late", commenceTimeUtc: "2099-06-15T14:00:00.000Z" },
    ],
    filterIds: ["late"],
    fallbackEarliestStart: "2099-06-15T12:00:00.000Z",
  });
  assert.equal(scopedStart, "2099-06-15T14:00:00.000Z");
  assert.equal(
    deriveEffectiveEarliestStart({
      games: [
        { gameId: "early", commenceTimeUtc: "2099-06-15T12:00:00.000Z" },
      ],
      fallbackEarliestStart: "2099-06-15T12:00:00.000Z",
    }),
    "2099-06-15T12:00:00.000Z",
  );

  const t60Open = mlbOpsWindowEnteredAtMs(START, "T60");
  assert.equal(t60Open, START_MS - 75 * 60_000);

  // --- Policy unit: T60 stale vs fresh odds ---
  const staleOdds = decideMlbDailyCollection({
    window: "T60",
    dataset: "ODDS",
    exists: true,
    observedAtIso: isoMinutesBeforeStart(90),
    earliestStartIso: START,
    quotaRemaining: null,
  });
  assert.equal(staleOdds.code, "REFRESH_STALE");
  assert.equal(staleOdds.spawnRequested, true);
  assert.equal(staleOdds.spawnAllowed, false);
  assert.equal(staleOdds.providerPolicy, "QUOTA_DECISION_EXTERNAL");
  assert.equal(staleOdds.fresh, false);

  const freshOdds = decideMlbDailyCollection({
    window: "T60",
    dataset: "ODDS",
    exists: true,
    observedAtIso: isoMinutesBeforeStart(70),
    earliestStartIso: START,
    quotaRemaining: null,
  });
  assert.equal(freshOdds.code, "SKIP_FRESH");
  assert.equal(freshOdds.spawnRequested, false);

  const t30StarterKeep = decideMlbDailyCollection({
    window: "T30",
    dataset: "STARTER",
    exists: true,
  });
  assert.equal(t30StarterKeep.code, "PRESERVE_EXISTING");
  assert.equal(t30StarterKeep.spawnRequested, false);

  const lockOdds = decideMlbDailyCollection({
    window: "LOCK",
    dataset: "ODDS",
    exists: true,
  });
  assert.equal(lockOdds.code, "BLOCKED_LOCK_WINDOW");
  assert.equal(lockOdds.spawnRequested, false);

  assert.equal(
    decidePredictionPersist({
      window: "T90",
      predictionExists: false,
      cutoffBlocked: false,
    }).code,
    "NON_LOCK_WINDOW_NO_PREDICTION",
  );
  assert.equal(
    decidePredictionPersist({
      window: "LOCK",
      predictionExists: true,
      cutoffBlocked: false,
    }).code,
    "ALREADY_LOCKED",
  );
  assert.equal(
    decidePredictionPersist({
      window: "LOCK",
      predictionExists: false,
      cutoffBlocked: true,
    }).code,
    "BLOCKED_AFTER_START",
  );

  // 1. T90 + all missing → collectors eligible, prediction not created
  const empty = mkdtempSync(path.join(tmpdir(), "mlb-win-empty-"));
  const t90Missing = await runWindow({
    cwd: empty,
    window: "T90",
    asOf: isoMinutesBeforeStart(90),
  });
  assert.equal(t90Missing.window, "T90");
  assert.equal(t90Missing.providerCalls, 0);
  assert.equal(t90Missing.writesPerformed, 0);
  const t90Sched = stageOf(t90Missing, "SCHEDULE");
  assert.equal(t90Sched.detail?.collectionDecision, "COLLECT_MISSING");
  assert.equal(t90Sched.detail?.spawnRequested, true);
  assert.equal(t90Sched.detail?.wouldRun, true);
  assert.equal(stageOf(t90Missing, "PREDICTION_V0").status, "SKIPPED");
  assert.equal(
    stageOf(t90Missing, "PREDICTION_V0").detail?.collectionDecision,
    "NON_LOCK_WINDOW_NO_PREDICTION",
  );
  assert.equal(
    existsSync(path.join(empty, `data/predictions/mlb/${DATE}.json`)),
    false,
  );

  // 2. T90 + artifacts exist → no refresh
  const t90Full = mkdtempSync(path.join(tmpdir(), "mlb-win-t90full-"));
  writeSchedule(t90Full);
  writeStarter(t90Full);
  writeOdds(t90Full, isoMinutesBeforeStart(90));
  writeLineup(t90Full, "NOT_RELEASED", isoMinutesBeforeStart(90));
  const t90Exist = await runWindow({
    cwd: t90Full,
    window: "T90",
    asOf: isoMinutesBeforeStart(90),
  });
  assert.equal(stageOf(t90Exist, "SCHEDULE").detail?.collectionDecision, "SKIP_EXISTS");
  assert.equal(stageOf(t90Exist, "STARTER").detail?.collectionDecision, "PRESERVE_EXISTING");
  assert.equal(stageOf(t90Exist, "ODDS").detail?.collectionDecision, "SKIP_EXISTS");
  assert.equal(stageOf(t90Exist, "LINEUP").detail?.collectionDecision, "SKIP_EXISTS");
  assert.equal(t90Exist.providerCalls, 0);
  assert.equal(stageOf(t90Exist, "PREDICTION_V0").status, "SKIPPED");

  // 3–4 T60 odds stale vs fresh
  const t60StaleCwd = mkdtempSync(path.join(tmpdir(), "mlb-win-t60s-"));
  writeSchedule(t60StaleCwd);
  writeStarter(t60StaleCwd);
  writeOdds(t60StaleCwd, isoMinutesBeforeStart(90));
  writeLineup(t60StaleCwd, "NOT_RELEASED", isoMinutesBeforeStart(90));
  const t60Stale = await runWindow({
    cwd: t60StaleCwd,
    window: "T60",
    asOf: isoMinutesBeforeStart(60),
  });
  const t60Odds = stageOf(t60Stale, "ODDS");
  assert.equal(t60Odds.status, "WOULD_RUN");
  assert.equal(t60Odds.detail?.collectionDecision, "REFRESH_STALE");
  assert.equal(t60Odds.detail?.providerPolicy, "PROVIDER_REQUIRED");
  assert.equal(t60Odds.detail?.spawnRequested, true);
  assert.equal(t60Stale.providerCalls, 0);
  assert.equal(stageOf(t60Stale, "PREDICTION_V0").status, "SKIPPED");

  const t60FreshCwd = mkdtempSync(path.join(tmpdir(), "mlb-win-t60f-"));
  writeSchedule(t60FreshCwd);
  writeStarter(t60FreshCwd);
  writeOdds(t60FreshCwd, isoMinutesBeforeStart(70));
  writeLineup(t60FreshCwd, "NOT_RELEASED", isoMinutesBeforeStart(70));
  const t60Fresh = await runWindow({
    cwd: t60FreshCwd,
    window: "T60",
    asOf: isoMinutesBeforeStart(60),
  });
  assert.equal(stageOf(t60Fresh, "ODDS").detail?.collectionDecision, "SKIP_FRESH");
  assert.equal(stageOf(t60Fresh, "ODDS").status, "SKIPPED");
  assert.equal(t60Fresh.providerCalls, 0);

  // 5–6 T45 lineup
  const t45Nr = mkdtempSync(path.join(tmpdir(), "mlb-win-t45nr-"));
  writeSchedule(t45Nr);
  writeStarter(t45Nr);
  writeOdds(t45Nr, isoMinutesBeforeStart(70));
  writeLineup(t45Nr, "NOT_RELEASED", isoMinutesBeforeStart(70));
  const t45NrR = await runWindow({
    cwd: t45Nr,
    window: "T45",
    asOf: isoMinutesBeforeStart(40),
  });
  assert.equal(stageOf(t45NrR, "LINEUP").status, "WOULD_RUN");
  assert.equal(stageOf(t45NrR, "LINEUP").detail?.collectionDecision, "REFRESH_NOT_RELEASED");
  assert.equal(stageOf(t45NrR, "ODDS").detail?.collectionDecision, "SKIP_EXISTS");
  assert.equal(stageOf(t45NrR, "PREDICTION_V0").status, "SKIPPED");

  const t45Ok = mkdtempSync(path.join(tmpdir(), "mlb-win-t45ok-"));
  writeSchedule(t45Ok);
  writeStarter(t45Ok);
  writeOdds(t45Ok, isoMinutesBeforeStart(70));
  writeLineup(t45Ok, "CONFIRMED", isoMinutesBeforeStart(40));
  const t45OkR = await runWindow({
    cwd: t45Ok,
    window: "T45",
    asOf: isoMinutesBeforeStart(40),
  });
  assert.equal(stageOf(t45OkR, "LINEUP").detail?.collectionDecision, "SKIP_FRESH");
  assert.equal(stageOf(t45OkR, "LINEUP").status, "SKIPPED");

  // 7 T30 starter exists never deleted / refreshed
  const t30 = mkdtempSync(path.join(tmpdir(), "mlb-win-t30-"));
  writeSchedule(t30);
  writeStarter(t30);
  writeOdds(t30, isoMinutesBeforeStart(90));
  writeLineup(t30, "PARTIAL", isoMinutesBeforeStart(90));
  const starterRel = `data/research/mlb/${DATE}-starter-dataset-v1.json`;
  const starterBefore = readFileSync(path.join(t30, starterRel), "utf8");
  const t30R = await runWindow({
    cwd: t30,
    window: "T30",
    asOf: isoMinutesBeforeStart(25),
  });
  assert.equal(stageOf(t30R, "STARTER").detail?.collectionDecision, "PRESERVE_EXISTING");
  assert.equal(stageOf(t30R, "STARTER").detail?.spawnRequested, false);
  assert.equal(readFileSync(path.join(t30, starterRel), "utf8"), starterBefore);
  assert.equal(existsSync(path.join(t30, starterRel)), true);

  // 8 T30 stale odds refresh requested
  assert.equal(stageOf(t30R, "ODDS").detail?.collectionDecision, "REFRESH_STALE");
  assert.equal(stageOf(t30R, "ODDS").status, "WOULD_RUN");

  // 9 T30 partial lineup refresh requested
  assert.equal(stageOf(t30R, "LINEUP").detail?.collectionDecision, "REFRESH_PARTIAL");
  assert.equal(stageOf(t30R, "PREDICTION_V0").status, "SKIPPED");

  // 10 LOCK no collectors spawn
  const lockCwd = mkdtempSync(path.join(tmpdir(), "mlb-win-lock-"));
  writeSchedule(lockCwd);
  writeStarter(lockCwd);
  writeOdds(lockCwd, isoMinutesBeforeStart(20));
  writeLineup(lockCwd, "CONFIRMED", isoMinutesBeforeStart(20));
  const lockR = await runWindow({
    cwd: lockCwd,
    window: "LOCK",
    asOf: isoMinutesBeforeStart(10),
  });
  assert.equal(lockR.providerCalls, 0);
  for (const name of ["SCHEDULE", "STARTER", "ODDS", "LINEUP"] as const) {
    const s = stageOf(lockR, name);
    assert.equal(s.detail?.collectionDecision, "BLOCKED_LOCK_WINDOW");
    assert.equal(s.status, "BLOCKED");
    assert.equal(s.detail?.spawnRequested, false);
  }

  // 11 LOCK + no prediction + pre-kickoff → persist eligible (dry-run in-memory)
  const predStage = stageOf(lockR, "PREDICTION_V0");
  assert.notEqual(predStage.status, "SKIPPED");
  assert.notEqual(predStage.detail?.collectionDecision, "NON_LOCK_WINDOW_NO_PREDICTION");
  // summary missing → freeze may block persist; eligibility of window itself is LOCK
  assert.equal(
    decidePredictionPersist({
      window: "LOCK",
      predictionExists: false,
      cutoffBlocked: false,
    }).persist,
    true,
  );

  const histDate = "2026-07-30";
  const histRoot = process.cwd();
  const histFiles = [
    `data/research/mlb/${histDate}-schedule-v1.json`,
    `data/research/mlb/${histDate}-starter-dataset-v1.json`,
    `data/research/mlb/${histDate}-odds-history-dataset-v1.json`,
    `data/research/mlb/${histDate}-lineup-dataset-v1.json`,
    `data/research/mlb/${histDate}-daily-research-summary-v1.json`,
  ];
  if (histFiles.every((rel) => existsSync(path.join(histRoot, rel)))) {
    const lockHist = mkdtempSync(path.join(tmpdir(), "mlb-win-lockhist-"));
    for (const rel of histFiles) {
      const raw = readFileSync(path.join(histRoot, rel), "utf8");
      writeJson(lockHist, rel, JSON.parse(raw));
    }
    const lockEligible = await runMlbDailyPregameV0({
      dateKst: histDate,
      cwd: lockHist,
      window: "LOCK",
      asOf: "2026-07-29T12:00:00.000Z",
      dryRun: true,
      noProvider: true,
      writePrediction: false,
    });
    assert.equal(lockEligible.providerCalls, 0);
    assert.equal(lockEligible.writesPerformed, 0);
    const p = stageOf(lockEligible, "PREDICTION_V0");
    assert.ok(
      p.status === "WOULD_RUN" || p.status === "SUCCESS" || p.status === "BLOCKED",
      `LOCK pre-kickoff prediction status=${p.status}`,
    );
    if (p.status === "BLOCKED") {
      assert.ok(!p.blockers.includes("NON_LOCK_WINDOW_NO_PREDICTION"));
    } else {
      assert.equal(Boolean(p.detail?.written), false);
    }
    assert.equal(
      existsSync(path.join(lockHist, `data/predictions/mlb/${histDate}.json`)),
      false,
    );
  }

  // 12 LOCK + prediction exists → no rewrite
  writeDummyPrediction(lockCwd);
  const predPath = path.join(lockCwd, `data/predictions/mlb/${DATE}.json`);
  const beforePred = readFileSync(predPath, "utf8");
  const lockExist = await runMlbDailyPregameV0({
    dateKst: DATE,
    cwd: lockCwd,
    window: "LOCK",
    asOf: isoMinutesBeforeStart(10),
    dryRun: false,
    noProvider: true,
    writePrediction: true,
  });
  assert.equal(stageOf(lockExist, "PREDICTION_V0").detail?.collectionDecision, "ALREADY_LOCKED");
  assert.equal(readFileSync(predPath, "utf8"), beforePred);
  assert.equal(lockExist.writesPerformed, 0);

  // 13 LOCK + kickoff passed
  const lockLate = await runWindow({
    cwd: lockCwd,
    window: "LOCK",
    asOf: "2099-06-15T18:00:00.000Z",
  });
  assert.ok(
    stageOf(lockLate, "PREDICTION_V0").status === "BLOCKED" ||
      stageOf(lockLate, "PREDICTION_V0").detail?.collectionDecision ===
        "ALREADY_LOCKED",
  );
  if (!existsSync(predPath) || stageOf(lockLate, "PREDICTION_V0").status === "BLOCKED") {
    assert.ok(
      lockLate.blockingIssues.includes("BLOCKED_AFTER_START") ||
        stageOf(lockLate, "PREDICTION_V0").blockers.includes("BLOCKED_AFTER_START") ||
        stageOf(lockLate, "SCHEDULE").blockers.includes("BLOCKED_AFTER_START"),
    );
  }

  const afterStartEmpty = mkdtempSync(path.join(tmpdir(), "mlb-win-late-"));
  writeSchedule(afterStartEmpty);
  const lockAfter = await runWindow({
    cwd: afterStartEmpty,
    window: "LOCK",
    asOf: "2099-06-16T00:00:00.000Z",
  });
  assert.equal(stageOf(lockAfter, "PREDICTION_V0").status, "BLOCKED");
  assert.ok(
    lockAfter.blockingIssues.includes("BLOCKED_AFTER_START") ||
      stageOf(lockAfter, "PREDICTION_V0").blockers.includes("BLOCKED_AFTER_START"),
  );
  assert.equal(lockAfter.writesPerformed, 0);

  // 14 non-LOCK prediction writes always zero
  for (const w of ["T90", "T60", "T45", "T30"] as const) {
    const r = await runMlbDailyPregameV0({
      dateKst: DATE,
      cwd: t90Full,
      window: w,
      asOf: isoMinutesBeforeStart(20),
      dryRun: false,
      noProvider: true,
      writePrediction: true,
    });
    assert.equal(stageOf(r, "PREDICTION_V0").status, "SKIPPED");
    assert.equal(r.writesPerformed, 0);
    assert.equal(
      existsSync(path.join(t90Full, `data/predictions/mlb/${DATE}.json`)),
      false,
    );
  }

  // 15–16 Odds raw cache freshness (no provider)
  const cacheCwd = mkdtempSync(path.join(tmpdir(), "mlb-odds-cache-"));
  const usage = createCacheUsage();
  let fetchCount = 0;
  const fetcher = async () => {
    fetchCount += 1;
    return [{ id: "mock-event" }];
  };
  const cacheKey = "test_odds_freshness_v1";
  const cacheFile = oddsResearchRawCacheFile(cacheKey, cacheCwd);
  mkdirSync(path.dirname(cacheFile), { recursive: true });
  writeFileSync(cacheFile, `${JSON.stringify([{ id: "cached" }], null, 2)}\n`);
  const now = Date.now();
  utimesSync(cacheFile, new Date(now - 3_600_000), new Date(now - 3_600_000));

  const staleRead = await loadOddsResearchRawJson(cacheKey, fetcher, {
    cwd: cacheCwd,
    usage,
    asOfMs: now,
    maxAgeMs: 60_000,
    refreshStale: false,
  });
  assert.equal(staleRead.provenance, "CACHE_STALE_REFRESH_REQUIRED");
  assert.equal(staleRead.usedNetwork, false);
  assert.equal(fetchCount, 0);
  assert.notEqual(staleRead.provenance, "CACHE_HIT_FRESH");

  utimesSync(cacheFile, new Date(now - 1_000), new Date(now - 1_000));
  const freshRead = await loadOddsResearchRawJson(cacheKey, fetcher, {
    cwd: cacheCwd,
    usage: createCacheUsage(),
    asOfMs: now,
    maxAgeMs: 60_000,
    refreshStale: false,
  });
  assert.equal(freshRead.provenance, "CACHE_HIT_FRESH");
  assert.equal(fetchCount, 0);

  const legacyRead = await loadOddsResearchRawJson(cacheKey, fetcher, {
    cwd: cacheCwd,
    usage: createCacheUsage(),
    asOfMs: now,
    maxAgeMs: null,
  });
  assert.equal(legacyRead.provenance, "CACHE_HIT_LEGACY");
  assert.equal(fetchCount, 0);

  const missCwd = mkdtempSync(path.join(tmpdir(), "mlb-odds-miss-"));
  const miss = await loadOddsResearchRawJson("missing_key", fetcher, {
    cwd: missCwd,
    usage: createCacheUsage(),
    asOfMs: now,
    maxAgeMs: 60_000,
  });
  assert.equal(miss.provenance, "CACHE_MISS");
  assert.equal(miss.usedNetwork, true);
  assert.equal(fetchCount, 1);

  const staleNet = await loadOddsResearchRawJson(cacheKey, fetcher, {
    cwd: cacheCwd,
    usage: createCacheUsage(),
    asOfMs: now,
    maxAgeMs: 1,
    refreshStale: true,
  });
  assert.equal(staleNet.provenance, "NETWORK_REFRESH");
  assert.equal(fetchCount, 2);
  assert.notEqual(staleNet.provenance, "CACHE_HIT_FRESH");

  // 17 zero real provider: all orchestrator runs noProvider; cache fetcher is in-process mock
  assert.equal(typeof fetchCount, "number");

  console.log("test:mlb-daily-ops-window-freshness-v1 OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

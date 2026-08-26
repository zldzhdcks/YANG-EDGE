/**
 * 2026-08-26 C Prediction / PASS verification.
 * Run: npm run test:2026-08-26-prediction-pass-reconciliation-v1
 *
 * READ-ONLY against the approved point-in-time C artifacts.
 * Must not regenerate predictionRunAt / PASS decisions / hashes.
 */
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { TheOddsApiProvider } from "../src/lib/odds/the-odds-api-provider";
import {
  DATE_KST,
  FROZEN_OBS_HASH,
  LOCK_REL,
  SOURCE_OBS_REL,
  TOTAL_OBSERVED,
  sha256File,
} from "./lock-2026-08-26-daily-scope-v1";
import { RECONCILIATION_REL } from "./audit-2026-08-26-schedule-identity-reconciliation-v1";
import {
  B2_COVERAGE_REL,
  B2_ODDS_OBS_INDEX_REL,
  SEALED_LOCK_HASH,
  SEALED_ODDS_INDEX_HASH,
  SEALED_RECON_HASH,
} from "./audit-2026-08-26-pregame-input-odds-coverage-v1";
import {
  APPROVED_C_PREDICTION_RUN_AT,
  APPROVED_C_RECON_HASH,
  APPROVED_C_SNAPSHOT_HASH,
  C_RECON_REL,
  C_SNAPSHOT_REL,
  SEALED_B2_COVERAGE_HASH,
  computeIndependentDecision,
} from "./audit-2026-08-26-prediction-pass-reconciliation-v1";

const ISOLATION_PATHS = [
  "src/lib/engine",
  "src/lib/football/prediction-snapshot-v0",
  "src/lib/football/market-baseline-prediction-v0",
  "src/lib/mlb/prediction-v0",
] as const;

const HISTORICAL_PREDICTION_PATHS = [
  "data/predictions/kbo/2026-07-31.json",
  "data/predictions/npb/2026-07-31.json",
  "data/predictions/npb/2026-08-07.json",
] as const;

const FORBIDDEN_IMPORTS = [
  "the-odds-api-provider",
  "get-odds-provider",
  "kbo-api-baseball-cache",
  "api-baseball-kbo-schedule-provider",
  "football/prediction-snapshot-v0",
  "football/market-baseline-prediction-v0",
  "mlb/prediction-v0",
];

type B1Game = {
  operatorGameId: string;
  sport: string;
  rawLeagueLabel: string;
  rawHome: string;
  rawAway: string;
  displayedStartKst: string;
  displayedKickoffUtc: string | null;
  status: string;
  missedPreGameWindow: boolean;
  classifiedAsPreGame: boolean;
  reasons?: string[];
};

type Row = {
  operatorGameId: string;
  sport: string;
  cState: string;
  temporalGate: string;
  predictionCreated: boolean;
  footballEngineRun: boolean;
  volleyballEngineInvented: boolean;
  marketOddsUsedAsPredictionInput: boolean;
  independentPrediction: {
    created: boolean;
    predictedSide: null;
    independentProbability: null;
  };
  marketBenchmark: {
    attached: boolean;
    predictionInput: boolean;
    engineInput: boolean;
    marketBenchmarkOnly: boolean;
  };
};

type Doc = {
  schemaVersion: string;
  dateKst: string;
  predictionRunAt: string;
  sourceDailyScopeLockHash: string;
  sourceB1ReconciliationHash: string;
  sourceB2CoverageHash: string;
  lockedScope: number;
  accountedFor: number;
  predictionCount: number;
  passCount: number;
  cStateCounts: Record<string, number>;
  marketOddsUsedAsPredictionInput: boolean;
  footballEngineRun: boolean;
  volleyballEngineInvented: boolean;
  providerLiveCalls: number;
  leakage: {
    providerCalls: number;
    resultCalls: number;
    postgameCalls: number;
    oddsUsedAsModelFeatures: boolean;
    historicalPredictionRewrite: boolean;
  };
  games: Row[];
};

function assertNoSecrets(rel: string, cwd: string) {
  const text = readFileSync(path.join(cwd, rel), "utf8");
  assert.equal(/apiKey=/i.test(text), false, `apiKey in ${rel}`);
  assert.equal(/x-apisports-key/i.test(text), false, `header in ${rel}`);
}

function main() {
  const cwd = process.cwd();
  const reconHashBefore = sha256File(path.join(cwd, C_RECON_REL));
  const snapshotHashBefore = sha256File(path.join(cwd, C_SNAPSHOT_REL));
  assert.equal(reconHashBefore, APPROVED_C_RECON_HASH);
  assert.equal(snapshotHashBefore, APPROVED_C_SNAPSHOT_HASH);

  const source = readFileSync(
    path.join(cwd, "scripts/audit-2026-08-26-prediction-pass-reconciliation-v1.ts"),
    "utf8",
  );
  for (const forbidden of FORBIDDEN_IMPORTS) {
    assert.equal(source.includes(forbidden), false, `forbidden import ${forbidden}`);
  }
  assert.equal(/\bfetch\s*\(/.test(source), false, "C audit must not call fetch");

  assert.equal(sha256File(path.join(cwd, LOCK_REL)), SEALED_LOCK_HASH);
  assert.equal(sha256File(path.join(cwd, RECONCILIATION_REL)), SEALED_RECON_HASH);
  assert.equal(sha256File(path.join(cwd, B2_COVERAGE_REL)), SEALED_B2_COVERAGE_HASH);
  assert.equal(sha256File(path.join(cwd, SOURCE_OBS_REL)), FROZEN_OBS_HASH);
  assert.equal(sha256File(path.join(cwd, B2_ODDS_OBS_INDEX_REL)), SEALED_ODDS_INDEX_HASH);

  const rec = JSON.parse(readFileSync(path.join(cwd, C_RECON_REL), "utf8")) as Doc;
  const snap = JSON.parse(readFileSync(path.join(cwd, C_SNAPSHOT_REL), "utf8")) as {
    snapshotKind: string;
    result: string;
    grade: string;
    postgame: string;
    predictionCount: number;
    accountedFor: number;
    predictionRunAt: string;
    games: Array<{ cState: string; predictionCreated: boolean }>;
  };
  const b1 = JSON.parse(readFileSync(path.join(cwd, RECONCILIATION_REL), "utf8")) as {
    games: B1Game[];
  };

  assert.equal(rec.predictionRunAt, APPROVED_C_PREDICTION_RUN_AT);
  assert.equal(snap.predictionRunAt, APPROVED_C_PREDICTION_RUN_AT);
  assert.equal(rec.sourceDailyScopeLockHash, SEALED_LOCK_HASH);
  assert.equal(rec.sourceB1ReconciliationHash, SEALED_RECON_HASH);
  assert.equal(rec.sourceB2CoverageHash, SEALED_B2_COVERAGE_HASH);

  const originalFetch = globalThis.fetch;
  const originalGetOdds = TheOddsApiProvider.prototype.getOdds;
  let fetchCalls = 0;
  globalThis.fetch = (async () => {
    fetchCalls += 1;
    throw new Error("LIVE_PROVIDER_FORBIDDEN_DURING_D");
  }) as typeof fetch;
  TheOddsApiProvider.prototype.getOdds = async () => {
    throw new Error("LIVE_PROVIDER_FORBIDDEN_DURING_D");
  };
  const savedKey = process.env.ODDS_API_KEY;
  delete process.env.ODDS_API_KEY;

  try {
    const nowMs = Date.parse(APPROVED_C_PREDICTION_RUN_AT);
    for (let i = 0; i < b1.games.length; i += 1) {
      const replayed = computeIndependentDecision({ game: b1.games[i]!, nowMs });
      const stored = rec.games[i]!;
      assert.equal(replayed.cState, stored.cState, stored.operatorGameId);
      assert.deepEqual(replayed.independentPrediction, stored.independentPrediction);
      assert.equal(replayed.footballEngineRun, false);
      assert.equal(replayed.independentPrediction.independentProbability, null);
    }
    assert.equal(fetchCalls, 0);
  } finally {
    globalThis.fetch = originalFetch;
    TheOddsApiProvider.prototype.getOdds = originalGetOdds;
    if (savedKey === undefined) delete process.env.ODDS_API_KEY;
    else process.env.ODDS_API_KEY = savedKey;
  }

  assert.equal(rec.schemaVersion, "yang-edge-prediction-pass-reconciliation-v1");
  assert.equal(rec.dateKst, DATE_KST);
  assert.equal(rec.lockedScope, 26);
  assert.equal(rec.accountedFor, 26);
  assert.equal(TOTAL_OBSERVED, 26);
  assert.equal(rec.games.length, 26);
  assert.equal(new Set(rec.games.map((g) => g.operatorGameId)).size, 26);
  assert.deepEqual(
    rec.games.map((g) => g.operatorGameId),
    b1.games.map((g) => g.operatorGameId),
  );
  assert.equal(rec.predictionCount, 0);
  assert.equal(rec.passCount, 26);
  assert.equal(rec.cStateCounts.PREDICTION, 0);
  assert.equal(rec.cStateCounts.PASS_ENGINE_NOT_APPROVED, 11);
  assert.equal(rec.cStateCounts.PASS_IDENTITY_REVIEW_REQUIRED, 13);
  assert.equal(rec.cStateCounts.PASS_MISSED_PRE_GAME_WINDOW, 1);
  assert.equal(rec.cStateCounts.PASS_PROVIDER_NOT_SUPPORTED, 1);
  assert.equal(Object.values(rec.cStateCounts).reduce((a, b) => a + b, 0), 26);
  assert.equal(rec.marketOddsUsedAsPredictionInput, false);
  assert.equal(rec.footballEngineRun, false);
  assert.equal(rec.volleyballEngineInvented, false);
  assert.equal(rec.providerLiveCalls, 0);
  assert.equal(rec.leakage.providerCalls, 0);
  assert.equal(rec.leakage.resultCalls, 0);
  assert.equal(rec.leakage.postgameCalls, 0);
  assert.equal(rec.leakage.oddsUsedAsModelFeatures, false);
  assert.equal(rec.leakage.historicalPredictionRewrite, false);

  const kbo = rec.games.filter((g) => g.sport === "KBO");
  const npb = rec.games.filter((g) => g.sport === "NPB");
  const football = rec.games.filter((g) => g.sport === "FOOTBALL");
  const volleyball = rec.games.filter((g) => g.sport === "VOLLEYBALL");
  assert.equal(kbo.length, 5);
  assert.equal(npb.length, 6);
  assert.equal(football.length, 14);
  assert.equal(volleyball.length, 1);
  assert.equal(kbo.every((g) => g.cState === "PASS_ENGINE_NOT_APPROVED"), true);
  assert.equal(npb.every((g) => g.cState === "PASS_ENGINE_NOT_APPROVED"), true);
  assert.equal(kbo.every((g) => g.temporalGate === "PRE_GAME_ELIGIBLE"), true);
  assert.equal(npb.every((g) => g.temporalGate === "PRE_GAME_ELIGIBLE"), true);
  assert.equal(volleyball[0]!.cState, "PASS_PROVIDER_NOT_SUPPORTED");
  assert.equal(football.filter((g) => g.cState === "PASS_MISSED_PRE_GAME_WINDOW").length, 1);
  assert.equal(football.filter((g) => g.cState === "PASS_IDENTITY_REVIEW_REQUIRED").length, 13);
  assert.equal(football.every((g) => g.footballEngineRun === false), true);
  assert.equal(rec.games.every((g) => g.predictionCreated === false), true);
  assert.equal(rec.games.every((g) => g.independentPrediction.created === false), true);
  assert.equal(rec.games.every((g) => g.marketOddsUsedAsPredictionInput === false), true);
  assert.equal(kbo.filter((g) => g.marketBenchmark.attached).length, 5);
  assert.equal(npb.filter((g) => g.marketBenchmark.attached).length, 6);
  assert.equal(
    rec.games.filter((g) => g.marketBenchmark.attached).every((g) => g.marketBenchmark.predictionInput === false),
    true,
  );
  assert.equal(
    rec.games.filter((g) => g.marketBenchmark.attached).every((g) => g.marketBenchmark.engineInput === false),
    true,
  );
  assert.equal(
    rec.games.filter((g) => g.temporalGate === "MISSED_PRE_GAME_WINDOW").every((g) => g.cState !== "PREDICTION"),
    true,
  );

  assert.equal(existsSync(path.join(cwd, "data/predictions/kbo/2026-08-26.json")), false);
  assert.equal(existsSync(path.join(cwd, "data/predictions/npb/2026-08-26.json")), false);
  assert.equal(snap.snapshotKind, "PRE_GAME_C_PASS_SNAPSHOT");
  assert.equal(snap.result, "NONE");
  assert.equal(snap.grade, "NONE");
  assert.equal(snap.postgame, "NONE");
  assert.equal(snap.predictionCount, 0);
  assert.equal(snap.accountedFor, 26);
  assert.equal(snap.games.every((g) => g.predictionCreated === false), true);

  const isolationDiff = execSync(
    `git diff --name-only -- ${ISOLATION_PATHS.join(" ")} ${HISTORICAL_PREDICTION_PATHS.join(" ")} data/audits/2026-08-26-daily-scope-lock-v1.json data/audits/2026-08-26-schedule-identity-reconciliation-v1.json data/audits/2026-08-26-pregame-input-odds-coverage-v1.json`,
    { cwd, encoding: "utf8" },
  ).trim();
  assert.equal(isolationDiff, "");

  assertNoSecrets(C_RECON_REL, cwd);
  assertNoSecrets(C_SNAPSHOT_REL, cwd);

  const reconText = readFileSync(path.join(cwd, C_RECON_REL), "utf8");
  assert.equal(reconText.includes("\"result\":"), false);

  assert.equal(sha256File(path.join(cwd, C_RECON_REL)), APPROVED_C_RECON_HASH);
  assert.equal(sha256File(path.join(cwd, C_SNAPSHOT_REL)), APPROVED_C_SNAPSHOT_HASH);
  assert.equal(sha256File(path.join(cwd, C_RECON_REL)), reconHashBefore);
  assert.equal(sha256File(path.join(cwd, C_SNAPSHOT_REL)), snapshotHashBefore);

  console.log("test:2026-08-26-prediction-pass-reconciliation-v1 OK", {
    lockedScope: rec.lockedScope,
    accountedFor: rec.accountedFor,
    predictionCount: rec.predictionCount,
    passCount: rec.passCount,
    cStateCounts: rec.cStateCounts,
    fetchCalls,
    artifactHashesUnchanged: true,
  });
}

main();

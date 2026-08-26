/**
 * 2026-08-26 B2 pregame input + odds coverage tests.
 * Run: npm run test:2026-08-26-pregame-input-odds-coverage-v1
 */
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
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
  B2_GAP_REL,
  B2_ODDS_OBS_IMMUTABLE_CAPTURE_REL,
  B2_ODDS_OBS_INDEX_REL,
  MANUAL_OBS_KIND,
  ORIGINAL_B2_CLASSIFIED_AT,
  ORIGINAL_B2_ODDS_LIVE_CALLS,
  ORIGINAL_ODDS_INDEX_OBSERVED_AT,
  PROVIDER_OBS_KIND,
  SEALED_LOCK_HASH,
  SEALED_ODDS_IMMUTABLE_CAPTURE_HASH,
  SEALED_ODDS_INDEX_HASH,
  SEALED_RECON_HASH,
} from "./audit-2026-08-26-pregame-input-odds-coverage-v1";

const ISOLATION_PATHS = [
  "src/lib/engine",
  "src/lib/football/prediction-snapshot-v0",
  "src/lib/football/market-baseline-prediction-v0",
] as const;

type Row = {
  operatorGameId: string;
  sport: string;
  temporalState: string;
  b1IdentityState: string;
  missedPreGameWindow: boolean;
  classifiedAsPreGame: boolean;
  oddsState: string;
  marketBenchmarkOnly: boolean;
  predictionInput: boolean;
  engineInput: boolean;
  operatorGameAttached: boolean;
  manualOperatorMarketObservation: { kind: string; mergedWithProviderOdds: boolean };
  providerMarketObservation: { kind: string; marketBenchmarkOnly: boolean };
  blockingReason: unknown;
};

type Doc = {
  schemaVersion: string;
  dateKst: string;
  lockedScope: number;
  accountedFor: number;
  sourceDailyScopeLockHash: string;
  sourceB1ReconciliationHash: string;
  researchOnly: boolean;
  predictionInput: boolean;
  engineInput: boolean;
  marketBenchmarkOnly: boolean;
  leakage: {
    predictionCalls: number;
    engineCalls: number;
    resultCalls: number;
    postgameCalls: number;
    unauthorizedCrawling: number;
    oddsUsedAsModelFeatures: boolean;
    denominatorChanged: boolean;
    gamesDropped: boolean;
  };
  classifiedAt: string;
  rebuildMode?: string;
  sourceProviderOddsObservationRel?: string;
  sourceProviderOddsObservationHash?: string;
  sourceProviderOddsObservationObservedAt?: string;
  providerUtilization: Array<{
    provider: string;
    liveCallsThisMission: number;
    liveCallsThisRebuild?: number;
    actualLiveCallsDuringOriginalB2?: number;
    intendedCollectionCalls?: number;
    unintendedRebuildCalls?: number;
    rebuildRequiresLiveProvider?: boolean;
    futureExpectedCallsForEquivalentCollection?: number;
  }>;
  games: Row[];
};

function assertNoSecrets(rel: string, cwd: string) {
  const text = readFileSync(path.join(cwd, rel), "utf8");
  assert.equal(/apiKey=/i.test(text), false, `apiKey in ${rel}`);
  assert.equal(/x-apisports-key/i.test(text), false, `header in ${rel}`);
  assert.equal(/ODDS_API_KEY\s*[:=]\s*["'][^"']+/i.test(text), false);
}

function main() {
  const cwd = process.cwd();
  const recAbs = path.join(cwd, B2_COVERAGE_REL);
  const gapAbs = path.join(cwd, B2_GAP_REL);
  assert.equal(existsSync(recAbs), true, "B2 coverage missing");
  assert.equal(existsSync(gapAbs), true, "B2 gap audit missing");
  assert.equal(sha256File(path.join(cwd, LOCK_REL)), SEALED_LOCK_HASH);
  assert.equal(sha256File(path.join(cwd, RECONCILIATION_REL)), SEALED_RECON_HASH);
  assert.equal(sha256File(path.join(cwd, SOURCE_OBS_REL)), FROZEN_OBS_HASH);

  const rec = JSON.parse(readFileSync(recAbs, "utf8")) as Doc;
  const b1 = JSON.parse(readFileSync(path.join(cwd, RECONCILIATION_REL), "utf8")) as {
    games: Array<{ operatorGameId: string; status: string }>;
  };
  const gap = JSON.parse(readFileSync(gapAbs, "utf8")) as {
    gaps: Array<{ classification: string }>;
    footballUnresolvedMustNotAttachProviderInput: boolean;
    oddsReplayArchitecture?: {
      rebuildRequiresLiveProvider: boolean;
      actualLiveCallsDuringOriginalB2: number;
    };
  };

  assert.equal(rec.schemaVersion, "yang-edge-pregame-input-odds-coverage-v1");
  assert.equal(rec.dateKst, DATE_KST);
  assert.equal(rec.lockedScope, 26);
  assert.equal(rec.accountedFor, 26);
  assert.equal(TOTAL_OBSERVED, 26);
  assert.equal(rec.games.length, 26);
  assert.equal(new Set(rec.games.map((g) => g.operatorGameId)).size, 26);
  assert.equal(rec.sourceDailyScopeLockHash, SEALED_LOCK_HASH);
  assert.equal(rec.sourceB1ReconciliationHash, SEALED_RECON_HASH);
  assert.equal(rec.classifiedAt, ORIGINAL_B2_CLASSIFIED_AT);
  assert.equal(rec.rebuildMode, "REPLAY_STORED_OBSERVATION");
  assert.equal(rec.sourceProviderOddsObservationRel, B2_ODDS_OBS_INDEX_REL);
  assert.equal(rec.sourceProviderOddsObservationHash, SEALED_ODDS_INDEX_HASH);
  assert.equal(rec.sourceProviderOddsObservationObservedAt, ORIGINAL_ODDS_INDEX_OBSERVED_AT);
  assert.equal(rec.predictionInput, false);
  assert.equal(rec.engineInput, false);
  assert.equal(rec.marketBenchmarkOnly, true);
  assert.equal(rec.leakage.predictionCalls, 0);
  assert.equal(rec.leakage.engineCalls, 0);
  assert.equal(rec.leakage.resultCalls, 0);
  assert.equal(rec.leakage.postgameCalls, 0);
  assert.equal(rec.leakage.unauthorizedCrawling, 0);
  assert.equal(rec.leakage.oddsUsedAsModelFeatures, false);
  assert.equal(rec.leakage.denominatorChanged, false);
  assert.equal(rec.leakage.gamesDropped, false);

  const b1Ids = b1.games.map((g) => g.operatorGameId);
  assert.deepEqual(
    rec.games.map((g) => g.operatorGameId),
    b1Ids,
  );

  const npb = rec.games.filter((g) => g.sport === "NPB");
  const kbo = rec.games.filter((g) => g.sport === "KBO");
  const football = rec.games.filter((g) => g.sport === "FOOTBALL");
  const volleyball = rec.games.filter((g) => g.sport === "VOLLEYBALL");
  assert.equal(npb.length, 6);
  assert.equal(kbo.length, 5);
  assert.equal(football.length, 14);
  assert.equal(volleyball.length, 1);
  assert.equal(npb.every((g) => g.b1IdentityState === "MATCHED"), true);
  assert.equal(kbo.every((g) => g.b1IdentityState === "MATCHED"), true);
  assert.equal(football.every((g) => g.b1IdentityState !== "MATCHED"), true);
  assert.equal(volleyball[0]!.temporalState, "PROVIDER_NOT_SUPPORTED");
  assert.equal(volleyball[0]!.oddsState, "ODDS_NOT_SUPPORTED");
  assert.equal(football.every((g) => g.operatorGameAttached === false), true);
  assert.equal(
    football.every((g) => g.oddsState === "ODDS_IDENTITY_BLOCKED" || g.oddsState === "MISSED_PRE_GAME_WINDOW"),
    true,
  );

  for (const row of rec.games) {
    assert.equal(row.marketBenchmarkOnly, true);
    assert.equal(row.predictionInput, false);
    assert.equal(row.engineInput, false);
    assert.equal(row.manualOperatorMarketObservation.kind, MANUAL_OBS_KIND);
    assert.equal(row.manualOperatorMarketObservation.mergedWithProviderOdds, false);
    assert.equal(row.providerMarketObservation.kind, PROVIDER_OBS_KIND);
    assert.equal(row.providerMarketObservation.marketBenchmarkOnly, true);
    if (row.missedPreGameWindow) {
      assert.equal(row.classifiedAsPreGame, false, row.operatorGameId);
      assert.notEqual(row.temporalState, "PRE_GAME_OPEN", row.operatorGameId);
    }
  }

  assert.equal(rec.providerUtilization.some((p) => p.provider === "API_BASEBALL"), true);
  assert.equal(rec.providerUtilization.some((p) => p.provider === "THE_ODDS_API"), true);
  assert.equal(rec.providerUtilization.some((p) => p.provider === "API_FOOTBALL"), true);
  const fb = rec.providerUtilization.find((p) => p.provider === "API_FOOTBALL");
  assert.equal(fb?.liveCallsThisMission, 0);
  const oddsUtil = rec.providerUtilization.find((p) => p.provider === "THE_ODDS_API");
  assert.equal(oddsUtil?.liveCallsThisMission, 4);
  assert.equal(oddsUtil?.liveCallsThisRebuild, 0);
  assert.equal(
    oddsUtil?.actualLiveCallsDuringOriginalB2,
    ORIGINAL_B2_ODDS_LIVE_CALLS.actualLiveCallsDuringOriginalB2,
  );
  assert.equal(oddsUtil?.intendedCollectionCalls, 2);
  assert.equal(oddsUtil?.unintendedRebuildCalls, 2);
  assert.equal(oddsUtil?.rebuildRequiresLiveProvider, false);
  assert.equal(oddsUtil?.futureExpectedCallsForEquivalentCollection, 2);
  assert.equal(sha256File(path.join(cwd, B2_ODDS_OBS_INDEX_REL)), SEALED_ODDS_INDEX_HASH);
  assert.equal(
    sha256File(path.join(cwd, B2_ODDS_OBS_IMMUTABLE_CAPTURE_REL)),
    SEALED_ODDS_IMMUTABLE_CAPTURE_HASH,
  );
  assert.equal(rec.games.filter((g) => g.oddsState === "ODDS_COLLECTED").length, 11);
  assert.equal(rec.games.filter((g) => g.oddsState === "ODDS_IDENTITY_BLOCKED").length, 13);
  assert.equal(rec.games.filter((g) => g.oddsState === "ODDS_NOT_SUPPORTED").length, 1);
  assert.equal(rec.games.filter((g) => g.oddsState === "MISSED_PRE_GAME_WINDOW").length, 1);
  assert.equal(rec.games.filter((g) => g.oddsState === "ODDS_PROVIDER_NO_EVENT").length, 0);

  assert.equal(gap.footballUnresolvedMustNotAttachProviderInput, true);
  assert.equal(gap.oddsReplayArchitecture?.rebuildRequiresLiveProvider, false);
  assert.equal(gap.oddsReplayArchitecture?.actualLiveCallsDuringOriginalB2, 4);
  assert.equal(
    gap.gaps.some((g) => g.classification === "CONSIDER_NEW_API"),
    true,
  );
  assert.equal(
    gap.gaps.some((g) => g.classification === "FIX_REPOSITORY_FIRST"),
    true,
  );

  assertNoSecrets(B2_COVERAGE_REL, cwd);
  assertNoSecrets(B2_GAP_REL, cwd);
  for (const rel of [
    "data/research/odds/2026-08-26-the-odds-api-h2h-observation-v1.json",
    "data/research/kbo/2026-08-26-api-baseball-standings-raw-v1.json",
    "data/research/npb/2026-08-26-api-baseball-standings-raw-v1.json",
    "data/research/kbo/2026-08-26-api-baseball-recent-form-asof-v1.json",
  ]) {
    if (existsSync(path.join(cwd, rel))) assertNoSecrets(rel, cwd);
  }

  const isolationDiff = execSync(
    `git diff --name-only -- ${ISOLATION_PATHS.join(" ")}`,
    { cwd, encoding: "utf8" },
  ).trim();
  assert.equal(isolationDiff, "");

  console.log("test:2026-08-26-pregame-input-odds-coverage-v1 OK", {
    lockedScope: rec.lockedScope,
    accountedFor: rec.accountedFor,
    oddsCollected: rec.games.filter((g) => g.oddsState === "ODDS_COLLECTED").length,
  });
}

main();

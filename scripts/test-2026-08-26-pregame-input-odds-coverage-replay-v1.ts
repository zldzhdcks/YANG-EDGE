/**
 * 2026-08-26 B2.1 offline odds-observation replay.
 * Rebuilds coverage from stored The Odds API evidence with the live provider disabled.
 *
 * Run: npm run test:2026-08-26-pregame-input-odds-coverage-replay-v1
 *
 * PASS only if replay is fully offline: no API key, no network, no observation mutation.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { TheOddsApiProvider } from "../src/lib/odds/the-odds-api-provider";
import { sha256File } from "./lock-2026-08-26-daily-scope-v1";
import {
  B2_COVERAGE_REL,
  B2_GAP_REL,
  B2_ODDS_OBS_IMMUTABLE_CAPTURE_REL,
  B2_ODDS_OBS_INDEX_REL,
  ORIGINAL_B2_CLASSIFIED_AT,
  ORIGINAL_B2_ODDS_LIVE_CALLS,
  ORIGINAL_ODDS_INDEX_OBSERVED_AT,
  SEALED_ODDS_IMMUTABLE_CAPTURE_HASH,
  SEALED_ODDS_INDEX_HASH,
  collectLiveTheOddsApiObservation,
  runPregameInputOddsCoverage,
} from "./audit-2026-08-26-pregame-input-odds-coverage-v1";

const LIVE_FORBIDDEN = "LIVE_ODDS_FORBIDDEN_DURING_REPLAY";

type OddsUtil = {
  provider: string;
  liveCallsThisRebuild?: number;
  actualLiveCallsDuringOriginalB2?: number;
  intendedCollectionCalls?: number;
  unintendedRebuildCalls?: number;
  rebuildRequiresLiveProvider?: boolean;
  futureExpectedCallsForEquivalentCollection?: number;
};

type CoverageDoc = {
  classifiedAt: string;
  rebuildMode: string;
  lockedScope: number;
  accountedFor: number;
  sourceProviderOddsObservationRel: string;
  sourceProviderOddsObservationHash: string;
  sourceProviderOddsObservationObservedAt: string;
  marketBenchmarkOnly: boolean;
  predictionInput: boolean;
  engineInput: boolean;
  leakage: { liveOddsCallsDuringReplay: number };
  oddsCounts: Record<string, number>;
  providerUtilization: OddsUtil[];
  games: Array<{
    sport: string;
    oddsState: string;
    oddsBestHome: number | null;
    oddsBestAway: number | null;
    marketBenchmarkOnly: boolean;
    predictionInput: boolean;
    engineInput: boolean;
  }>;
};

function snapshotObservation(cwd: string, rel: string) {
  const abs = path.join(cwd, rel);
  const raw = readFileSync(abs, "utf8");
  const json = JSON.parse(raw) as {
    observedAt: string;
    kboEvents: Array<{ bestHomeOdds: number | null; bestAwayOdds: number | null; externalEventId: string }>;
    npbEvents: Array<{ bestHomeOdds: number | null; bestAwayOdds: number | null; externalEventId: string }>;
  };
  return {
    sha256: sha256File(abs),
    observedAt: json.observedAt,
    kboEvents: json.kboEvents,
    npbEvents: json.npbEvents,
  };
}

async function main() {
  const cwd = process.cwd();
  const beforeIndex = snapshotObservation(cwd, B2_ODDS_OBS_INDEX_REL);
  const beforeCapture = snapshotObservation(cwd, B2_ODDS_OBS_IMMUTABLE_CAPTURE_REL);
  assert.equal(beforeIndex.sha256, SEALED_ODDS_INDEX_HASH);
  assert.equal(beforeCapture.sha256, SEALED_ODDS_IMMUTABLE_CAPTURE_HASH);
  assert.equal(beforeIndex.observedAt, ORIGINAL_ODDS_INDEX_OBSERVED_AT);

  const originalFetch = globalThis.fetch;
  const originalGetOdds = TheOddsApiProvider.prototype.getOdds;
  const originalListSports = TheOddsApiProvider.prototype.listSports;
  const originalResolve = TheOddsApiProvider.prototype.resolveBaseballLeagueKeys;
  const savedKey = process.env.ODDS_API_KEY;
  const savedProvider = process.env.ODDS_PROVIDER;
  let fetchCalls = 0;

  globalThis.fetch = (async () => {
    fetchCalls += 1;
    throw new Error(LIVE_FORBIDDEN);
  }) as typeof fetch;
  TheOddsApiProvider.prototype.getOdds = async () => {
    throw new Error(LIVE_FORBIDDEN);
  };
  TheOddsApiProvider.prototype.listSports = async () => {
    throw new Error(LIVE_FORBIDDEN);
  };
  TheOddsApiProvider.prototype.resolveBaseballLeagueKeys = async () => {
    throw new Error(LIVE_FORBIDDEN);
  };
  delete process.env.ODDS_API_KEY;
  delete process.env.ODDS_PROVIDER;

  try {
    await assert.rejects(
      () => collectLiveTheOddsApiObservation(cwd),
      /ODDS_OBSERVATION_ALREADY_CAPTURED/,
    );

    const result = await runPregameInputOddsCoverage(cwd, { mode: "replay" });
    assert.equal(fetchCalls, 0, "replay must not call fetch");
    assert.equal(result.liveOddsCallsDuringReplay, 0);

    const rec = JSON.parse(readFileSync(path.join(cwd, B2_COVERAGE_REL), "utf8")) as CoverageDoc;
    const gap = JSON.parse(readFileSync(path.join(cwd, B2_GAP_REL), "utf8")) as {
      oddsReplayArchitecture: { rebuildRequiresLiveProvider: boolean };
    };

    assert.equal(rec.rebuildMode, "REPLAY_STORED_OBSERVATION");
    assert.equal(rec.classifiedAt, ORIGINAL_B2_CLASSIFIED_AT);
    assert.equal(rec.lockedScope, 26);
    assert.equal(rec.accountedFor, 26);
    assert.equal(rec.sourceProviderOddsObservationRel, B2_ODDS_OBS_INDEX_REL);
    assert.equal(rec.sourceProviderOddsObservationHash, SEALED_ODDS_INDEX_HASH);
    assert.equal(rec.sourceProviderOddsObservationObservedAt, ORIGINAL_ODDS_INDEX_OBSERVED_AT);
    assert.equal(rec.marketBenchmarkOnly, true);
    assert.equal(rec.predictionInput, false);
    assert.equal(rec.engineInput, false);
    assert.equal(rec.leakage.liveOddsCallsDuringReplay, 0);
    assert.equal(rec.oddsCounts.ODDS_COLLECTED, 11);
    assert.equal(rec.oddsCounts.ODDS_IDENTITY_BLOCKED, 13);
    assert.equal(rec.oddsCounts.ODDS_NOT_SUPPORTED, 1);
    assert.equal(rec.oddsCounts.MISSED_PRE_GAME_WINDOW, 1);
    assert.equal(rec.oddsCounts.ODDS_PROVIDER_NO_EVENT, 0);

    const kboJoined = rec.games.filter((g) => g.sport === "KBO" && g.oddsState === "ODDS_COLLECTED");
    const npbJoined = rec.games.filter((g) => g.sport === "NPB" && g.oddsState === "ODDS_COLLECTED");
    assert.equal(kboJoined.length, 5);
    assert.equal(npbJoined.length, 6);

    for (const row of rec.games) {
      assert.equal(row.marketBenchmarkOnly, true);
      assert.equal(row.predictionInput, false);
      assert.equal(row.engineInput, false);
    }

    const oddsUtil = rec.providerUtilization.find((p) => p.provider === "THE_ODDS_API");
    assert.equal(oddsUtil?.liveCallsThisRebuild, 0);
    assert.equal(
      oddsUtil?.actualLiveCallsDuringOriginalB2,
      ORIGINAL_B2_ODDS_LIVE_CALLS.actualLiveCallsDuringOriginalB2,
    );
    assert.equal(
      oddsUtil?.intendedCollectionCalls,
      ORIGINAL_B2_ODDS_LIVE_CALLS.intendedCollectionCalls,
    );
    assert.equal(
      oddsUtil?.unintendedRebuildCalls,
      ORIGINAL_B2_ODDS_LIVE_CALLS.unintendedRebuildCalls,
    );
    assert.equal(oddsUtil?.rebuildRequiresLiveProvider, false);
    assert.equal(
      oddsUtil?.futureExpectedCallsForEquivalentCollection,
      ORIGINAL_B2_ODDS_LIVE_CALLS.futureExpectedCallsForEquivalentCollection,
    );
    assert.equal(gap.oddsReplayArchitecture.rebuildRequiresLiveProvider, false);

    const afterIndex = snapshotObservation(cwd, B2_ODDS_OBS_INDEX_REL);
    const afterCapture = snapshotObservation(cwd, B2_ODDS_OBS_IMMUTABLE_CAPTURE_REL);
    assert.equal(afterIndex.sha256, beforeIndex.sha256);
    assert.equal(afterCapture.sha256, beforeCapture.sha256);
    assert.equal(afterIndex.observedAt, beforeIndex.observedAt);
    assert.equal(afterCapture.observedAt, beforeCapture.observedAt);
    assert.deepEqual(afterIndex.kboEvents, beforeIndex.kboEvents);
    assert.deepEqual(afterIndex.npbEvents, beforeIndex.npbEvents);
    assert.deepEqual(afterCapture.kboEvents, beforeCapture.kboEvents);
    assert.deepEqual(afterCapture.npbEvents, beforeCapture.npbEvents);

    const yakult = rec.games.find(
      (g) => g.sport === "NPB" && g.oddsState === "ODDS_COLLECTED" && g.oddsBestHome === 2.27,
    );
    assert.equal(Boolean(yakult), true, "stored Yakult/Giants odds must replay unchanged");
  } finally {
    globalThis.fetch = originalFetch;
    TheOddsApiProvider.prototype.getOdds = originalGetOdds;
    TheOddsApiProvider.prototype.listSports = originalListSports;
    TheOddsApiProvider.prototype.resolveBaseballLeagueKeys = originalResolve;
    if (savedKey === undefined) delete process.env.ODDS_API_KEY;
    else process.env.ODDS_API_KEY = savedKey;
    if (savedProvider === undefined) delete process.env.ODDS_PROVIDER;
    else process.env.ODDS_PROVIDER = savedProvider;
  }

  console.log("test:2026-08-26-pregame-input-odds-coverage-replay-v1 OK", {
    liveOddsCallsDuringReplay: 0,
    fetchCalls,
    oddsIndexHash: SEALED_ODDS_INDEX_HASH,
    joined: { kbo: 5, npb: 6 },
  });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});

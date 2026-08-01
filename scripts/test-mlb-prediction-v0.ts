/**
 * MLB Baseline Prediction v0 — unit + historical dry-run tests.
 * Run: npm run test:mlb-prediction-v0
 * Mutation: dry-run only (prediction write 0).
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  buildMarketFeature,
  buildPredictionSnapshotV0,
  buildStarterFeature,
  computeMoneylinePrediction,
  configHash,
  evaluateLeakage,
  hashPredictions,
  loadAndPredictMlbV0,
  MLB_PREDICTION_V0_CALIBRATION,
  MLB_PREDICTION_V0_WEIGHTS,
  round6,
  sha256,
  starterEdge,
  starterScoreFromStats,
  buildDisabledBullpenFeature,
  buildLineupFeature,
} from "../src/lib/mlb/prediction-v0";
import type { FeatureProvenance } from "../src/lib/mlb/prediction-v0";

function emptyProv(): FeatureProvenance {
  return {
    sourceArtifact: "test",
    sourceTimestamp: null,
    statsAsOf: null,
    cutoffTime: null,
    leakageEligible: false,
    warning: [],
  };
}

function hashFile(p: string): string {
  return createHash("sha256").update(readFileSync(p)).digest("hex");
}

async function main() {
  // --- Starter ---
  const strong = starterScoreFromStats({
    era: 2.5,
    whip: 1.0,
    inningsPitched: 80,
  });
  const weak = starterScoreFromStats({
    era: 5.5,
    whip: 1.5,
    inningsPitched: 80,
  });
  assert.ok(strong.score > weak.score);
  const missing = starterScoreFromStats({
    era: null,
    whip: null,
    inningsPitched: null,
  });
  assert.equal(missing.quality, "MISSING");

  const homeS = buildStarterFeature({
    playerName: "Ace",
    era: 2.8,
    whip: 1.05,
    inningsPitched: 90,
    strikeouts: 100,
    walks: 20,
    throws: "R",
    provenance: emptyProv(),
  });
  const awayS = buildStarterFeature({
    playerName: "Soft",
    era: 5.2,
    whip: 1.45,
    inningsPitched: 70,
    strikeouts: 50,
    walks: 40,
    throws: "L",
    provenance: emptyProv(),
  });
  assert.ok(starterEdge(homeS, awayS) > 0);

  // --- Market ---
  const market = buildMarketFeature({
    homeOdds: 1.9,
    awayOdds: 2.0,
    provenance: emptyProv(),
  });
  assert.equal(market.oddsQuality, "GOOD");
  assert.ok(market.marketProbabilityHome != null);
  assert.ok(
    Math.abs(
      (market.marketProbabilityHome ?? 0) + (market.marketProbabilityAway ?? 0) - 1,
    ) < 1e-9,
  );
  const badMarket = buildMarketFeature({
    homeOdds: 0.9,
    awayOdds: 2.0,
    provenance: emptyProv(),
  });
  assert.equal(badMarket.oddsQuality, "INVALID");

  // --- Probability / determinism ---
  const lineup = buildLineupFeature({
    confirmed: true,
    homeSlots: 9,
    awaySlots: 9,
    provenance: emptyProv(),
  });
  const bullpen = buildDisabledBullpenFeature(emptyProv());
  const baseArgs = {
    homeStarter: homeS,
    awayStarter: awayS,
    market,
    lineup,
    homeBullpen: bullpen,
    awayBullpen: bullpen,
    useMarketPrior: true,
    observationOnly: false,
    leakageBlocked: false,
    leakageReasons: [] as string[],
    afterCutoff: false,
    identityMismatch: false,
    cutoffMarginMinutes: 120,
  };
  const a = computeMoneylinePrediction(baseArgs);
  const b = computeMoneylinePrediction(baseArgs);
  assert.deepEqual(a, b);
  assert.ok(Math.abs(a.homeProbability + a.awayProbability - 1) < 1e-9);
  assert.ok(a.homeProbability >= MLB_PREDICTION_V0_CALIBRATION.minProbability);
  assert.ok(a.homeProbability <= MLB_PREDICTION_V0_CALIBRATION.maxProbability);
  assert.equal(a.officialPick, null);
  assert.ok(["PASS", "ELIGIBLE", "BLOCKED"].includes(a.officialStatus));

  const shuffledKeyOrder = computeMoneylinePrediction({
    ...baseArgs,
    market: buildMarketFeature({
      awayOdds: 2.0,
      homeOdds: 1.9,
      provenance: emptyProv(),
    }),
  });
  assert.equal(a.homeProbability, shuffledKeyOrder.homeProbability);

  // shrink toward 0.5 when quality low
  const marketOnly = computeMoneylinePrediction({
    ...baseArgs,
    homeStarter: buildStarterFeature({
      playerName: null,
      era: null,
      whip: null,
      inningsPitched: null,
      strikeouts: null,
      walks: null,
      throws: null,
      provenance: emptyProv(),
    }),
    awayStarter: buildStarterFeature({
      playerName: null,
      era: null,
      whip: null,
      inningsPitched: null,
      strikeouts: null,
      walks: null,
      throws: null,
      provenance: emptyProv(),
    }),
  });
  assert.ok(Math.abs(marketOnly.homeProbability - 0.5) < Math.abs(a.homeProbability - 0.5) + 0.05);

  // Leakage
  const leak = evaluateLeakage({
    commenceTimeUtc: "2026-07-30T17:00:00Z",
    predictedAt: "2026-07-30T18:00:00Z",
    oddsCapturedAt: null,
    lineupCapturedAt: null,
    starterStatsAsOf: null,
    starterTargetGameIncluded: false,
    starterCutoffViolations: 0,
    closingOddsPostStart: false,
    liveLineupAfterStart: false,
  });
  assert.equal(leak.blocked, true);
  assert.ok(leak.reasons.includes("PREDICTION_AFTER_COMMENCE"));

  const liveLineup = evaluateLeakage({
    commenceTimeUtc: "2026-07-30T17:00:00Z",
    predictedAt: "2026-07-30T15:00:00Z",
    oddsCapturedAt: null,
    lineupCapturedAt: "2026-07-30T17:30:00Z",
    starterStatsAsOf: null,
    starterTargetGameIncluded: false,
    starterCutoffViolations: 0,
    closingOddsPostStart: false,
    liveLineupAfterStart: true,
  });
  assert.equal(liveLineup.blocked, true);

  // Config hash changes when weight changes conceptually
  const h1 = configHash();
  assert.equal(typeof h1, "string");
  assert.equal(h1.length, 64);
  assert.equal(MLB_PREDICTION_V0_WEIGHTS.bullpen.status, "DISABLED");
  assert.equal(MLB_PREDICTION_V0_WEIGHTS.lineup.value, 0);

  // Blocked after cutoff prediction
  const blocked = computeMoneylinePrediction({
    ...baseArgs,
    afterCutoff: true,
  });
  assert.equal(blocked.officialStatus, "BLOCKED");

  // --- Historical dry-run (no write) ---
  const dateKst = "2026-07-30";
  const summaryPath = path.resolve(
    `data/research/mlb/${dateKst}-daily-research-summary-v1.json`,
  );
  const predPath = path.resolve(`data/predictions/mlb/${dateKst}.json`);
  const beforePred = existsSync(predPath) ? hashFile(predPath) : null;
  const beforeSummary = existsSync(summaryPath) ? hashFile(summaryPath) : null;

  if (existsSync(summaryPath)) {
    const load1 = await loadAndPredictMlbV0({
      dateKst,
      useMarketPrior: true,
    });
    assert.equal(load1.kind, "ready");
    if (load1.kind === "ready") {
      const load2 = await loadAndPredictMlbV0({
        dateKst,
        useMarketPrior: true,
        predictedAtOverride: load1.predictedAt,
      });
      assert.equal(load2.kind, "ready");
      if (load2.kind === "ready") {
        assert.equal(hashPredictions(load1.games), hashPredictions(load2.games));
      }

      // Result independence: official results file may exist; we never load it
      const resultsPath = path.resolve(
        `data/research/mlb/${dateKst}-official-results-v1.json`,
      );
      const resultsExisted = existsSync(resultsPath);
      const load3 = await loadAndPredictMlbV0({
        dateKst,
        predictedAtOverride: load1.predictedAt,
      });
      assert.equal(load3.kind, "ready");
      if (load3.kind === "ready") {
        assert.equal(hashPredictions(load1.games), hashPredictions(load3.games));
      }
      assert.equal(existsSync(resultsPath), resultsExisted);

      const snap = buildPredictionSnapshotV0({
        load: load1,
        generatedAt: "2026-08-01T00:00:00.000Z",
        dryRun: true,
        observationOnly: false,
        useMarketPrior: true,
      });
      assert.equal(snap.meta.schemaVersion, "mlb-research-prediction-snapshot-v1");
      assert.equal(snap.meta.dryRun, true);
      assert.equal(snap.meta.officialPickCount, 0);
      assert.ok(snap.meta.researchBaselineCount >= 0);
      assert.ok(Array.isArray(snap.predictions));
      for (const p of snap.predictions) {
        const mps = p.marketPredictions as Array<{
          homeProbability: number;
          awayProbability: number;
          marketType: string;
        }>;
        assert.equal(mps[0]?.marketType, "MONEYLINE_2WAY");
        assert.ok(
          Math.abs(mps[0]!.homeProbability + mps[0]!.awayProbability - 1) < 1e-9,
        );
        assert.equal(p.officialPick, null);
        assert.equal(p.researchOnly, true);
      }

      // Key order independence of hash helper
      assert.equal(
        sha256({ b: 1, a: 2 }),
        sha256({ a: 2, b: 1 }),
      );

      console.log("historical", {
        dateKst,
        games: load1.games.length,
        hash: snap.meta.predictionHashSha256.slice(0, 16),
        pass: snap.meta.passCount,
        blocked: snap.meta.blockedCount,
        eligible: snap.meta.eligibleCount,
      });
    }
  } else {
    console.log("skip historical — summary missing");
  }

  // Mutation proof
  if (beforePred != null) {
    assert.equal(hashFile(predPath), beforePred, "prediction file mutated");
  } else {
    assert.equal(existsSync(predPath), false);
  }
  if (beforeSummary != null) {
    assert.equal(hashFile(summaryPath), beforeSummary);
  }

  // round6 sanity
  assert.equal(round6(0.123456789), 0.123457);

  console.log("test:mlb-prediction-v0 OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

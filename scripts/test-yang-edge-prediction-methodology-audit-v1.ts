/**
 * YANG EDGE Prediction Methodology Audit v1 — read-only tests.
 * Does not mutate prediction snapshots, engine weights, or providers.
 * Run: npm run test:prediction-methodology-audit-v1
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  MLB_PREDICTION_V0_OFFICIAL,
  MLB_PREDICTION_V0_WEIGHTS,
} from "../src/lib/mlb/prediction-v0/config";
import {
  PREDICTION_METHODOLOGY_AUDIT_V1_SCHEMA,
  buildAuditDocument,
  classifyHistoricalPredictions,
  featureUtilizationMatrix,
} from "../src/lib/research/prediction-methodology-audit-v1";

const ROOT = process.cwd();
const AUDIT_REL = "data/audits/yang-edge-prediction-methodology-audit-v1.json";

async function main() {
  const historical = await classifyHistoricalPredictions(ROOT);
  assert.ok(historical.length > 0, "expected historical prediction artifacts");

  const independent = historical.filter(
    (r) => r.classification === "INDEPENDENT_STATISTICAL",
  );
  assert.equal(independent.length, 0, "independent statistical sample must be 0");

  const mlbV0 = historical.filter(
    (r) =>
      r.sport === "MLB" &&
      r.contract === "RESEARCH_BASELINE_V0" &&
      r.classification !== "BLOCKED",
  );
  assert.ok(mlbV0.length > 0, "expected at least one MLB v0 snapshot");
  for (const row of mlbV0) {
    assert.equal(row.classification, "MARKET_ASSISTED");
    assert.equal(row.marketInProbabilityFormula, true);
    assert.equal(row.lineupPlayerStatsUsed, false);
    assert.equal(row.bullpenDataUsed, false);
    assert.equal(row.starterAdvancedStatsUsed, false);
    assert.equal(row.officialPickCount, 0);
  }

  const mlbLegacy = historical.filter(
    (r) => r.sport === "MLB" && r.contract === "LEGACY_V1",
  );
  assert.ok(mlbLegacy.length > 0, "expected legacy MLB snapshots");
  for (const row of mlbLegacy) {
    assert.equal(row.marketInProbabilityFormula, false);
    assert.ok(
      row.classification === "LEGACY_HEURISTIC" ||
        row.classification === "BLOCKED",
    );
  }

  const fbSnap = historical.filter(
    (r) => r.contract === "FOOTBALL_PREDICTION_SNAPSHOT_V0",
  );
  const fbBase = historical.filter(
    (r) => r.contract === "FOOTBALL_MARKET_BASELINE_V0",
  );
  assert.ok(fbSnap.length >= 2, "expected football input snapshots");
  assert.ok(fbBase.length >= 2, "expected football market baselines");
  for (const row of fbSnap) {
    assert.equal(row.classification, "INSUFFICIENT_INPUT");
    assert.equal(row.marketInProbabilityFormula, false);
    assert.equal(row.playerLevelDataUsed, false);
  }
  for (const row of fbBase) {
    assert.equal(row.classification, "MARKET_BASELINE");
    assert.equal(row.marketInProbabilityFormula, true);
    assert.equal(row.playerLevelDataUsed, false);
    assert.equal(row.officialPickCount, 0);
  }

  assert.equal(MLB_PREDICTION_V0_WEIGHTS.marketPrior.value, 0.25);
  assert.equal(MLB_PREDICTION_V0_WEIGHTS.bullpen.value, 0);
  assert.equal(MLB_PREDICTION_V0_WEIGHTS.lineup.value, 0);
  assert.equal(MLB_PREDICTION_V0_OFFICIAL.enableOfficialPick, false);

  const features = featureUtilizationMatrix();
  const fip = features.mlb.find((r) => r.data.startsWith("FIP"));
  assert.ok(fip);
  assert.equal(fip.prediction, false);
  assert.equal(fip.stage, "NONE");
  const xi = features.football.find((r) => r.data.includes("confirmed XI"));
  assert.ok(xi);
  assert.equal(xi.prediction, false);
  const marketFb = features.football.find((r) => r.category.startsWith("J."));
  assert.ok(marketFb);
  assert.equal(marketFb.prediction, true);

  const auditPath = path.join(ROOT, AUDIT_REL);
  const frozen = JSON.parse(readFileSync(auditPath, "utf8")) as {
    schemaVersion: string;
    independentModelSample: number;
    independentStatisticalModelExists: boolean;
    mutation: Record<string, number>;
    historical: typeof historical;
    classificationCounts: Record<string, number>;
    scorecardRecommendation: { startIndependentSampleAtZero: boolean };
    gitBefore: { statusPorcelain: string[] };
  };
  assert.equal(frozen.schemaVersion, PREDICTION_METHODOLOGY_AUDIT_V1_SCHEMA);
  assert.equal(frozen.independentModelSample, 0);
  assert.equal(frozen.independentStatisticalModelExists, false);
  assert.equal(frozen.mutation.predictionSnapshotsModified, 0);
  assert.equal(frozen.mutation.engineWeightsModified, 0);
  assert.equal(frozen.mutation.predictionLogicModified, 0);
  assert.equal(frozen.mutation.providerCalls, 0);
  assert.equal(frozen.scorecardRecommendation.startIndependentSampleAtZero, true);
  assert.ok(
    !AUDIT_REL.includes("리포트"),
    "audit artifact must not live under 리포트/",
  );

  const recomputed = buildAuditDocument({
    generatedAt: "2026-08-20T12:00:00.000Z",
    gitBefore: frozen.gitBefore,
    historical,
  });
  assert.deepEqual(
    recomputed.historical.map((r) => ({
      sport: r.sport,
      date: r.date,
      artifactRel: r.artifactRel,
      classification: r.classification,
      marketInProbabilityFormula: r.marketInProbabilityFormula,
      officialPickCount: r.officialPickCount,
    })),
    frozen.historical.map((r) => ({
      sport: r.sport,
      date: r.date,
      artifactRel: r.artifactRel,
      classification: r.classification,
      marketInProbabilityFormula: r.marketInProbabilityFormula,
      officialPickCount: r.officialPickCount,
    })),
  );
  assert.deepEqual(recomputed.classificationCounts, frozen.classificationCounts);

  process.stdout.write("test:prediction-methodology-audit-v1 PASS\n");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

/**
 * Provider capability audit v1 tests.
 * No prediction/engine mutation. No paid provider calls.
 * Run: npm run test:provider-capability-audit-v1
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { MLB_PREDICTION_V0_WEIGHTS } from "../src/lib/mlb/prediction-v0/config";
import {
  PROVIDER_CAPABILITY_AUDIT_V1_SCHEMA,
  PROVIDER_GAP_MATRIX,
  buildProviderCapabilityAuditDocument,
  countAvailability,
} from "../src/lib/research/provider-capability-audit-v1";

const ROOT = process.cwd();
const AUDIT_REL = "data/audits/yang-edge-provider-capability-audit-v1.json";

function main() {
  assert.equal(MLB_PREDICTION_V0_WEIGHTS.marketPrior.value, 0.25);
  assert.equal(MLB_PREDICTION_V0_WEIGHTS.bullpen.value, 0);
  assert.equal(MLB_PREDICTION_V0_WEIGHTS.lineup.value, 0);

  const era = PROVIDER_GAP_MATRIX.find((r) => r.feature.startsWith("ERA / WHIP"));
  const wrc = PROVIDER_GAP_MATRIX.find((r) => r.feature.startsWith("wOBA / wRC"));
  const xg = PROVIDER_GAP_MATRIX.find((r) => r.feature.startsWith("xG / npxG"));
  const market = PROVIDER_GAP_MATRIX.find((r) => r.category === "MARKET");
  assert.equal(era?.availability, "STORED_ALREADY");
  assert.equal(era?.predictionUsed, true);
  assert.equal(wrc?.availability, "AVAILABLE_DIFFERENT_ENDPOINT");
  assert.equal(wrc?.predictionUsed, false);
  assert.equal(xg?.availability, "NOT_AVAILABLE");
  assert.equal(xg?.buildVsBuy, "BUY_PROVIDER");
  assert.equal(market?.intakePriority, "NONE");
  assert.equal(market?.predictionUsed, true);

  for (const row of PROVIDER_GAP_MATRIX) {
    if (row.intakePriority === "P0") {
      assert.equal(
        row.category === "MARKET",
        false,
        "P0 intake must not be market probability",
      );
    }
  }

  const buy = PROVIDER_GAP_MATRIX.filter((r) => r.buildVsBuy === "BUY_PROVIDER");
  const build = PROVIDER_GAP_MATRIX.filter(
    (r) =>
      r.buildVsBuy === "BUILD_FROM_EXISTING_RAW" ||
      r.buildVsBuy === "DERIVE_FROM_EXISTING_HISTORY",
  );
  assert.ok(buy.length >= 3, "audit must name data that actually requires another provider");
  assert.ok(build.length >= 10, "audit must name data we can build without a new purchase");

  const frozen = JSON.parse(
    readFileSync(path.join(ROOT, AUDIT_REL), "utf8"),
  ) as ReturnType<typeof buildProviderCapabilityAuditDocument>;

  assert.equal(frozen.schemaVersion, PROVIDER_CAPABILITY_AUDIT_V1_SCHEMA);
  assert.equal(frozen.independentModelSample, 0);
  assert.equal(frozen.marketInIndependentProbability, false);
  assert.equal(frozen.engineAdmission, "PROHIBITED");
  assert.equal(frozen.mutation.predictionSnapshotsModified, 0);
  assert.equal(frozen.mutation.engineWeightsModified, 0);
  assert.equal(frozen.mutation.predictionLogicModified, 0);
  assert.equal(frozen.mutation.scorecardModified, 0);
  assert.equal(frozen.mutation.paidProviderCalls, 0);
  assert.equal(frozen.probe.paidApis, "NOT_EXECUTED");
  assert.equal(frozen.probe.mlbStatsApiPublic.paidCalls, 0);
  assert.ok(frozen.probe.mlbStatsApiPublic.sabermetricsHittingKeys.includes("wRcPlus"));
  assert.ok(frozen.probe.mlbStatsApiPublic.sabermetricsPitchingKeys.includes("fip"));
  assert.ok(frozen.probe.mlbStatsApiPublic.pitchArsenalTypesObserved.includes("FF"));
  assert.equal(frozen.probe.mlbStatsApiPublic.metricAveragesHttpStatus, 500);

  const recomputed = buildProviderCapabilityAuditDocument({
    generatedAt: frozen.generatedAt,
    gitBefore: frozen.gitBefore,
  });
  assert.deepEqual(recomputed.availabilityCounts, countAvailability(PROVIDER_GAP_MATRIX));
  assert.deepEqual(recomputed.availabilityCounts, frozen.availabilityCounts);
  assert.equal(recomputed.rows.length, frozen.rows.length);
  assert.deepEqual(
    recomputed.rows.map((r) => `${r.sport}|${r.feature}|${r.availability}`),
    frozen.rows.map((r) => `${r.sport}|${r.feature}|${r.availability}`),
  );

  process.stdout.write("test:provider-capability-audit-v1 PASS\n");
}

main();

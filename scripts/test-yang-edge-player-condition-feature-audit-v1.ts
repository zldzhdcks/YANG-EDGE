/**
 * Player Condition Feature Audit v1 tests.
 * No prediction/engine mutation. No provider calls.
 * Run: npm run test:player-condition-feature-audit-v1
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  MLB_PREDICTION_V0_WEIGHTS,
} from "../src/lib/mlb/prediction-v0/config";
import {
  PLAYER_CONDITION_AUDIT_V1_SCHEMA,
  PLAYER_CONDITION_FEATURE_CATALOG,
  buildPlayerConditionAuditDocument,
  countStages,
} from "../src/lib/research/player-condition-framework-v1";

const ROOT = process.cwd();
const AUDIT_REL = "data/audits/yang-edge-player-condition-feature-audit-v1.json";

function main() {
  assert.equal(MLB_PREDICTION_V0_WEIGHTS.marketPrior.value, 0.25);
  assert.equal(MLB_PREDICTION_V0_WEIGHTS.bullpen.value, 0);
  assert.equal(MLB_PREDICTION_V0_WEIGHTS.lineup.value, 0);

  for (const row of PLAYER_CONDITION_FEATURE_CATALOG) {
    assert.equal(
      /marketPrior|implied probability|odds/i.test(row.feature),
      false,
      `player catalog must not include market feature ${row.feature}`,
    );
  }

  const era = PLAYER_CONDITION_FEATURE_CATALOG.find(
    (r) => r.sport === "MLB" && r.feature === "ERA",
  );
  const woba = PLAYER_CONDITION_FEATURE_CATALOG.find((r) =>
    r.feature.startsWith("wOBA"),
  );
  const xg = PLAYER_CONDITION_FEATURE_CATALOG.find((r) =>
    r.feature.includes("xG"),
  );
  assert.equal(era?.stage, "PREDICTION_USED");
  assert.equal(woba?.stage, "NOT_AVAILABLE");
  assert.equal(xg?.stage, "NEEDS_PROVIDER_DOC_REVIEW");

  const frozen = JSON.parse(
    readFileSync(path.join(ROOT, AUDIT_REL), "utf8"),
  ) as ReturnType<typeof buildPlayerConditionAuditDocument>;

  assert.equal(frozen.schemaVersion, PLAYER_CONDITION_AUDIT_V1_SCHEMA);
  assert.equal(frozen.marketInPlayerStrength, false);
  assert.equal(frozen.independentModelSample, 0);
  assert.equal(frozen.weights, "UNDEFINED");
  assert.equal(frozen.todayAdjustedPlayerStrength.weights, "UNDEFINED");
  assert.equal(frozen.todayAdjustedPlayerStrength.marketInputsAllowed, false);
  assert.equal(frozen.shrinkagePolicy.coefficientsFrozen, false);
  assert.equal(frozen.mlbCacheEvidence.hittingGameLogFetched, false);
  assert.equal(frozen.mutation.predictionSnapshotsModified, 0);
  assert.equal(frozen.mutation.engineWeightsModified, 0);
  assert.equal(frozen.mutation.predictionLogicModified, 0);
  assert.equal(frozen.mutation.providerCalls, 0);
  assert.ok(
    frozen.previousMethodologyAuditCommit.startsWith("48c9ac8"),
  );

  const recomputed = buildPlayerConditionAuditDocument({
    generatedAt: frozen.generatedAt,
    gitBefore: frozen.gitBefore,
    previousMethodologyAuditCommit: frozen.previousMethodologyAuditCommit,
  });
  assert.deepEqual(recomputed.stageCounts, countStages(PLAYER_CONDITION_FEATURE_CATALOG));
  assert.deepEqual(recomputed.stageCounts, frozen.stageCounts);
  assert.equal(recomputed.rows.length, frozen.rows.length);
  assert.deepEqual(
    recomputed.rows.map((r) => `${r.sport}|${r.feature}|${r.stage}`),
    frozen.rows.map((r) => `${r.sport}|${r.feature}|${r.stage}`),
  );

  process.stdout.write("test:player-condition-feature-audit-v1 PASS\n");
}

main();

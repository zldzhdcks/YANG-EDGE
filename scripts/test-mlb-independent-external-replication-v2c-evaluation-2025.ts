/**
 * 2025 EXTERNAL REPLICATION TRACK — frozen v2-C evaluation tests.
 * Synthetic fixtures first. Must not parse the real 2025 Join artifact.
 *
 *   npm run test:mlb-independent-external-replication-v2c-evaluation-2025
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { independentJoinArtifactPath } from "../src/lib/mlb/independent-join-v1";
import { independentLabelArtifactPath } from "../src/lib/mlb/independent-label-v1";
import {
  independentSafeAFeatureArtifactPath,
  independentSafeAHistoricalSourcePath,
} from "../src/lib/mlb/independent-safe-a-v1/historical-source";
import {
  MLB_INDEPENDENT_2024_SEALED_JOIN_SHA256_V1,
  independentSplitArtifactPath,
} from "../src/lib/mlb/independent-split-v1";
import { independentLogisticModelPath } from "../src/lib/mlb/independent-logistic-v1";
import { evaluateProbabilitiesV1 } from "../src/lib/mlb/independent-logistic-v1/metrics";
import { independentLogisticV2aModelPath } from "../src/lib/mlb/independent-logistic-v2a";
import { independentLogisticV2bModelPath } from "../src/lib/mlb/independent-logistic-v2b";
import {
  independentLogisticV2cModelPath,
  transformRowV2c,
  type LogisticPreprocessorV2c,
} from "../src/lib/mlb/independent-logistic-v2c";
import {
  MLB_INDEPENDENT_FEATURE_ROW_SCHEMA_V1,
  MLB_INDEPENDENT_LABEL_ROW_SCHEMA_V1,
  type MlbIndependentFeatureRowV1,
  type MlbIndependentIdentityV1,
  type MlbIndependentTeamSideFeaturesV1,
} from "../src/lib/mlb/independent-model-v1";
import {
  ExternalReplicationEvaluationError,
  FROZEN_CONSTANT_BASELINE_PROBABILITY,
  FROZEN_V2C_MODEL_DIMENSIONS,
  MLB_INDEPENDENT_2025_JOIN_ROW_SCHEMA_V1,
  MLB_INDEPENDENT_2025_JOIN_SCHEMA_V1,
  MLB_INDEPENDENT_2025_SEALED_FEATURE_SHA256,
  MLB_INDEPENDENT_2025_SEALED_JOIN_SHA256,
  MLB_INDEPENDENT_2025_SEALED_LABEL_SHA256,
  MLB_INDEPENDENT_2025_SEALED_SOURCE_SHA256,
  MLB_INDEPENDENT_2025_SEALED_V2C_MODEL_ARTIFACT_SHA256,
  MLB_INDEPENDENT_2025_SEALED_V2C_MODEL_CORE_HASH,
  MLB_INDEPENDENT_2025_SEALED_V2C_PROTOCOL_SHA256,
  assertFrozenV2cEvaluationModelContract2025,
  assertPreOpenV2cExternalReplicationGates2025,
  classifyHomeWinProbability2025,
  directionalVerdictFromChecks2025,
  evaluateV2cExternalReplication2025,
  independentExternalReplication2025FeaturePath,
  independentExternalReplication2025JoinPath,
  independentExternalReplication2025LabelPath,
  independentExternalReplication2025SourcePath,
  independentExternalReplication2025V2cProtocolPath,
  independentSealedV2cModelArtifactPath,
  percentileLinear2025,
  rocAucMannWhitney2025,
  transformExternalReplicationFeatureWithFrozenPrep2025,
  type ExternalReplicationJoinArtifact2025,
  type FrozenV2cExternalReplicationProtocol2025,
  type FrozenV2cModelProtocolView,
} from "../src/lib/mlb/independent-external-replication-v1";

const ROOT = process.cwd();
const EVAL_LIB = path.join(
  ROOT,
  "src/lib/mlb/independent-external-replication-v1/evaluate-v2c-2025.ts",
);
const EVAL_SCRIPT = path.join(
  ROOT,
  "scripts/evaluate-mlb-independent-external-replication-v2c-2025.ts",
);
const JOIN_SHA_2024 = MLB_INDEPENDENT_2024_SEALED_JOIN_SHA256_V1;
const SPLIT_MANIFEST_SHA =
  "a72b8586971ee81a04e119c7d860f226abb503b5cc2341bb370d49d2fb47e71d";
const SOURCE_2024_SHA =
  "7a637e182a91a0b20e399ed2a4d98824c3a5916ac61cb6903e504a919a514e7d";
const FEATURE_2024_SHA =
  "5f0cf297ebc9e5a1e0b10aad136632f51ddbc9f6b1560c676f3df2aa2ea8c753";
const LABEL_2024_SHA =
  "9f52cd1de57567819dd7f6fea245baad1365a6eae12dadeafec76ead02d7a3da";
const V1_CORE =
  "7cb5253c824de514c25b1715e6f339b0f35c6942fa25c178423a415ec820430e";
const V2A_CORE =
  "bef2104957768a40cbfecbeb3ff99946dce80a7155ab93a29248cc6fab576c9b";
const V2B_CORE =
  "f601594dcac1ae266424cf1a1503ecc1228099c2b1e090c634d54868f379c24e";
const REFIT_TOKENS = [
  "fitTrainPreprocessorV2c",
  "fitTrainPreprocessorV1",
  "fitFullBatchLogisticV1",
];

function sha256File(filePath: string): string {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function assertThrowsCode(fn: () => unknown, code: string, label: string): void {
  try {
    fn();
  } catch (e) {
    const err = e as { code?: string; message?: string };
    assert.equal(
      err.code,
      code,
      `${label}: expected ${code}, got ${err.code} (${err.message})`,
    );
    return;
  }
  assert.fail(`${label}: expected throw ${code}`);
}

function loadProtocol(): FrozenV2cExternalReplicationProtocol2025 {
  return JSON.parse(
    readFileSync(independentExternalReplication2025V2cProtocolPath(), "utf8"),
  ) as FrozenV2cExternalReplicationProtocol2025;
}

function loadModel(): FrozenV2cModelProtocolView {
  return JSON.parse(
    readFileSync(independentSealedV2cModelArtifactPath(), "utf8"),
  ) as FrozenV2cModelProtocolView;
}

function side(value: number | null = 0.5): MlbIndependentTeamSideFeaturesV1 {
  return {
    gamesPlayedBefore: 10,
    winsBefore: 5,
    lossesBefore: 5,
    winRateBefore: value,
    last5WinsBefore: 2,
    last5LossesBefore: 3,
    last5WinRateBefore: value,
    runsScoredAverageBefore: 4.2,
    runsAllowedAverageBefore: 4.1,
    last5RunsScoredAverageBefore: 4,
    last5RunsAllowedAverageBefore: 4,
    homeWinRateBefore: value,
    awayWinRateBefore: value,
    currentWinStreakBefore: 0,
    currentLossStreakBefore: 0,
    restDaysBefore: 1,
  };
}

function identity(gamePk: number): MlbIndependentIdentityV1 {
  return {
    gamePk,
    officialDate: "2025-06-01",
    homeTeamId: 1,
    awayTeamId: 2,
    commenceTimeUtc: "2025-06-01T17:10:00.000Z",
  };
}

function featureFor(gamePk: number): MlbIndependentFeatureRowV1 {
  const id = identity(gamePk);
  return {
    schemaVersion: MLB_INDEPENDENT_FEATURE_ROW_SCHEMA_V1,
    identity: id,
    featureClass: "SAFE_HISTORICALLY_RECONSTRUCTABLE",
    temporalPolicy: "HISTORICAL_RECONSTRUCTION_D1",
    temporalPhase: "HISTORICAL_RECONSTRUCTION",
    statsThroughDate: "2025-05-31",
    asOf: "2025-05-31",
    cutoffTime: null,
    home: side(0.55),
    away: side(0.45),
    headToHeadGamesBefore: 0,
    headToHeadHomeWinsBefore: 0,
    headToHeadAwayWinsBefore: 0,
    featureHash: "a".repeat(64),
  };
}

function syntheticJoin(
  specs: Array<{ gamePk: number; winner: "HOME" | "AWAY"; target: 0 | 1 }>,
): ExternalReplicationJoinArtifact2025 {
  return {
    schemaVersion: MLB_INDEPENDENT_2025_JOIN_SCHEMA_V1,
    builderVersion: "synthetic",
    researchOnly: true,
    engineAdmission: "PROHIBITED",
    joinReady: true,
    independentModelSample: specs.length,
    datasetReady: false,
    rows: specs.map((spec) => {
      const feat = featureFor(spec.gamePk);
      return {
        schemaVersion: MLB_INDEPENDENT_2025_JOIN_ROW_SCHEMA_V1,
        identity: feat.identity,
        featureHash: feat.featureHash as string,
        feature: feat,
        label: {
          schemaVersion: MLB_INDEPENDENT_LABEL_ROW_SCHEMA_V1,
          identity: feat.identity,
          status: "FINAL",
          winner: spec.winner,
          target: spec.target,
          labelSource: "official-result-artifact",
        },
      };
    }),
  };
}

function main(): void {
  const protocolSha = sha256File(independentExternalReplication2025V2cProtocolPath());
  const joinSha = sha256File(independentExternalReplication2025JoinPath());
  const modelSha = sha256File(independentSealedV2cModelArtifactPath());
  assert.equal(protocolSha, MLB_INDEPENDENT_2025_SEALED_V2C_PROTOCOL_SHA256);
  assert.equal(joinSha, MLB_INDEPENDENT_2025_SEALED_JOIN_SHA256);
  assert.equal(modelSha, MLB_INDEPENDENT_2025_SEALED_V2C_MODEL_ARTIFACT_SHA256);
  const protocol = loadProtocol();
  const model = loadModel();
  assert.equal(model.modelCoreHash, MLB_INDEPENDENT_2025_SEALED_V2C_MODEL_CORE_HASH);

  assertThrowsCode(
    () =>
      assertPreOpenV2cExternalReplicationGates2025({
        protocolSha256: "0".repeat(64),
        joinSha256: joinSha,
        modelArtifactSha256: modelSha,
        protocol,
        model,
      }),
    "PROTOCOL_SHA_PIN_MISMATCH",
    "protocol sha",
  );
  assertThrowsCode(
    () =>
      assertPreOpenV2cExternalReplicationGates2025({
        protocolSha256: protocolSha,
        joinSha256: "0".repeat(64),
        modelArtifactSha256: modelSha,
        protocol,
        model,
      }),
    "JOIN_SHA_PIN_MISMATCH",
    "join sha",
  );
  assertThrowsCode(
    () =>
      assertPreOpenV2cExternalReplicationGates2025({
        protocolSha256: protocolSha,
        joinSha256: joinSha,
        modelArtifactSha256: "0".repeat(64),
        protocol,
        model,
      }),
    "MODEL_ARTIFACT_SHA_PIN_MISMATCH",
    "model artifact sha",
  );
  const coreMismatch = clone(model);
  coreMismatch.modelCoreHash = "0".repeat(64);
  assertThrowsCode(
    () =>
      assertPreOpenV2cExternalReplicationGates2025({
        protocolSha256: protocolSha,
        joinSha256: joinSha,
        modelArtifactSha256: modelSha,
        protocol,
        model: coreMismatch,
      }),
    "MODEL_CORE_HASH_PIN_MISMATCH",
    "modelCoreHash",
  );
  const coefMismatch = clone(model);
  coefMismatch.coefficients = (coefMismatch.coefficients as number[]).slice(0, 41);
  assertThrowsCode(
    () => assertFrozenV2cEvaluationModelContract2025(coefMismatch),
    "MODEL_COEFFICIENT_COUNT_MISMATCH",
    "coefficients",
  );
  const dimMismatch = clone(model);
  dimMismatch.featureSpec = { ...dimMismatch.featureSpec, modelDimensions: 41 };
  assertThrowsCode(
    () => assertFrozenV2cEvaluationModelContract2025(dimMismatch),
    "MODEL_FEATURE_DIMENSION_MISMATCH",
    "dimensions",
  );
  const interceptMismatch = clone(model);
  interceptMismatch.intercept = 0;
  assertThrowsCode(
    () => assertFrozenV2cEvaluationModelContract2025(interceptMismatch),
    "INTERCEPT_MISMATCH",
    "intercept",
  );
  const thresholdMismatch = clone(model);
  thresholdMismatch.hyperparameters = {
    ...thresholdMismatch.hyperparameters,
    threshold: 0.6,
  };
  assertThrowsCode(
    () => assertFrozenV2cEvaluationModelContract2025(thresholdMismatch),
    "THRESHOLD_MISMATCH",
    "threshold",
  );
  const fitPart = clone(model);
  fitPart.preprocessing = { ...fitPart.preprocessing, fitPartition: "VALIDATION" };
  assertThrowsCode(
    () => assertFrozenV2cEvaluationModelContract2025(fitPart),
    "PREPROCESSING_FIT_PARTITION_MISMATCH",
    "fitPartition",
  );
  const fitN = clone(model);
  fitN.preprocessing = { ...fitN.preprocessing, fitSampleCount: 2430 };
  assertThrowsCode(
    () => assertFrozenV2cEvaluationModelContract2025(fitN),
    "PREPROCESSING_FIT_SAMPLE_COUNT_MISMATCH",
    "fitSampleCount",
  );
  console.log("PRE_OPEN_PIN_AND_CONTRACT_BLOCKS = PASS");

  const evalLib = readFileSync(EVAL_LIB, "utf8");
  const evalScript = readFileSync(EVAL_SCRIPT, "utf8");
  for (const token of REFIT_TOKENS) {
    assert.equal(evalLib.includes(token), false, `eval lib ${token}`);
    assert.equal(evalScript.includes(token), false, `eval script ${token}`);
  }
  assert.equal(evalLib.includes("independent-logistic-v2c"), false);
  assert.equal(evalLib.includes("holdoutGamePks"), false);
  assert.equal(evalLib.includes("independent-join-v1"), false);
  assert.equal(evalLib.includes("independent-label-v1"), false);
  assert.match(evalScript, /sha256Bytes\(joinBuf\)/);
  assert.match(evalScript, /JSON\.parse\(joinBuf/);
  console.log("REFIT_FUNCTION_ABSENT = PASS");
  console.log("2025_FIT_ABSENT = PASS");

  const feat = featureFor(1);
  const localX = transformExternalReplicationFeatureWithFrozenPrep2025(
    feat,
    (model as { preprocessing: LogisticPreprocessorV2c }).preprocessing,
  );
  const v2cX = transformRowV2c(
    feat,
    (model as { preprocessing: LogisticPreprocessorV2c }).preprocessing,
  );
  assert.equal(localX.length, FROZEN_V2C_MODEL_DIMENSIONS);
  assert.equal(v2cX.length, 42);
  assert.deepEqual(localX, v2cX);
  console.log("TRANSFORM_DIMENSION_42 = PASS");
  console.log("TRANSFORM_EQUIVALENT_TO_SEALED_V2C = PASS");

  const zeroScale = clone(model);
  const firstName = (zeroScale.preprocessing?.orderedBaseFeatureNames as string[])[0]!;
  (zeroScale.preprocessing as { scaleByFeature: Record<string, number> }).scaleByFeature[
    firstName
  ] = 0;
  assertThrowsCode(
    () =>
      transformExternalReplicationFeatureWithFrozenPrep2025(
        feat,
        zeroScale.preprocessing as LogisticPreprocessorV2c,
      ),
    "TRANSFORM_NONFINITE",
    "nonfinite transform",
  );
  console.log("NONFINITE_TRANSFORM_BLOCK = PASS");

  assert.equal(classifyHomeWinProbability2025(0.5), 1);
  assert.equal(classifyHomeWinProbability2025(0.499999999999), 0);
  assertThrowsCode(() => classifyHomeWinProbability2025(0), "PROBABILITY_OUT_OF_BOUNDS", "p=0");
  assertThrowsCode(() => classifyHomeWinProbability2025(1), "PROBABILITY_OUT_OF_BOUNDS", "p=1");
  console.log("THRESHOLD_RULE_GTE_0_5 = PASS");
  console.log("PROBABILITY_OUT_OF_BOUNDS_BLOCK = PASS");

  const infCoef = clone(model);
  (infCoef.coefficients as number[])[0] = Number.POSITIVE_INFINITY;
  assertThrowsCode(
    () =>
      evaluateV2cExternalReplication2025({
        protocolSha256: protocolSha,
        joinSha256: joinSha,
        modelArtifactSha256: modelSha,
        protocol,
        model: infCoef,
        join: syntheticJoin([{ gamePk: 1, winner: "HOME", target: 1 }]),
        sealed: false,
      }),
    "LOGIT_NONFINITE",
    "nonfinite logit",
  );
  console.log("NONFINITE_LOGIT_BLOCK = PASS");

  assertThrowsCode(
    () =>
      evaluateV2cExternalReplication2025({
        protocolSha256: protocolSha,
        joinSha256: joinSha,
        modelArtifactSha256: modelSha,
        protocol,
        model,
        join: syntheticJoin([{ gamePk: 1, winner: "AWAY", target: 1 }]),
        sealed: false,
      }),
    "WINNER_TARGET_MISMATCH",
    "winner/target",
  );
  console.log("WINNER_TARGET_VALIDATION = PASS");

  assertThrowsCode(
    () =>
      evaluateV2cExternalReplication2025({
        protocolSha256: protocolSha,
        joinSha256: joinSha,
        modelArtifactSha256: modelSha,
        protocol,
        model,
        join: syntheticJoin([
          { gamePk: 1, winner: "HOME", target: 1 },
          { gamePk: 2, winner: "AWAY", target: 0 },
        ]),
        sealed: true,
      }),
    "EVALUATION_SAMPLE_COUNT_MISMATCH",
    "sealed row count",
  );
  console.log("SEALED_ROW_COUNT_2430_BLOCK = PASS");

  const two = evaluateV2cExternalReplication2025({
    protocolSha256: protocolSha,
    joinSha256: joinSha,
    modelArtifactSha256: modelSha,
    protocol,
    model,
    join: syntheticJoin([
      { gamePk: 1, winner: "HOME", target: 1 },
      { gamePk: 2, winner: "AWAY", target: 0 },
    ]),
    sealed: false,
    generatedAt: "2026-09-03T00:00:00.000Z",
  });
  assert.equal(two.evaluation.sampleCount, 2);
  assert.equal(two.evaluation.modelCandidate, false);
  assert.equal(two.audit.holdoutEvaluated, false);
  assert.equal(two.audit.externalAggregateEvaluationCount, 1);
  assert.equal(two.audit.monthlyAnalysisPerformed, false);
  assert.equal(two.evaluation.constantBaselineMetrics.probability, 776 / 1463);
  assert.equal(
    two.evaluation.constantBaselineMetrics.probability,
    FROZEN_CONSTANT_BASELINE_PROBABILITY,
  );
  assert.equal(two.evaluation.constantBaselineMetrics.rocAuc, 0.5);
  for (const row of two.evaluation.rows) {
    assert.equal(row.probability > 0 && row.probability < 1, true);
    assert.equal(row.predictedClass, row.probability >= 0.5 ? 1 : 0);
  }
  const replay = evaluateV2cExternalReplication2025({
    protocolSha256: protocolSha,
    joinSha256: joinSha,
    modelArtifactSha256: modelSha,
    protocol,
    model,
    join: syntheticJoin([
      { gamePk: 1, winner: "HOME", target: 1 },
      { gamePk: 2, winner: "AWAY", target: 0 },
    ]),
    sealed: false,
    generatedAt: "2026-09-03T00:00:00.000Z",
  });
  assert.deepEqual(replay.evaluation.rows, two.evaluation.rows);
  assert.deepEqual(replay.evaluation.primaryMetrics, two.evaluation.primaryMetrics);
  console.log("SYNTHETIC_EVALUATION_AND_BASELINE = PASS");

  assert.equal(rocAucMannWhitney2025([1, 0], [0.9, 0.1]), 1);
  assert.equal(rocAucMannWhitney2025([1, 0], [0.1, 0.9]), 0);
  assert.equal(rocAucMannWhitney2025([1, 0], [0.5, 0.5]), 0.5);
  const known = evaluateProbabilitiesV1([1, 0], [0.5, 0.5], 0.5);
  assert.ok(Math.abs(known.logLoss - Math.LN2) < 1e-12);
  assert.equal(known.brierScore, 0.25);
  assert.equal(percentileLinear2025([10, 20, 30, 40], 0.5), 25);
  assert.equal(percentileLinear2025([10, 20, 30, 40], 0.25), 17.5);
  assert.equal(
    directionalVerdictFromChecks2025({
      AUC_PASS: true,
      LOGLOSS_PASS: true,
      BRIER_PASS: true,
    }),
    "DIRECTIONAL_EXTERNAL_REPLICATION_SUPPORTED",
  );
  assert.equal(
    directionalVerdictFromChecks2025({
      AUC_PASS: true,
      LOGLOSS_PASS: false,
      BRIER_PASS: true,
    }),
    "MIXED_EXTERNAL_REPLICATION",
  );
  assert.equal(
    directionalVerdictFromChecks2025({
      AUC_PASS: false,
      LOGLOSS_PASS: false,
      BRIER_PASS: false,
    }),
    "EXTERNAL_REPLICATION_NOT_SUPPORTED",
  );
  console.log("KNOWN_METRIC_AND_VERDICT_FIXTURES = PASS");
  console.log("AGGREGATE_ONLY_GUARDS = PASS");
  console.log("CANDIDATE_REMAINS_FALSE = PASS");

  assert.equal(
    evalLib.includes("JSON.parse(readFile") || evalLib.includes("readFileSync"),
    false,
  );
  assert.equal(evalScript.includes("independentExternalReplication2025JoinPath"), true);
  console.log("SYNTHETIC_TESTS_DID_NOT_PARSE_REAL_JOIN_ROWS = PASS");

  assert.equal(
    sha256File(independentExternalReplication2025SourcePath()),
    MLB_INDEPENDENT_2025_SEALED_SOURCE_SHA256,
  );
  assert.equal(
    sha256File(independentExternalReplication2025FeaturePath()),
    MLB_INDEPENDENT_2025_SEALED_FEATURE_SHA256,
  );
  assert.equal(
    sha256File(independentExternalReplication2025LabelPath()),
    MLB_INDEPENDENT_2025_SEALED_LABEL_SHA256,
  );
  assert.equal(sha256File(independentExternalReplication2025JoinPath()), joinSha);
  assert.equal(sha256File(independentJoinArtifactPath()), JOIN_SHA_2024);
  assert.equal(sha256File(independentSafeAHistoricalSourcePath()), SOURCE_2024_SHA);
  assert.equal(sha256File(independentSafeAFeatureArtifactPath()), FEATURE_2024_SHA);
  assert.equal(sha256File(independentLabelArtifactPath()), LABEL_2024_SHA);
  const split = JSON.parse(readFileSync(independentSplitArtifactPath(), "utf8")) as {
    holdoutGamePks: number[];
    splitManifestHash: string;
  };
  assert.equal(split.splitManifestHash, SPLIT_MANIFEST_SHA);
  assert.equal(split.holdoutGamePks.length, 483);
  const v1 = JSON.parse(readFileSync(independentLogisticModelPath(), "utf8")) as {
    modelCoreHash: string;
  };
  const v2a = JSON.parse(readFileSync(independentLogisticV2aModelPath(), "utf8")) as {
    modelCoreHash: string;
  };
  const v2b = JSON.parse(readFileSync(independentLogisticV2bModelPath(), "utf8")) as {
    modelCoreHash: string;
  };
  const v2c = JSON.parse(readFileSync(independentLogisticV2cModelPath(), "utf8")) as {
    modelCoreHash: string;
    holdoutEvaluated: boolean;
    modelCandidate: boolean;
  };
  assert.equal(v1.modelCoreHash, V1_CORE);
  assert.equal(v2a.modelCoreHash, V2A_CORE);
  assert.equal(v2b.modelCoreHash, V2B_CORE);
  assert.equal(v2c.modelCoreHash, MLB_INDEPENDENT_2025_SEALED_V2C_MODEL_CORE_HASH);
  assert.equal(v2c.holdoutEvaluated, false);
  assert.equal(v2c.modelCandidate, false);
  console.log("ALL_SEALED_INPUTS_UNCHANGED = PASS");
  console.log("HOLDOUT_REMAINS_SEALED = PASS");
  assert.equal(existsSync(independentExternalReplication2025JoinPath()), true);
  console.log("test:mlb-independent-external-replication-v2c-evaluation-2025 PASS");
}

main();

/**
 * 2025 EXTERNAL REPLICATION TRACK — freeze v2-C evaluation protocol tests.
 * Protocol only. No 2025 transform, logits, probabilities, or metrics.
 *
 *   npm run test:mlb-independent-external-replication-v2c-protocol-2025
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
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
import { independentLogisticV2aModelPath } from "../src/lib/mlb/independent-logistic-v2a";
import { independentLogisticV2bModelPath } from "../src/lib/mlb/independent-logistic-v2b";
import {
  independentLogisticV2cModelPath,
  orderedLogisticBaseFeatureNamesV2c,
  orderedLogisticMissingIndicatorNamesV2c,
  orderedLogisticModelFeatureNamesV2c,
} from "../src/lib/mlb/independent-logistic-v2c";
import {
  FROZEN_CONSTANT_BASELINE_PROBABILITY,
  FROZEN_PRIMARY_ENDPOINTS,
  FROZEN_V2C_INTERCEPT,
  FROZEN_V2C_ORDERED_BASE_FEATURE_NAMES,
  FROZEN_V2C_ORDERED_MISSING_INDICATOR_NAMES,
  MLB_INDEPENDENT_2025_SEALED_FEATURE_SHA256,
  MLB_INDEPENDENT_2025_SEALED_JOIN_SHA256,
  MLB_INDEPENDENT_2025_SEALED_LABEL_SHA256,
  MLB_INDEPENDENT_2025_SEALED_SOURCE_SHA256,
  MLB_INDEPENDENT_2025_SEALED_V2C_MODEL_CORE_HASH,
  assertFrozenV2cExternalReplicationProtocol2025,
  hashExternalReplicationProtocolArtifact2025,
  independentExternalReplication2025FeaturePath,
  independentExternalReplication2025JoinPath,
  independentExternalReplication2025LabelPath,
  independentExternalReplication2025SourcePath,
  independentExternalReplication2025V2cProtocolAuditPath,
  independentExternalReplication2025V2cProtocolPath,
  independentSealedV2cModelArtifactPath,
  preregisterV2cExternalReplicationProtocol2025,
  type FrozenV2cExternalReplicationProtocol2025,
  type FrozenV2cModelProtocolView,
} from "../src/lib/mlb/independent-external-replication-v1";

const ROOT = process.cwd();
const PROTOCOL_LIB = path.join(
  ROOT,
  "src/lib/mlb/independent-external-replication-v1/preregister-v2c-evaluation-2025.ts",
);
const PROTOCOL_SCRIPT = path.join(
  ROOT,
  "scripts/preregister-mlb-independent-external-replication-v2c-2025.ts",
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
const V2C_CORE = MLB_INDEPENDENT_2025_SEALED_V2C_MODEL_CORE_HASH;
const FORBIDDEN_CALLS = [
  "transformRowV2c",
  "fitTrainPreprocessorV2c",
  "predictLogisticProbability",
  "evaluateProbabilitiesV1",
  "rocAucMannWhitney",
  "transformMatrixV2c",
  "fitFullBatchLogisticV1",
];

function sha256File(filePath: string): string {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function listFiles(dir: string, acc: string[] = []): string[] {
  if (!existsSync(dir)) return acc;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) listFiles(full, acc);
    else acc.push(full);
  }
  return acc;
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

function loadModel(): FrozenV2cModelProtocolView {
  return JSON.parse(
    readFileSync(independentSealedV2cModelArtifactPath(), "utf8"),
  ) as FrozenV2cModelProtocolView;
}

function register(
  model: FrozenV2cModelProtocolView,
  joinSha = MLB_INDEPENDENT_2025_SEALED_JOIN_SHA256,
  modelSha = sha256File(independentSealedV2cModelArtifactPath()),
) {
  return preregisterV2cExternalReplicationProtocol2025({
    joinArtifactSha256: joinSha,
    modelArtifactSha256: modelSha,
    model,
    generatedAt: "2026-09-03T00:00:00.000Z",
  });
}

function main(): void {
  const joinSha = sha256File(independentExternalReplication2025JoinPath());
  assert.equal(joinSha, MLB_INDEPENDENT_2025_SEALED_JOIN_SHA256);
  console.log("JOIN_SHA_PIN_MATCH = PASS");

  const modelPath = independentSealedV2cModelArtifactPath();
  const modelShaBefore = sha256File(modelPath);
  assert.equal(modelPath, independentLogisticV2cModelPath());
  const model = loadModel();
  assert.equal(model.modelCoreHash, V2C_CORE);
  const ok = register(model, joinSha, modelShaBefore);
  assert.equal(ok.audit.joinRowsParsed, false);
  assert.equal(ok.audit.joinShaVerified, true);
  assert.equal(ok.audit.modelArtifactRead, true);
  assert.equal(ok.audit.modelCoreHashVerified, true);
  assert.equal(ok.audit["2025ModelUnseen"], true);
  assert.equal(ok.audit["2025TransformedXCreated"], false);
  assert.equal(ok.audit["2025LogitsCreated"], false);
  assert.equal(ok.audit["2025ProbabilitiesCreated"], false);
  assert.equal(ok.audit["2025Evaluated"], false);
  assert.equal(ok.audit.splitCreated, false);
  assert.equal(ok.audit.holdoutEvaluated, false);
  assert.equal(ok.audit.modelCandidate, false);
  assert.equal(ok.audit.protocolSealed, false);
  assert.equal(ok.protocol.expectedSampleCount, 2430);
  assert.equal(ok.protocol.constantBaselineProbability, 776 / 1463);
  assert.equal(ok.protocol.constantBaselineProbability, FROZEN_CONSTANT_BASELINE_PROBABILITY);
  assert.equal(ok.protocol.frozenParameters.intercept, FROZEN_V2C_INTERCEPT);
  assert.equal(ok.protocol.frozenParameters.coefficientCount, 42);
  assert.equal(ok.protocol.frozenParameters.threshold, 0.5);
  assert.equal(ok.protocol.frozenParameters.lambdaProvenance, 0.01);
  assert.deepEqual(ok.protocol.primaryEndpoints, [...FROZEN_PRIMARY_ENDPOINTS]);
  assert.deepEqual(
    ok.protocol.frozenFeatureSpec.orderedBaseFeatureNames,
    orderedLogisticBaseFeatureNamesV2c(),
  );
  assert.deepEqual(
    ok.protocol.frozenFeatureSpec.orderedMissingIndicatorNames,
    orderedLogisticMissingIndicatorNamesV2c(),
  );
  assert.deepEqual(
    ok.protocol.frozenFeatureSpec.orderedModelFeatureNames,
    orderedLogisticModelFeatureNamesV2c(),
  );
  assert.deepEqual(
    [...FROZEN_V2C_ORDERED_BASE_FEATURE_NAMES],
    orderedLogisticBaseFeatureNamesV2c(),
  );
  assert.deepEqual(
    [...FROZEN_V2C_ORDERED_MISSING_INDICATOR_NAMES],
    orderedLogisticMissingIndicatorNamesV2c(),
  );
  assert.equal(ok.protocol.frozenFeatureSpec.missingIndicatorOrderChanged, false);
  assert.equal(ok.protocol.frozenPreprocessing.PREPROCESSOR_SOURCE, "FROZEN_2024_TRAIN");
  assert.equal(ok.protocol.candidatePolicy.V2C_MODEL_CANDIDATE_AUTOMATIC_AFTER_EXTERNAL, false);
  assert.equal(ok.protocol.holdoutPolicy.evaluated, false);
  assert.equal(ok.protocol.futureEvaluator.parseJoinedRowsDuringProtocolRegistration, false);
  assert.equal(sha256File(modelPath), modelShaBefore);
  console.log("MODEL_CORE_HASH_PIN_MATCH = PASS");
  console.log("MODEL_ARTIFACT_UNCHANGED = PASS");
  console.log("JOIN_ROWS_NOT_PARSED = YES");

  assertThrowsCode(
    () => register(model, "0".repeat(64), modelShaBefore),
    "JOIN_SHA_PIN_MISMATCH",
    "join sha",
  );
  const coreMismatch = clone(model);
  coreMismatch.modelCoreHash = "0".repeat(64);
  assertThrowsCode(
    () => register(coreMismatch, joinSha, modelShaBefore),
    "MODEL_CORE_HASH_PIN_MISMATCH",
    "modelCoreHash",
  );
  const coefMismatch = clone(model);
  coefMismatch.coefficients = (coefMismatch.coefficients as number[]).slice(0, 41);
  assertThrowsCode(
    () => register(coefMismatch, joinSha, modelShaBefore),
    "MODEL_COEFFICIENT_COUNT_MISMATCH",
    "coefficients",
  );
  const dimMismatch = clone(model);
  dimMismatch.featureSpec = { ...dimMismatch.featureSpec, modelDimensions: 41 };
  assertThrowsCode(
    () => register(dimMismatch, joinSha, modelShaBefore),
    "MODEL_FEATURE_DIMENSION_MISMATCH",
    "modelDimensions",
  );
  const fitPart = clone(model);
  fitPart.preprocessing = { ...fitPart.preprocessing, fitPartition: "VALIDATION" };
  assertThrowsCode(
    () => register(fitPart, joinSha, modelShaBefore),
    "PREPROCESSING_FIT_PARTITION_MISMATCH",
    "fitPartition",
  );
  const fitN = clone(model);
  fitN.preprocessing = { ...fitN.preprocessing, fitSampleCount: 2430 };
  assertThrowsCode(
    () => register(fitN, joinSha, modelShaBefore),
    "PREPROCESSING_FIT_SAMPLE_COUNT_MISMATCH",
    "fitSampleCount",
  );
  const baseOrder = clone(model);
  const swapped = [...(baseOrder.featureSpec?.orderedBaseFeatureNames as string[])];
  const tmp = swapped[0]!;
  swapped[0] = swapped[1]!;
  swapped[1] = tmp;
  baseOrder.featureSpec = { ...baseOrder.featureSpec, orderedBaseFeatureNames: swapped };
  assertThrowsCode(
    () => register(baseOrder, joinSha, modelShaBefore),
    "BASE_FEATURE_ORDER_MISMATCH",
    "base feature order",
  );
  const missingOrder = clone(model);
  const missing = [...(missingOrder.featureSpec?.orderedMissingIndicatorNames as string[])].filter(
    (name) => name !== "home.restDaysBefore.missing",
  );
  missingOrder.featureSpec = {
    ...missingOrder.featureSpec,
    orderedMissingIndicatorNames: missing,
  };
  assertThrowsCode(
    () => register(missingOrder, joinSha, modelShaBefore),
    "MISSING_INDICATOR_ORDER_MISMATCH",
    "missing-indicator order",
  );
  const threshold = clone(model);
  threshold.hyperparameters = { ...threshold.hyperparameters, threshold: 0.6 };
  assertThrowsCode(
    () => register(threshold, joinSha, modelShaBefore),
    "THRESHOLD_MISMATCH",
    "threshold",
  );
  console.log("MODEL_AND_JOIN_PIN_BLOCKS = PASS");

  const mutatedPrimary = clone(ok.protocol) as FrozenV2cExternalReplicationProtocol2025;
  mutatedPrimary.primaryEndpoints = ["ROC AUC", "accuracy"];
  assertThrowsCode(
    () => assertFrozenV2cExternalReplicationProtocol2025(mutatedPrimary),
    "PRIMARY_ENDPOINTS_CHANGED",
    "primary endpoints",
  );
  const mutatedBaseline = clone(ok.protocol) as FrozenV2cExternalReplicationProtocol2025;
  mutatedBaseline.constantBaselineProbability = 0.5;
  assertThrowsCode(
    () => assertFrozenV2cExternalReplicationProtocol2025(mutatedBaseline),
    "PROTOCOL_BASELINE_MISMATCH",
    "baseline",
  );
  const mutatedAggregate = clone(ok.protocol) as FrozenV2cExternalReplicationProtocol2025;
  mutatedAggregate.aggregateOnlyRules = {
    ...mutatedAggregate.aggregateOnlyRules,
    EXTERNAL_AGGREGATE_EVALUATION_COUNT: 2,
  };
  assertThrowsCode(
    () => assertFrozenV2cExternalReplicationProtocol2025(mutatedAggregate),
    "AGGREGATE_ONLY_RULE_CHANGED",
    "aggregate-only",
  );
  const mutatedCandidate = clone(ok.protocol) as FrozenV2cExternalReplicationProtocol2025;
  mutatedCandidate.candidatePolicy = {
    ...mutatedCandidate.candidatePolicy,
    V2C_MODEL_CANDIDATE_AUTOMATIC_AFTER_EXTERNAL: true,
  };
  assertThrowsCode(
    () => assertFrozenV2cExternalReplicationProtocol2025(mutatedCandidate),
    "AUTOMATIC_CANDIDATE_PROMOTION_PROHIBITED",
    "automatic candidate",
  );
  const mutatedHoldout = clone(ok.protocol) as FrozenV2cExternalReplicationProtocol2025;
  mutatedHoldout.holdoutPolicy = {
    ...mutatedHoldout.holdoutPolicy,
    evaluated: true,
  };
  assertThrowsCode(
    () => assertFrozenV2cExternalReplicationProtocol2025(mutatedHoldout),
    "HOLDOUT_REMAINS_SEALED",
    "holdout",
  );
  console.log("PROTOCOL_RULE_BLOCKS = PASS");
  console.log("AUTOMATIC_CANDIDATE_PROMOTION_PROHIBITED = PASS");
  console.log("HOLDOUT_REMAINS_SEALED = PASS");

  const protocolSrc = readFileSync(PROTOCOL_LIB, "utf8");
  const scriptSrc = readFileSync(PROTOCOL_SCRIPT, "utf8");
  const libDir = path.join(ROOT, "src/lib/mlb/independent-external-replication-v1");
  assert.equal(protocolSrc.includes("JSON.parse"), false, "protocol module parses JSON");
  assert.equal(protocolSrc.includes("readFile"), false, "protocol module reads files");
  assert.equal(protocolSrc.includes(".rows"), false, "protocol module mentions join rows");
  assert.equal(scriptSrc.includes("JSON.parse(joinBuf"), false);
  assert.equal(scriptSrc.includes("joinBuf.toString"), false);
  assert.match(scriptSrc, /sha256Bytes\(joinBuf\)/);
  assert.match(scriptSrc, /JSON\.parse\(modelBuf/);
  for (const token of FORBIDDEN_CALLS) {
    assert.equal(protocolSrc.includes(token), false, `protocol module ${token}`);
    assert.equal(scriptSrc.includes(token), false, `protocol script ${token}`);
  }
  assert.equal(protocolSrc.includes("independent-logistic-v2c"), false);
  assert.equal(protocolSrc.includes("independent-join-v1"), false);
  assert.equal(protocolSrc.includes("independent-label-v1"), false);
  assert.equal(protocolSrc.includes("holdoutGamePks"), false);
  for (const filePath of listFiles(libDir)) {
    if (!filePath.endsWith(".ts")) continue;
    const text = readFileSync(filePath, "utf8");
    assert.equal(text.includes("independent-logistic-v2c"), false, filePath);
  }
  console.log("PROTOCOL_GENERATOR_DOES_NOT_PARSE_JOIN_ROWS = PASS");
  console.log("NO_TRANSFORM_LOGIT_PROBABILITY_METRIC_CALLS = PASS");

  const replication2025 = path.join(
    ROOT,
    "data/research/mlb/independent-model-v1/external-replication/2025",
  );
  for (const filePath of listFiles(replication2025)) {
    const base = path.basename(filePath).toLowerCase();
    assert.equal(base.includes("probability"), false, filePath);
    assert.equal(base.includes("probabilities"), false, filePath);
    assert.equal(base.includes("logit"), false, filePath);
    assert.equal(base.includes("transformed"), false, filePath);
    if (!base.includes("evaluation")) {
      assert.equal(base.includes("eval"), false, filePath);
    }
  }
  console.log("NO_2025_PROBABILITY_ARTIFACT = PASS");

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
  assert.equal(
    sha256File(independentExternalReplication2025JoinPath()),
    MLB_INDEPENDENT_2025_SEALED_JOIN_SHA256,
  );
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
  assert.equal(v2c.modelCoreHash, V2C_CORE);
  assert.equal(v2c.holdoutEvaluated, false);
  assert.equal(v2c.modelCandidate, false);
  assert.equal(sha256File(modelPath), modelShaBefore);
  console.log("ALL_SEALED_INPUTS_UNCHANGED = PASS");
  console.log("2024_HOLDOUT_PROXY_SEAL = PASS");

  if (existsSync(independentExternalReplication2025V2cProtocolPath())) {
    const persisted = JSON.parse(
      readFileSync(independentExternalReplication2025V2cProtocolPath(), "utf8"),
    ) as FrozenV2cExternalReplicationProtocol2025;
    const reproduced = preregisterV2cExternalReplicationProtocol2025({
      joinArtifactSha256: joinSha,
      modelArtifactSha256: modelShaBefore,
      model,
      generatedAt: persisted.generatedAt,
    });
    assert.equal(
      hashExternalReplicationProtocolArtifact2025(reproduced.protocol),
      sha256File(independentExternalReplication2025V2cProtocolPath()),
    );
    assert.equal(
      reproduced.audit.protocolArtifactSha256,
      JSON.parse(
        readFileSync(independentExternalReplication2025V2cProtocolAuditPath(), "utf8"),
      ).protocolArtifactSha256,
    );
    assertFrozenV2cExternalReplicationProtocol2025(persisted);
  }

  assert.equal(statSync(independentExternalReplication2025JoinPath()).size > 0, true);
  console.log("test:mlb-independent-external-replication-v2c-protocol-2025 PASS");
}

main();

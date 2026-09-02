/**
 * Independent Logistic Validation shift diagnostic v1 tests.
 * HOLDOUT features/labels are not read. No retrain. No engine wiring.
 *
 *   npm run test:mlb-independent-logistic-validation-diagnostic-v1
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { independentJoinArtifactPath } from "../src/lib/mlb/independent-join-v1";
import type { IndependentJoinArtifactV1 } from "../src/lib/mlb/independent-join-v1";
import { independentLabelArtifactPath } from "../src/lib/mlb/independent-label-v1";
import {
  independentSafeAFeatureArtifactPath,
  independentSafeAHistoricalSourcePath,
} from "../src/lib/mlb/independent-safe-a-v1/historical-source";
import {
  MLB_INDEPENDENT_2024_SEALED_JOIN_SHA256_V1,
  independentSplitArtifactPath,
} from "../src/lib/mlb/independent-split-v1";
import type { IndependentSplitArtifactV1 } from "../src/lib/mlb/independent-split-v1";
import { orderedLogisticModelFeatureNamesV1 } from "../src/lib/mlb/independent-logistic-v1/spec";
import {
  MLB_INDEPENDENT_2024_SEALED_LOGISTIC_CORE_HASH_V1,
  MLB_INDEPENDENT_2024_SEALED_SPLIT_MANIFEST_HASH_V1,
  SEMANTIC_FEATURE_GROUPS_V1,
  assertSemanticGroupCoverageV1,
  auditStructuralIdentitiesV1,
  classifyValidationShiftV1,
  diagnoseLogisticValidationShiftV1,
  featureShiftContributionsV1,
  independentLogisticDiagnosticAuditPath,
  independentLogisticDiagnosticPath,
  meanLogitFromMeansV1,
  pearsonCorrelationV1,
  sealedLogisticEvalPath,
  sealedLogisticModelPath,
  sealedLogisticPrototypeAuditPath,
  type FrozenPrototypeEvalV1,
  type FrozenPrototypeModelV1,
} from "../src/lib/mlb/independent-logistic-diagnostic-v1";

const ROOT = process.cwd();
const LIB_DIR = path.join(
  ROOT,
  "src/lib/mlb/independent-logistic-diagnostic-v1",
);
const JOIN_BEFORE = MLB_INDEPENDENT_2024_SEALED_JOIN_SHA256_V1;
const FEATURE_BEFORE =
  "5f0cf297ebc9e5a1e0b10aad136632f51ddbc9f6b1560c676f3df2aa2ea8c753";
const LABEL_BEFORE =
  "9f52cd1de57567819dd7f6fea245baad1365a6eae12dadeafec76ead02d7a3da";
const SOURCE_BEFORE =
  "7a637e182a91a0b20e399ed2a4d98824c3a5916ac61cb6903e504a919a514e7d";
const SPLIT_MANIFEST_BEFORE = MLB_INDEPENDENT_2024_SEALED_SPLIT_MANIFEST_HASH_V1;
const MODEL_CORE_BEFORE = MLB_INDEPENDENT_2024_SEALED_LOGISTIC_CORE_HASH_V1;

function sha256File(filePath: string): string {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function shuffle<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = (i * 7 + 3) % (i + 1);
    const tmp = out[i]!;
    out[i] = out[j]!;
    out[j] = tmp;
  }
  return out;
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

function loadJoin(): IndependentJoinArtifactV1 {
  return JSON.parse(readFileSync(independentJoinArtifactPath(), "utf8"));
}

function loadSplit(): IndependentSplitArtifactV1 {
  return JSON.parse(readFileSync(independentSplitArtifactPath(), "utf8"));
}

function loadModel(): FrozenPrototypeModelV1 {
  return JSON.parse(readFileSync(sealedLogisticModelPath(), "utf8"));
}

function loadEval(): FrozenPrototypeEvalV1 {
  return JSON.parse(readFileSync(sealedLogisticEvalPath(), "utf8"));
}

function sealHoldoutRows(
  join: IndependentJoinArtifactV1,
  holdoutGamePks: number[],
): IndependentJoinArtifactV1 {
  const sealed = new Set(holdoutGamePks);
  return {
    ...join,
    rows: join.rows.map((row) => {
      if (!sealed.has(row.identity.gamePk)) return row;
      return new Proxy(row, {
        get(target, prop) {
          if (prop === "feature" || prop === "label") {
            throw new Error(`HOLDOUT_ACCESSED:${String(prop)}`);
          }
          return Reflect.get(target, prop);
        },
      });
    }),
  };
}

function main(): void {
  const joinHashBefore = sha256File(independentJoinArtifactPath());
  const splitHashBefore = sha256File(independentSplitArtifactPath());
  const featureHashBefore = sha256File(independentSafeAFeatureArtifactPath());
  const labelHashBefore = sha256File(independentLabelArtifactPath());
  const sourceHashBefore = sha256File(independentSafeAHistoricalSourcePath());
  const modelHashBefore = sha256File(sealedLogisticModelPath());
  const evalHashBefore = sha256File(sealedLogisticEvalPath());
  const prototypeAuditHashBefore = sha256File(
    sealedLogisticPrototypeAuditPath(),
  );
  assert.equal(joinHashBefore, JOIN_BEFORE);
  assert.equal(featureHashBefore, FEATURE_BEFORE);
  assert.equal(labelHashBefore, LABEL_BEFORE);
  assert.equal(sourceHashBefore, SOURCE_BEFORE);

  const join = loadJoin();
  const split = loadSplit();
  const model = loadModel();
  const evaluation = loadEval();
  assert.equal(split.splitManifestHash, SPLIT_MANIFEST_BEFORE);
  assert.equal(model.modelCoreHash, MODEL_CORE_BEFORE);
  assert.equal(evaluation.modelCoreHash, MODEL_CORE_BEFORE);
  assert.equal(model.modelPrototype, true);
  assert.equal(model.engineApproved, false);
  assert.equal(model.holdoutEvaluated, false);
  assert.equal(model.trainingSampleCount, 1463);
  assert.equal(model.validationSampleCount, 483);
  assert.equal(model.holdoutSampleCount, 483);

  const contrib = featureShiftContributionsV1([2, -1], [0.1, 0.4], [0.3, 0.2]);
  assert.ok(Math.abs(contrib[0]!.shiftContribution - 0.4) < 1e-12);
  assert.ok(Math.abs(contrib[1]!.shiftContribution - 0.2) < 1e-12);
  const trainZ = meanLogitFromMeansV1(0.5, [2, -1], [0.1, 0.4]);
  const valZ = meanLogitFromMeansV1(0.5, [2, -1], [0.3, 0.2]);
  assert.ok(Math.abs(trainZ - 0.3) < 1e-12);
  assert.ok(Math.abs(valZ - 0.9) < 1e-12);
  const shiftFromMeans = valZ - trainZ;
  const shiftFromFeatures = contrib.reduce((s, r) => s + r.shiftContribution, 0);
  assert.ok(Math.abs(shiftFromMeans - shiftFromFeatures) < 1e-12);
  console.log("MEAN_CONTRIBUTION_RECONCILIATION = PASS");
  console.log("LOGIT_SHIFT_RECONCILIATION = PASS");

  assertSemanticGroupCoverageV1();
  const allNames = orderedLogisticModelFeatureNamesV1();
  const grouped = Object.values(SEMANTIC_FEATURE_GROUPS_V1).flat();
  assert.equal(grouped.length, 57);
  assert.equal(allNames.length, 57);
  assert.equal(new Set(grouped).size, 57);
  for (const name of allNames) {
    assert.equal(grouped.includes(name), true, `missing group for ${name}`);
  }
  console.log("GROUP_COVERAGE_57 = PASS");
  console.log("GROUP_OVERLAP = NONE");

  const xs = [1, 2, 3, 4, 5];
  assert.ok(Math.abs(pearsonCorrelationV1(xs, xs) - 1) < 1e-12);
  assert.ok(
    Math.abs(pearsonCorrelationV1(xs, [5, 4, 3, 2, 1]) + 1) < 1e-12,
  );
  console.log("TRAIN_CORRELATION_SANITY = PASS");

  const goodRow = join.rows.find((r) =>
    split.trainGamePks.includes(r.identity.gamePk),
  )!;
  const identityOk = auditStructuralIdentitiesV1([goodRow]);
  assert.equal(identityOk.homeGamesEqualsWinsPlusLossesViolations, 0);
  const broken = clone(goodRow);
  broken.feature.home.winsBefore += 1;
  const identityBad = auditStructuralIdentitiesV1([broken]);
  assert.equal(identityBad.homeGamesEqualsWinsPlusLossesViolations, 1);
  const last5Broken = clone(goodRow);
  if (
    last5Broken.feature.home.last5WinsBefore != null &&
    last5Broken.feature.home.last5LossesBefore != null
  ) {
    last5Broken.feature.home.last5WinsBefore += 1;
    const last5Bad = auditStructuralIdentitiesV1([last5Broken]);
    assert.equal(last5Bad.homeLast5SumViolations, 1);
  }
  console.log("STRUCTURAL_IDENTITY_AUDIT = PASS");

  assert.equal(
    classifyValidationShiftV1(
      [
        { group: "SEASON_VOLUME", absShiftContribution: 0.8 },
        { group: "MISSING_INDICATORS", absShiftContribution: 0.1 },
      ],
      0.7,
    ),
    "SEASON_VOLUME_DOMINANT",
  );
  assert.equal(
    classifyValidationShiftV1(
      [
        { group: "MISSING_INDICATORS", absShiftContribution: 0.8 },
        { group: "SEASON_VOLUME", absShiftContribution: 0.1 },
      ],
      0.7,
    ),
    "MISSINGNESS_DOMINANT",
  );
  assert.equal(
    classifyValidationShiftV1(
      [
        { group: "RECENT_FORM", absShiftContribution: 0.8 },
        { group: "SEASON_VOLUME", absShiftContribution: 0.1 },
      ],
      0.7,
    ),
    "OTHER_FEATURES_DOMINANT",
  );
  assert.equal(
    classifyValidationShiftV1(
      [
        { group: "SEASON_VOLUME", absShiftContribution: 0.3 },
        { group: "MISSING_INDICATORS", absShiftContribution: 0.3 },
        { group: "RECENT_FORM", absShiftContribution: 0.3 },
      ],
      0.5,
    ),
    "MULTI_FACTOR_SHIFT",
  );

  const pinModel = clone(model);
  pinModel.modelCoreHash = "0".repeat(64);
  assertThrowsCode(
    () =>
      diagnoseLogisticValidationShiftV1({
        join,
        split,
        model: pinModel,
        evaluation,
        sourceJoinHash: JOIN_BEFORE,
      }),
    "MODEL_CORE_HASH_PIN_MISMATCH",
    "core pin",
  );
  console.log("MODEL_CORE_HASH_PIN_MISMATCH_BLOCK = PASS");

  const pinEval = clone(evaluation);
  pinEval.modelCoreHash = "1".repeat(64);
  assertThrowsCode(
    () =>
      diagnoseLogisticValidationShiftV1({
        join,
        split,
        model,
        evaluation: pinEval,
        sourceJoinHash: JOIN_BEFORE,
      }),
    "EVALUATION_MODEL_CORE_HASH_MISMATCH",
    "eval pin",
  );
  console.log("EVALUATION_MODEL_CORE_HASH_MISMATCH_BLOCK = PASS");

  const replayEval = clone(evaluation);
  replayEval.validation[0]!.probability = Math.min(
    0.999,
    replayEval.validation[0]!.probability + 0.2,
  );
  assertThrowsCode(
    () =>
      diagnoseLogisticValidationShiftV1({
        join,
        split,
        model,
        evaluation: replayEval,
        sourceJoinHash: JOIN_BEFORE,
      }),
    "VALIDATION_PROBABILITY_REPLAY_MISMATCH",
    "val replay",
  );
  console.log("VALIDATION_PROBABILITY_REPLAY_BLOCK = PASS");

  const sealedJoin = sealHoldoutRows(join, split.holdoutGamePks);
  const official = diagnoseLogisticValidationShiftV1({
    join: sealedJoin,
    split,
    model,
    evaluation,
    sourceJoinHash: JOIN_BEFORE,
    generatedAt: "2026-09-02T00:00:00.000Z",
  });
  console.log("HOLDOUT_NOT_ACCESSED = PASS");

  const drift = official.diagnostic.featureDrift as Array<{
    featureName: string;
    coefficient: number;
  }>;
  assert.equal(drift.length, 57);
  for (let j = 0; j < 57; j += 1) {
    assert.equal(drift[j]!.coefficient, model.coefficients[j]!);
  }
  console.log("FROZEN_COEFFICIENT_USAGE = PASS");

  assert.equal(official.diagnostic.modelCoreHash, MODEL_CORE_BEFORE);
  assert.equal(official.diagnostic.logitShiftReconciliation, "PASS");
  assert.equal(official.diagnostic.trainProbabilityReplayMatch, "PASS");
  assert.equal(official.diagnostic.validationProbabilityReplayMatch, "PASS");
  assert.equal(official.diagnostic.holdoutEvaluated, false);
  assert.equal(official.diagnostic.holdoutFeatureRowsReadForDiagnostic, 0);
  assert.equal(official.diagnostic.holdoutLabelRowsReadForDiagnostic, 0);
  assert.equal(official.diagnostic.holdoutProbabilitiesCreated, 0);
  assert.equal(official.audit.trainingFunctionCalled, false);
  assert.equal(official.audit.optimizerCalled, false);
  assert.equal(official.audit.modelCoreChanged, false);

  const shuffledJoin = clone(join);
  shuffledJoin.rows = shuffle(shuffledJoin.rows);
  const shuffled = diagnoseLogisticValidationShiftV1({
    join: shuffledJoin,
    split,
    model,
    evaluation,
    sourceJoinHash: JOIN_BEFORE,
    generatedAt: "2026-09-02T00:00:00.000Z",
  });
  assert.deepEqual(shuffled.diagnostic, official.diagnostic);
  console.log("SHUFFLED_INPUT_DETERMINISTIC = PASS");

  const libFiles = ["diagnose.ts", "index.ts"];
  for (const file of libFiles) {
    const text = readFileSync(path.join(LIB_DIR, file), "utf8");
    assert.equal(text.includes("Math.random"), false);
    assert.equal(text.includes("prediction-v0"), false);
    assert.equal(text.includes("statsapi.mlb.com"), false);
    assert.equal(text.includes("fetch("), false);
    assert.equal(text.includes("independent-logistic-v1/train"), false);
    assert.equal(text.includes("fitFullBatchLogistic"), false);
    assert.equal(text.includes("trainIndependentLogistic"), false);
    assert.equal(text.includes("fitTrainPreprocessor"), false);
  }
  assert.equal(existsSync(path.join(LIB_DIR, "diagnose.ts")), true);

  assert.equal(sha256File(independentJoinArtifactPath()), joinHashBefore);
  assert.equal(sha256File(independentSplitArtifactPath()), splitHashBefore);
  assert.equal(sha256File(independentSafeAFeatureArtifactPath()), featureHashBefore);
  assert.equal(sha256File(independentLabelArtifactPath()), labelHashBefore);
  assert.equal(
    sha256File(independentSafeAHistoricalSourcePath()),
    sourceHashBefore,
  );
  assert.equal(sha256File(sealedLogisticModelPath()), modelHashBefore);
  assert.equal(sha256File(sealedLogisticEvalPath()), evalHashBefore);
  assert.equal(
    sha256File(sealedLogisticPrototypeAuditPath()),
    prototypeAuditHashBefore,
  );
  console.log("SEALED_ARTIFACTS_UNCHANGED = PASS");

  if (
    existsSync(independentLogisticDiagnosticPath()) &&
    existsSync(independentLogisticDiagnosticAuditPath())
  ) {
    const persisted = JSON.parse(
      readFileSync(independentLogisticDiagnosticPath(), "utf8"),
    );
    assert.equal(persisted.modelCoreHash, MODEL_CORE_BEFORE);
    assert.equal(persisted.holdoutEvaluated, false);
    assert.equal(persisted.logitShiftReconciliation, "PASS");
  }

  console.log(`modelCoreHash=${official.diagnostic.modelCoreHash}`);
  console.log(`trainMeanLogit=${official.diagnostic.trainMeanLogit}`);
  console.log(`validationMeanLogit=${official.diagnostic.validationMeanLogit}`);
  console.log(`logitShift=${official.diagnostic.logitShift}`);
  console.log(
    `diagnosticClassification=${official.diagnostic.diagnosticClassification}`,
  );
  console.log("HOLDOUT_EVALUATED = NO");
  console.log("test:mlb-independent-logistic-validation-diagnostic-v1 PASS");
}

main();

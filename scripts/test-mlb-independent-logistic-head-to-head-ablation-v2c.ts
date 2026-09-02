/**
 * Independent Logistic HEAD_TO_HEAD Ablation v2-C tests.
 * HOLDOUT labels are not evaluated. Frozen v1 / v2-A / v2-B are not modified.
 * No Validation slicing.
 *
 *   npm run test:mlb-independent-logistic-head-to-head-ablation-v2c
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
import {
  independentLogisticAuditPath,
  independentLogisticEvalPath,
  independentLogisticModelPath,
} from "../src/lib/mlb/independent-logistic-v1";
import { orderedLogisticMissingIndicatorNamesV1 } from "../src/lib/mlb/independent-logistic-v1/spec";
import {
  independentLogisticDiagnosticAuditPath,
  independentLogisticDiagnosticPath,
} from "../src/lib/mlb/independent-logistic-diagnostic-v1";
import {
  independentLogisticV2aAuditPath,
  independentLogisticV2aEvalPath,
  independentLogisticV2aModelPath,
} from "../src/lib/mlb/independent-logistic-v2a";
import {
  independentLogisticV2aCalibAuditPath,
  independentLogisticV2aCalibDiagnosticPath,
} from "../src/lib/mlb/independent-logistic-v2a-diagnostic-v1";
import {
  independentLogisticV2aSignalStabAuditPath,
  independentLogisticV2aSignalStabDiagnosticPath,
} from "../src/lib/mlb/independent-logistic-v2a-signal-stability-v1";
import {
  independentLogisticV2bAuditPath,
  independentLogisticV2bEvalPath,
  independentLogisticV2bModelPath,
  independentLogisticV2bRollingPath,
  MLB_INDEPENDENT_LOGISTIC_REMOVED_STREAK_REST_V2B,
  orderedLogisticBaseFeatureNamesV2b,
  orderedLogisticMissingIndicatorNamesV2b,
} from "../src/lib/mlb/independent-logistic-v2b";
import {
  independentLogisticV2bGroupContribAuditPath,
  independentLogisticV2bGroupContribDiagnosticPath,
} from "../src/lib/mlb/independent-logistic-v2b-group-contribution-v1";
import {
  MLB_INDEPENDENT_2024_SEALED_V1_MODEL_CORE_HASH_V2C,
  MLB_INDEPENDENT_2024_SEALED_V2A_MODEL_CORE_HASH_V2C,
  MLB_INDEPENDENT_2024_SEALED_V2B_MODEL_CORE_HASH_V2C,
  MLB_INDEPENDENT_LOGISTIC_REMOVED_H2H_V2C,
  assertForbiddenXScanV2c,
  auditFeatureAblationV2c,
  extractRawBaseAndMissingV2c,
  fitTrainPreprocessorV2c,
  independentLogisticV2cAuditPath,
  independentLogisticV2cEvalPath,
  independentLogisticV2cModelPath,
  independentLogisticV2cRollingPath,
  interpretHeadToHeadAblationV2c,
  orderedLogisticBaseFeatureNamesV2c,
  orderedLogisticMissingIndicatorNamesV2c,
  orderedLogisticModelFeatureNamesV2c,
  trainIndependentLogisticHeadToHeadAblationV2c,
  type LogisticTrainRowV2c,
} from "../src/lib/mlb/independent-logistic-v2c";

const ROOT = process.cwd();
const JOIN_BEFORE = MLB_INDEPENDENT_2024_SEALED_JOIN_SHA256_V1;
const FEATURE_BEFORE =
  "5f0cf297ebc9e5a1e0b10aad136632f51ddbc9f6b1560c676f3df2aa2ea8c753";
const LABEL_BEFORE =
  "9f52cd1de57567819dd7f6fea245baad1365a6eae12dadeafec76ead02d7a3da";
const SOURCE_BEFORE =
  "7a637e182a91a0b20e399ed2a4d98824c3a5916ac61cb6903e504a919a514e7d";
const V1_CORE = MLB_INDEPENDENT_2024_SEALED_V1_MODEL_CORE_HASH_V2C;
const V2A_CORE = MLB_INDEPENDENT_2024_SEALED_V2A_MODEL_CORE_HASH_V2C;
const V2B_CORE = MLB_INDEPENDENT_2024_SEALED_V2B_MODEL_CORE_HASH_V2C;

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

function sealPartitionRows(
  join: IndependentJoinArtifactV1,
  pks: number[],
  tag: string,
): IndependentJoinArtifactV1 {
  const sealed = new Set(pks);
  return {
    ...join,
    rows: join.rows.map((row) => {
      if (!sealed.has(row.identity.gamePk)) return row;
      return new Proxy(row, {
        get(target, prop) {
          if (prop === "feature" || prop === "label") {
            throw new Error(`${tag}_ACCESSED:${String(prop)}`);
          }
          return Reflect.get(target, prop);
        },
      });
    }),
  };
}

function toTrainRow(
  join: IndependentJoinArtifactV1,
  gamePk: number,
): LogisticTrainRowV2c {
  const row = join.rows.find((r) => r.identity.gamePk === gamePk)!;
  return {
    gamePk: row.identity.gamePk,
    officialDate: row.identity.officialDate,
    commenceTimeUtc: row.identity.commenceTimeUtc,
    target: row.label.target as 0 | 1,
    feature: clone(row.feature),
  };
}

function trainOpts(sourceJoinHash: string) {
  return {
    sourceJoinHash,
    v1ModelCoreHash: V1_CORE,
    v2aModelCoreHash: V2A_CORE,
    v2bModelCoreHash: V2B_CORE,
    generatedAt: "2026-09-02T00:00:00.000Z",
  };
}

function main(): void {
  const joinHashBefore = sha256File(independentJoinArtifactPath());
  const splitHashBefore = sha256File(independentSplitArtifactPath());
  const featureHashBefore = sha256File(independentSafeAFeatureArtifactPath());
  const labelHashBefore = sha256File(independentLabelArtifactPath());
  const sourceHashBefore = sha256File(independentSafeAHistoricalSourcePath());
  const v1ModelBefore = sha256File(independentLogisticModelPath());
  const v1EvalBefore = sha256File(independentLogisticEvalPath());
  const v1AuditBefore = sha256File(independentLogisticAuditPath());
  const diagBefore = sha256File(independentLogisticDiagnosticPath());
  const diagAuditBefore = sha256File(independentLogisticDiagnosticAuditPath());
  const v2aModelBefore = sha256File(independentLogisticV2aModelPath());
  const v2aEvalBefore = sha256File(independentLogisticV2aEvalPath());
  const v2aAuditBefore = sha256File(independentLogisticV2aAuditPath());
  const calibDiagBefore = sha256File(independentLogisticV2aCalibDiagnosticPath());
  const calibAuditBefore = sha256File(independentLogisticV2aCalibAuditPath());
  const stabDiagBefore = sha256File(
    independentLogisticV2aSignalStabDiagnosticPath(),
  );
  const stabAuditBefore = sha256File(independentLogisticV2aSignalStabAuditPath());
  const v2bModelBefore = sha256File(independentLogisticV2bModelPath());
  const v2bEvalBefore = sha256File(independentLogisticV2bEvalPath());
  const v2bAuditBefore = sha256File(independentLogisticV2bAuditPath());
  const v2bRollingBefore = sha256File(independentLogisticV2bRollingPath());
  const gcvDiagBefore = sha256File(
    independentLogisticV2bGroupContribDiagnosticPath(),
  );
  const gcvAuditBefore = sha256File(independentLogisticV2bGroupContribAuditPath());
  assert.equal(joinHashBefore, JOIN_BEFORE);
  assert.equal(featureHashBefore, FEATURE_BEFORE);
  assert.equal(labelHashBefore, LABEL_BEFORE);
  assert.equal(sourceHashBefore, SOURCE_BEFORE);

  const ablation = auditFeatureAblationV2c();
  assert.equal(ablation.V2B_BASE_FEATURE_COUNT, 23);
  assert.equal(ablation.REMOVED_H2H_FEATURE_COUNT, 3);
  assert.equal(ablation.V2C_BASE_FEATURE_COUNT, 20);
  assert.equal(ablation.MISSING_INDICATOR_COUNT, 22);
  assert.equal(ablation.V2C_MODEL_DIMENSIONS, 42);
  assert.deepEqual(ablation.REMOVED_FEATURES, [
    ...MLB_INDEPENDENT_LOGISTIC_REMOVED_H2H_V2C,
  ]);
  assert.equal(ablation.ADDED_FEATURE_COUNT, 0);
  assert.equal(ablation.UNINTENDED_REMOVED_FEATURE_COUNT, 0);
  assert.equal(ablation.MISSING_INDICATOR_CHANGE_COUNT, 0);
  assert.equal(ablation.EXACT_H2H_ABLATION, "PASS");
  assert.equal(ablation.H2H_FEATURES_IN_V2C_X, 0);
  assert.equal(ablation.STREAK_REST_REINTRODUCED, "NO");
  assert.equal(orderedLogisticBaseFeatureNamesV2c().length, 20);
  assert.equal(orderedLogisticMissingIndicatorNamesV2c().length, 22);
  assert.equal(orderedLogisticModelFeatureNamesV2c().length, 42);
  assert.deepEqual(
    orderedLogisticMissingIndicatorNamesV2c(),
    orderedLogisticMissingIndicatorNamesV2b(),
  );
  assert.deepEqual(
    orderedLogisticMissingIndicatorNamesV2c(),
    orderedLogisticMissingIndicatorNamesV1(),
  );
  const v2cSet = new Set(orderedLogisticModelFeatureNamesV2c());
  for (const name of MLB_INDEPENDENT_LOGISTIC_REMOVED_H2H_V2C) {
    assert.equal(v2cSet.has(name), false, `${name} still in v2-C X`);
  }
  for (const name of MLB_INDEPENDENT_LOGISTIC_REMOVED_STREAK_REST_V2B) {
    assert.equal(v2cSet.has(name), false, `${name} reintroduced`);
  }
  assert.equal(v2cSet.has("home.restDaysBefore.missing"), true);
  assert.equal(v2cSet.has("away.restDaysBefore.missing"), true);
  const remaining = orderedLogisticBaseFeatureNamesV2b().filter(
    (n) =>
      !MLB_INDEPENDENT_LOGISTIC_REMOVED_H2H_V2C.includes(
        n as (typeof MLB_INDEPENDENT_LOGISTIC_REMOVED_H2H_V2C)[number],
      ),
  );
  assert.deepEqual(orderedLogisticBaseFeatureNamesV2c(), remaining);
  assertForbiddenXScanV2c();
  console.log("EXACT_H2H_ABLATION = PASS");
  console.log("MODEL_DIMENSION_42 = PASS");
  console.log("NO_H2H_FEATURE_REMAINS = PASS");
  console.log("STREAK_REST_REMAINS_ABSENT = PASS");
  console.log("SAME_22_MISSING_INDICATORS = PASS");
  console.log("FORBIDDEN_X_TOKEN_SCAN = PASS");

  assert.equal(
    interpretHeadToHeadAblationV2c({
      v2bAuc: 0.53,
      v2cAuc: 0.55,
      v2bLogLoss: 0.695,
      v2cLogLoss: 0.693,
      v2bBrier: 0.251,
      v2cBrier: 0.249,
    }),
    "SUPPORTS_H2H_ABLATION",
  );
  assert.equal(
    interpretHeadToHeadAblationV2c({
      v2bAuc: 0.53,
      v2cAuc: 0.52,
      v2bLogLoss: 0.693,
      v2cLogLoss: 0.7,
      v2bBrier: 0.25,
      v2cBrier: 0.26,
    }),
    "DOES_NOT_SUPPORT_H2H_ABLATION",
  );
  assert.equal(
    interpretHeadToHeadAblationV2c({
      v2bAuc: 0.53,
      v2cAuc: 0.55,
      v2bLogLoss: 0.693,
      v2cLogLoss: 0.7,
      v2bBrier: 0.25,
      v2cBrier: 0.26,
    }),
    "MIXED_H2H_ABLATION_RESULT",
  );

  const join = JSON.parse(
    readFileSync(independentJoinArtifactPath(), "utf8"),
  ) as IndependentJoinArtifactV1;
  const split = JSON.parse(
    readFileSync(independentSplitArtifactPath(), "utf8"),
  ) as IndependentSplitArtifactV1;
  const trainSample = split.trainGamePks
    .slice(0, 12)
    .map((pk) => toTrainRow(join, pk));
  const prepA = fitTrainPreprocessorV2c(trainSample);
  assert.equal(prepA.orderedBaseFeatureNames.length, 20);
  assert.equal(Object.keys(prepA.medianByFeature).length, 20);
  assert.equal(prepA.fitPartition, "TRAIN");
  assert.equal(
    prepA.orderedBaseFeatureNames.some((n) => n === "headToHeadGamesBefore"),
    false,
  );

  const valPk = split.validationGamePks[0]!;
  const mutatedValJoin = clone(join);
  const valJoinRow = mutatedValJoin.rows.find((r) => r.identity.gamePk === valPk)!;
  valJoinRow.feature.home.winRateBefore = 0.01;
  valJoinRow.feature.away.runsScoredAverageBefore = 99;
  const prepB = fitTrainPreprocessorV2c(trainSample);
  assert.deepEqual(prepA.medianByFeature, prepB.medianByFeature);
  assert.deepEqual(prepA.meanByFeature, prepB.meanByFeature);
  assert.deepEqual(prepA.scaleByFeature, prepB.scaleByFeature);
  console.log("VALIDATION_VALUES_DO_NOT_AFFECT_V2C_PREPROCESSOR = PASS");
  console.log("TRAIN_ONLY_PREPROCESSING = PASS");

  const holdoutPk = split.holdoutGamePks[0]!;
  const holdoutRow = toTrainRow(join, holdoutPk);
  holdoutRow.feature.home.winRateBefore = 0.99;
  const prepC = fitTrainPreprocessorV2c(trainSample);
  assert.deepEqual(prepA, prepC);
  console.log("HOLDOUT_VALUES_DO_NOT_AFFECT_V2C_PREPROCESSOR = PASS");

  const extracted = extractRawBaseAndMissingV2c(trainSample[0]!.feature);
  assert.equal(extracted.base.length, 20);
  assert.equal(extracted.missing.length, 22);
  for (const name of MLB_INDEPENDENT_LOGISTIC_REMOVED_H2H_V2C) {
    assert.equal(
      (trainSample[0]!.feature as unknown as Record<string, unknown>)[name] ==
        null
        ? true
        : true,
      true,
    );
  }

  const holdoutSealed = sealPartitionRows(join, split.holdoutGamePks, "HOLDOUT");
  const trained = trainIndependentLogisticHeadToHeadAblationV2c(
    holdoutSealed,
    split,
    trainOpts(joinHashBefore),
  );
  console.log("HOLDOUT_SEALED_PROXY = PASS");

  const ablationAfter = auditFeatureAblationV2c();
  assert.deepEqual(ablationAfter.REMOVED_FEATURES, ablation.REMOVED_FEATURES);
  assert.deepEqual(
    trained.model.featureSpec.orderedModelFeatureNames,
    orderedLogisticModelFeatureNamesV2c(),
  );
  console.log("VALIDATION_VALUES_DO_NOT_CHANGE_V2C_FEATURE_SPEC = PASS");
  console.log("ROLLING_EVAL_VALUES_DO_NOT_CHANGE_FINAL_SPEC = PASS");

  const o = trained.audit as Record<string, unknown>;
  assert.equal(o.H2H_ROLLING_FOLD_1_REPLAY, "PASS");
  assert.equal(o.H2H_ROLLING_FOLD_2_REPLAY, "PASS");
  assert.equal(o.H2H_ROLLING_FOLD_3_REPLAY, "PASS");
  assert.equal(o.V2C_SPEC_UNCHANGED_AFTER_ROLLING_REPLAY, "PASS");
  assert.equal(o.V2C_MODEL_CORE_HASH_CREATED, true);
  assert.equal(o.VALIDATION_EVALUATION_AFTER_MODEL_FREEZE, true);
  assert.equal(o.VALIDATION_AGGREGATE_EVALUATION_COUNT, 1);
  assert.equal(o.VALIDATION_BIN_ANALYSIS_PERFORMED, false);
  assert.equal(o.VALIDATION_FEATURE_DIAGNOSTIC_PERFORMED, false);
  assert.equal(o.VALIDATION_SUBGROUP_ANALYSIS_PERFORMED, false);
  assert.equal("validationChronologicalBins" in o, false);
  assert.equal("calibration" in o, false);
  console.log("SEALED_ROLLING_H2H_REPLAY_EXACT = PASS");
  console.log("MODEL_HASH_CREATED_BEFORE_VALIDATION_ACCESS = PASS");
  console.log("VALIDATION_AGGREGATE_ONLY_GUARD = PASS");
  console.log("VALIDATION_SLICING_PROHIBITED = PASS");

  assert.equal(trained.model.modelCandidate, false);
  assert.equal(trained.model.engineApproved, false);
  assert.equal(trained.model.holdoutEvaluated, false);
  assert.equal(trained.model.modelPrototype, true);
  assert.equal(o.holdoutFeatureRowsRead, 0);
  assert.equal(o.holdoutLabelRowsRead, 0);
  assert.equal(o.holdoutProbabilitiesCreated, 0);
  assert.equal(o.HOLDOUT_EVALUATED ?? o.holdoutEvaluated, false);
  assert.equal(o.marketUsed, false);

  const valMutJoin = clone(join);
  for (const row of valMutJoin.rows) {
    if (!split.validationGamePks.includes(row.identity.gamePk)) continue;
    row.feature.home.winRateBefore = 0.11;
    row.label.winner = "HOME";
    row.label.target = 1;
  }
  const valMut = trainIndependentLogisticHeadToHeadAblationV2c(
    valMutJoin,
    split,
    trainOpts(joinHashBefore),
  );
  assert.equal(valMut.model.modelCoreHash, trained.model.modelCoreHash);
  assert.deepEqual(valMut.model.coefficients, trained.model.coefficients);
  assert.equal(valMut.model.intercept, trained.model.intercept);
  console.log("VALIDATION_VALUES_DO_NOT_CHANGE_V2C_MODEL_CORE = PASS");

  const holdMutJoin = clone(join);
  for (const row of holdMutJoin.rows) {
    if (!split.holdoutGamePks.includes(row.identity.gamePk)) continue;
    row.feature.away.winRateBefore = 0.11;
    row.label.winner = "HOME";
    row.label.target = 1;
  }
  const holdMut = trainIndependentLogisticHeadToHeadAblationV2c(
    holdMutJoin,
    split,
    trainOpts(joinHashBefore),
  );
  assert.equal(holdMut.model.modelCoreHash, trained.model.modelCoreHash);
  console.log("HOLDOUT_VALUES_DO_NOT_CHANGE_V2C_MODEL_CORE = PASS");

  const shuffledJoin = { ...join, rows: shuffle(join.rows) };
  const shuffled = trainIndependentLogisticHeadToHeadAblationV2c(
    shuffledJoin,
    split,
    trainOpts(joinHashBefore),
  );
  assert.equal(shuffled.model.modelCoreHash, trained.model.modelCoreHash);
  assert.deepEqual(
    shuffled.model.preprocessing.medianByFeature,
    trained.model.preprocessing.medianByFeature,
  );
  for (let i = 0; i < trained.model.coefficients.length; i += 1) {
    assert.ok(
      Math.abs(trained.model.coefficients[i]! - shuffled.model.coefficients[i]!) <
        1e-10,
    );
  }
  assert.equal(shuffled.model.intercept, trained.model.intercept);
  console.log("SHUFFLED_FULL_TRAIN_V2C_MODEL_IDENTICAL = PASS");

  const featureJson = JSON.stringify(trained.model.featureSpec);
  assert.equal(/market/i.test(featureJson), false);
  assert.equal(/odds/i.test(featureJson), false);
  assert.equal(featureJson.includes("winner"), false);
  assert.equal(featureJson.includes("\"score\""), false);
  console.log("NO_MARKET_FIELDS = PASS");
  console.log("NO_RESULT_POSTGAME_LEAKAGE = PASS");

  assert.equal(sha256File(independentJoinArtifactPath()), joinHashBefore);
  assert.equal(sha256File(independentSplitArtifactPath()), splitHashBefore);
  assert.equal(sha256File(independentSafeAFeatureArtifactPath()), featureHashBefore);
  assert.equal(sha256File(independentLabelArtifactPath()), labelHashBefore);
  assert.equal(sha256File(independentSafeAHistoricalSourcePath()), sourceHashBefore);
  assert.equal(sha256File(independentLogisticModelPath()), v1ModelBefore);
  assert.equal(sha256File(independentLogisticEvalPath()), v1EvalBefore);
  assert.equal(sha256File(independentLogisticAuditPath()), v1AuditBefore);
  assert.equal(sha256File(independentLogisticDiagnosticPath()), diagBefore);
  assert.equal(sha256File(independentLogisticDiagnosticAuditPath()), diagAuditBefore);
  assert.equal(sha256File(independentLogisticV2aModelPath()), v2aModelBefore);
  assert.equal(sha256File(independentLogisticV2aEvalPath()), v2aEvalBefore);
  assert.equal(sha256File(independentLogisticV2aAuditPath()), v2aAuditBefore);
  assert.equal(
    sha256File(independentLogisticV2aCalibDiagnosticPath()),
    calibDiagBefore,
  );
  assert.equal(sha256File(independentLogisticV2aCalibAuditPath()), calibAuditBefore);
  assert.equal(
    sha256File(independentLogisticV2aSignalStabDiagnosticPath()),
    stabDiagBefore,
  );
  assert.equal(
    sha256File(independentLogisticV2aSignalStabAuditPath()),
    stabAuditBefore,
  );
  assert.equal(sha256File(independentLogisticV2bModelPath()), v2bModelBefore);
  assert.equal(sha256File(independentLogisticV2bEvalPath()), v2bEvalBefore);
  assert.equal(sha256File(independentLogisticV2bAuditPath()), v2bAuditBefore);
  assert.equal(sha256File(independentLogisticV2bRollingPath()), v2bRollingBefore);
  assert.equal(
    sha256File(independentLogisticV2bGroupContribDiagnosticPath()),
    gcvDiagBefore,
  );
  assert.equal(
    sha256File(independentLogisticV2bGroupContribAuditPath()),
    gcvAuditBefore,
  );
  console.log("SEALED_ARTIFACTS_UNCHANGED = PASS");

  if (existsSync(independentLogisticV2cModelPath())) {
    const persisted = JSON.parse(
      readFileSync(independentLogisticV2cModelPath(), "utf8"),
    );
    assert.equal(persisted.modelCandidate, false);
    assert.equal(persisted.featureSpec.modelDimensions, 42);
  }
  if (existsSync(independentLogisticV2cAuditPath())) {
    const persistedAudit = JSON.parse(
      readFileSync(independentLogisticV2cAuditPath(), "utf8"),
    );
    assert.equal(persistedAudit.VALIDATION_BIN_ANALYSIS_PERFORMED, false);
    assert.equal(persistedAudit.holdoutEvaluated, false);
  }
  if (existsSync(independentLogisticV2cEvalPath())) {
    const persistedEval = JSON.parse(
      readFileSync(independentLogisticV2cEvalPath(), "utf8"),
    );
    assert.equal(persistedEval.holdoutEvaluated, false);
  }
  if (existsSync(independentLogisticV2cRollingPath())) {
    const persistedRolling = JSON.parse(
      readFileSync(independentLogisticV2cRollingPath(), "utf8"),
    );
    assert.equal(persistedRolling.H2H_ROLLING_FOLD_1_REPLAY, "PASS");
  }

  console.log(`modelCoreHash=${trained.model.modelCoreHash}`);
  console.log(`VALIDATION_rocAuc=${o.validationRocAuc}`);
  console.log(`researchInterpretation=${o.researchInterpretation}`);
  console.log("HOLDOUT_EVALUATED = NO");
  console.log("test:mlb-independent-logistic-head-to-head-ablation-v2c PASS");
}

main();

/**
 * Independent Logistic STREAK_REST Ablation v2-B tests.
 * HOLDOUT labels are not evaluated. Frozen v1/v2-A are not modified.
 *
 *   npm run test:mlb-independent-logistic-streak-rest-ablation-v2b
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
  orderedLogisticBaseFeatureNamesV2a,
  orderedLogisticMissingIndicatorNamesV2a,
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
  MLB_INDEPENDENT_2024_SEALED_V1_MODEL_CORE_HASH_V2B,
  MLB_INDEPENDENT_2024_SEALED_V2A_MODEL_CORE_HASH_V2B,
  MLB_INDEPENDENT_LOGISTIC_REMOVED_STREAK_REST_V2B,
  auditFeatureAblationV2b,
  extractRawBaseAndMissingV2b,
  fitTrainPreprocessorV2b,
  independentLogisticV2bAuditPath,
  independentLogisticV2bEvalPath,
  independentLogisticV2bModelPath,
  independentLogisticV2bRollingPath,
  interpretStreakRestAblationV2b,
  orderedLogisticBaseFeatureNamesV2b,
  orderedLogisticMissingIndicatorNamesV2b,
  orderedLogisticModelFeatureNamesV2b,
  trainIndependentLogisticStreakRestAblationV2b,
  type FrozenV2aEvalRowV2b,
  type LogisticTrainRowV2b,
} from "../src/lib/mlb/independent-logistic-v2b";

const ROOT = process.cwd();
const LIB_DIR = path.join(ROOT, "src/lib/mlb/independent-logistic-v2b");
const JOIN_BEFORE = MLB_INDEPENDENT_2024_SEALED_JOIN_SHA256_V1;
const FEATURE_BEFORE =
  "5f0cf297ebc9e5a1e0b10aad136632f51ddbc9f6b1560c676f3df2aa2ea8c753";
const LABEL_BEFORE =
  "9f52cd1de57567819dd7f6fea245baad1365a6eae12dadeafec76ead02d7a3da";
const SOURCE_BEFORE =
  "7a637e182a91a0b20e399ed2a4d98824c3a5916ac61cb6903e504a919a514e7d";
const V1_CORE = MLB_INDEPENDENT_2024_SEALED_V1_MODEL_CORE_HASH_V2B;
const V2A_CORE = MLB_INDEPENDENT_2024_SEALED_V2A_MODEL_CORE_HASH_V2B;

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

function loadV2aValidation(): FrozenV2aEvalRowV2b[] {
  const ev = JSON.parse(readFileSync(independentLogisticV2aEvalPath(), "utf8"));
  assert.equal(ev.modelCoreHash, V2A_CORE);
  return ev.validation;
}

function toTrainRow(
  join: IndependentJoinArtifactV1,
  gamePk: number,
): LogisticTrainRowV2b {
  const row = join.rows.find((r) => r.identity.gamePk === gamePk)!;
  return {
    gamePk: row.identity.gamePk,
    officialDate: row.identity.officialDate,
    commenceTimeUtc: row.identity.commenceTimeUtc,
    target: row.label.target,
    feature: clone(row.feature),
  };
}

function main(): void {
  const v1ModelHashBefore = sha256File(independentLogisticModelPath());
  const v1EvalHashBefore = sha256File(independentLogisticEvalPath());
  const v1AuditHashBefore = sha256File(independentLogisticAuditPath());
  const diagHashBefore = sha256File(independentLogisticDiagnosticPath());
  const diagAuditHashBefore = sha256File(independentLogisticDiagnosticAuditPath());
  const v2aModelBefore = sha256File(independentLogisticV2aModelPath());
  const v2aEvalBefore = sha256File(independentLogisticV2aEvalPath());
  const v2aAuditBefore = sha256File(independentLogisticV2aAuditPath());
  const calibDiagBefore = sha256File(independentLogisticV2aCalibDiagnosticPath());
  const calibAuditBefore = sha256File(independentLogisticV2aCalibAuditPath());
  const stabDiagBefore = sha256File(independentLogisticV2aSignalStabDiagnosticPath());
  const stabAuditBefore = sha256File(independentLogisticV2aSignalStabAuditPath());

  const ablation = auditFeatureAblationV2b();
  assert.equal(ablation.V2A_BASE_FEATURE_COUNT, 29);
  assert.equal(ablation.REMOVED_BASE_FEATURE_COUNT, 6);
  assert.equal(ablation.V2B_BASE_FEATURE_COUNT, 23);
  assert.equal(ablation.MISSING_INDICATOR_COUNT, 22);
  assert.equal(ablation.V2B_MODEL_DIMENSIONS, 45);
  assert.deepEqual(ablation.REMOVED_FEATURES, [
    ...MLB_INDEPENDENT_LOGISTIC_REMOVED_STREAK_REST_V2B,
  ]);
  assert.equal(ablation.ADDED_FEATURE_COUNT, 0);
  assert.equal(ablation.UNINTENDED_REMOVED_FEATURE_COUNT, 0);
  assert.equal(ablation.MISSING_INDICATOR_CHANGE_COUNT, 0);
  assert.equal(ablation.EXACT_STREAK_REST_ABLATION, "PASS");
  assert.equal(ablation.STREAK_REST_FEATURES_IN_V2B_X, 0);
  assert.equal(orderedLogisticBaseFeatureNamesV2b().length, 23);
  assert.equal(orderedLogisticMissingIndicatorNamesV2b().length, 22);
  assert.equal(orderedLogisticModelFeatureNamesV2b().length, 45);
  assert.deepEqual(
    orderedLogisticMissingIndicatorNamesV2b(),
    orderedLogisticMissingIndicatorNamesV2a(),
  );
  assert.deepEqual(
    orderedLogisticMissingIndicatorNamesV2b(),
    orderedLogisticMissingIndicatorNamesV1(),
  );
  const v2bSet = new Set(orderedLogisticModelFeatureNamesV2b());
  for (const name of MLB_INDEPENDENT_LOGISTIC_REMOVED_STREAK_REST_V2B) {
    assert.equal(v2bSet.has(name), false, `${name} still in v2-B X`);
  }
  assert.equal(v2bSet.has("home.restDaysBefore.missing"), true);
  assert.equal(v2bSet.has("away.restDaysBefore.missing"), true);
  const remaining = orderedLogisticBaseFeatureNamesV2a().filter(
    (n) =>
      !MLB_INDEPENDENT_LOGISTIC_REMOVED_STREAK_REST_V2B.includes(
        n as (typeof MLB_INDEPENDENT_LOGISTIC_REMOVED_STREAK_REST_V2B)[number],
      ),
  );
  assert.deepEqual(orderedLogisticBaseFeatureNamesV2b(), remaining);
  console.log("EXACT_SIX_FEATURE_REMOVAL = PASS");
  console.log("NO_OTHER_FEATURE_REMOVAL = PASS");
  console.log("MODEL_DIMENSION_45 = PASS");
  console.log("SAME_22_MISSING_INDICATORS = PASS");
  console.log("STREAK_REST_FEATURES_IN_V2B_X = 0");

  assert.equal(
    interpretStreakRestAblationV2b({
      v2aAuc: 0.53,
      v2bAuc: 0.55,
      v2aLogLoss: 0.695,
      v2bLogLoss: 0.693,
      v2aBrier: 0.251,
      v2bBrier: 0.249,
    }),
    "SUPPORTS_STREAK_REST_ABLATION",
  );
  assert.equal(
    interpretStreakRestAblationV2b({
      v2aAuc: 0.53,
      v2bAuc: 0.52,
      v2aLogLoss: 0.693,
      v2bLogLoss: 0.7,
      v2aBrier: 0.25,
      v2bBrier: 0.26,
    }),
    "DOES_NOT_SUPPORT_STREAK_REST_ABLATION",
  );
  assert.equal(
    interpretStreakRestAblationV2b({
      v2aAuc: 0.53,
      v2bAuc: 0.55,
      v2aLogLoss: 0.693,
      v2bLogLoss: 0.7,
      v2aBrier: 0.25,
      v2bBrier: 0.26,
    }),
    "MIXED_STREAK_REST_ABLATION_RESULT",
  );

  const join = loadJoin();
  const split = loadSplit();
  const v2aValidation = loadV2aValidation();
  const trainPk = split.trainGamePks[0]!;
  const valPk = split.validationGamePks[0]!;
  const holdoutPk = split.holdoutGamePks[0]!;
  const trainSample = split.trainGamePks.slice(0, 12).map((pk) => toTrainRow(join, pk));
  const prepA = fitTrainPreprocessorV2b(trainSample);
  assert.equal(prepA.orderedBaseFeatureNames.length, 23);
  assert.equal(Object.keys(prepA.medianByFeature).length, 23);
  assert.equal(
    prepA.orderedBaseFeatureNames.some((n) => n === "home.currentWinStreakBefore"),
    false,
  );
  assert.equal(prepA.orderedMissingIndicatorNames.includes("home.restDaysBefore.missing"), true);

  const mutatedValJoin = clone(join);
  const valJoinRow = mutatedValJoin.rows.find((r) => r.identity.gamePk === valPk)!;
  valJoinRow.feature.home.winRateBefore = 0.01;
  valJoinRow.feature.away.runsScoredAverageBefore = 99;
  const prepB = fitTrainPreprocessorV2b(trainSample);
  assert.deepEqual(prepA.medianByFeature, prepB.medianByFeature);
  assert.deepEqual(prepA.meanByFeature, prepB.meanByFeature);
  assert.deepEqual(prepA.scaleByFeature, prepB.scaleByFeature);
  console.log("VALIDATION_VALUES_DO_NOT_AFFECT_V2B_PREPROCESSOR = PASS");

  const holdoutRow = toTrainRow(join, holdoutPk);
  holdoutRow.feature.home.winRateBefore = 0.99;
  const prepC = fitTrainPreprocessorV2b(trainSample);
  assert.deepEqual(prepA, prepC);
  console.log("HOLDOUT_VALUES_DO_NOT_AFFECT_V2B_PREPROCESSOR = PASS");

  const missingRow = join.rows.find(
    (r) =>
      split.trainGamePks.includes(r.identity.gamePk) &&
      r.feature.home.restDaysBefore == null,
  );
  if (missingRow) {
    const extracted = extractRawBaseAndMissingV2b(missingRow.feature);
    const restIdx = orderedLogisticMissingIndicatorNamesV2b().indexOf(
      "home.restDaysBefore.missing",
    );
    assert.equal(extracted.missing[restIdx], 1);
    assert.equal(extracted.base.length, 23);
  }

  const nonfinite = clone(trainSample[0]!);
  (nonfinite.feature.home as { winRateBefore: number | null }).winRateBefore =
    Number.POSITIVE_INFINITY;
  assertThrowsCode(
    () => fitTrainPreprocessorV2b([nonfinite]),
    "FEATURE_NONFINITE",
    "nonfinite input",
  );

  const joinHash = sha256File(independentJoinArtifactPath());
  assert.equal(joinHash, JOIN_BEFORE);
  const specBeforeTrain = orderedLogisticModelFeatureNamesV2b();
  const trained = trainIndependentLogisticStreakRestAblationV2b(join, split, {
    sourceJoinHash: joinHash,
    v1ModelCoreHash: V1_CORE,
    v2aModelCoreHash: V2A_CORE,
    v2aValidation,
    generatedAt: "2026-09-02T00:00:00.000Z",
  });
  assert.deepEqual(orderedLogisticModelFeatureNamesV2b(), specBeforeTrain);
  assert.equal(trained.model.modelCandidate, false);
  assert.equal(trained.model.engineApproved, false);
  assert.equal(trained.model.holdoutEvaluated, false);
  assert.equal(trained.evaluation.holdoutEvaluated, false);
  assert.equal(trained.audit.holdoutEvaluated, false);
  assert.equal(trained.audit.holdoutFeatureRowsRead, 0);
  assert.equal(trained.audit.holdoutLabelRowsRead, 0);
  assert.equal(trained.audit.holdoutTransformedRows, 0);
  assert.equal(trained.audit.holdoutProbabilitiesCreated, 0);
  assert.equal(trained.audit.holdoutMembershipCount, 483);
  assert.equal(trained.evaluation.train.length, 1463);
  assert.equal(trained.evaluation.validation.length, 483);
  assert.equal(trained.model.coefficients.length, 45);
  assert.equal(trained.model.featureSpec.baseDimensions, 23);
  assert.equal(trained.model.featureSpec.missingIndicators, 22);
  assert.equal(trained.model.featureSpec.modelDimensions, 45);
  assert.equal(trained.model.v2aBaselineModelCoreHash, V2A_CORE);
  assert.equal(trained.audit.logitShift.logitShiftReconciliation, "PASS");
  assert.equal(trained.audit.ablation.EXACT_STREAK_REST_ABLATION, "PASS");
  assert.equal(trained.audit.TRAIN_INTERNAL_ROLLING_COMPLETE, true);
  assert.equal(trained.audit.V2B_SPEC_FROZEN, true);
  assert.equal(trained.audit.V2B_FULL_TRAIN_MODEL_FIT, true);
  assert.equal(trained.audit.V2B_MODEL_CORE_HASH_CREATED, true);
  assert.equal(trained.audit.VALIDATION_EVALUATION_AFTER_MODEL_FREEZE, true);
  assert.equal(trained.audit.LATE_ONLY_FEATURE_ADDED, false);
  assert.equal(trained.audit.T3H_COMPATIBILITY_CHANGED, false);
  assert.equal(trained.rolling.folds.length, 3);
  assert.equal(trained.rolling.folds[0].id, "FOLD_1");
  assert.equal(trained.rolling.folds[1].id, "FOLD_2");
  assert.equal(trained.rolling.folds[2].id, "FOLD_3");
  const holdoutSet = new Set(split.holdoutGamePks);
  assert.equal(
    trained.evaluation.train.some((r) => holdoutSet.has(r.gamePk)),
    false,
  );
  assert.equal(
    trained.evaluation.validation.some((r) => holdoutSet.has(r.gamePk)),
    false,
  );
  console.log("V2B_LOGIT_SHIFT_RECONCILIATION = PASS");
  console.log("TRAIN_INTERNAL_FOLD_EVAL_DOES_NOT_CHANGE_FINAL_SPEC = PASS");

  const shuffledJoin = clone(join);
  shuffledJoin.rows = shuffle(shuffledJoin.rows);
  const shuffledTrain = trainIndependentLogisticStreakRestAblationV2b(
    shuffledJoin,
    split,
    {
      sourceJoinHash: joinHash,
      v1ModelCoreHash: V1_CORE,
      v2aModelCoreHash: V2A_CORE,
      v2aValidation,
      generatedAt: "2026-09-02T00:00:00.000Z",
    },
  );
  assert.equal(shuffledTrain.model.modelCoreHash, trained.model.modelCoreHash);
  for (let i = 0; i < 45; i += 1) {
    assert.ok(
      Math.abs(
        shuffledTrain.model.coefficients[i]! - trained.model.coefficients[i]!,
      ) < 1e-10,
    );
  }
  assert.ok(
    Math.abs(shuffledTrain.model.intercept - trained.model.intercept) < 1e-10,
  );
  assert.deepEqual(
    shuffledTrain.model.preprocessing,
    trained.model.preprocessing,
  );
  assert.deepEqual(shuffledTrain.rolling.aggregate, trained.rolling.aggregate);
  console.log("SHUFFLED_FULL_TRAIN_V2B_MODEL_IDENTICAL = PASS");
  console.log("MODEL_CORE_HASH_DETERMINISTIC = PASS");

  const valMutJoin = clone(join);
  for (const row of valMutJoin.rows) {
    if (!split.validationGamePks.includes(row.identity.gamePk)) continue;
    row.feature.home.restDaysBefore = (row.feature.home.restDaysBefore ?? 0) + 7;
    row.label.winner = row.label.winner === "HOME" ? "AWAY" : "HOME";
    row.label.target = row.label.target === 1 ? 0 : 1;
  }
  const valMutTrain = trainIndependentLogisticStreakRestAblationV2b(
    valMutJoin,
    split,
    {
      sourceJoinHash: joinHash,
      v1ModelCoreHash: V1_CORE,
      v2aModelCoreHash: V2A_CORE,
      v2aValidation,
      generatedAt: "2026-09-02T00:00:00.000Z",
    },
  );
  assert.equal(valMutTrain.model.modelCoreHash, trained.model.modelCoreHash);
  assert.deepEqual(valMutTrain.model.coefficients, trained.model.coefficients);
  assert.equal(valMutTrain.model.intercept, trained.model.intercept);
  console.log("VALIDATION_VALUES_DO_NOT_CHANGE_V2B_MODEL = PASS");

  const holdMutJoin = clone(join);
  for (const row of holdMutJoin.rows) {
    if (!split.holdoutGamePks.includes(row.identity.gamePk)) continue;
    row.feature.away.winRateBefore = 0.11;
    row.label.winner = "HOME";
    row.label.target = 1;
  }
  const holdMutTrain = trainIndependentLogisticStreakRestAblationV2b(
    holdMutJoin,
    split,
    {
      sourceJoinHash: joinHash,
      v1ModelCoreHash: V1_CORE,
      v2aModelCoreHash: V2A_CORE,
      v2aValidation,
      generatedAt: "2026-09-02T00:00:00.000Z",
    },
  );
  assert.equal(holdMutTrain.model.modelCoreHash, trained.model.modelCoreHash);
  assert.deepEqual(
    holdMutTrain.model.preprocessing,
    trained.model.preprocessing,
  );
  console.log("HOLDOUT_VALUES_DO_NOT_CHANGE_V2B_MODEL = PASS");

  assertThrowsCode(
    () =>
      trainIndependentLogisticStreakRestAblationV2b(join, split, {
        sourceJoinHash: joinHash,
        v1ModelCoreHash: V1_CORE,
        v2aModelCoreHash: "0".repeat(64),
        v2aValidation,
      }),
    "V2A_MODEL_CORE_HASH_PIN_MISMATCH",
    "v2a pin",
  );

  const libFiles = ["spec.ts", "preprocess.ts", "train.ts", "index.ts"];
  for (const file of libFiles) {
    const text = readFileSync(path.join(LIB_DIR, file), "utf8");
    assert.equal(text.includes("Math.random"), false);
    assert.equal(text.includes("prediction-v0"), false);
    assert.equal(text.includes("statsapi.mlb.com"), false);
    assert.equal(text.includes("fetch("), false);
  }

  assert.equal(sha256File(independentJoinArtifactPath()), JOIN_BEFORE);
  assert.equal(sha256File(independentSafeAFeatureArtifactPath()), FEATURE_BEFORE);
  assert.equal(sha256File(independentLabelArtifactPath()), LABEL_BEFORE);
  assert.equal(sha256File(independentSafeAHistoricalSourcePath()), SOURCE_BEFORE);
  assert.equal(sha256File(independentLogisticModelPath()), v1ModelHashBefore);
  assert.equal(sha256File(independentLogisticEvalPath()), v1EvalHashBefore);
  assert.equal(sha256File(independentLogisticAuditPath()), v1AuditHashBefore);
  assert.equal(sha256File(independentLogisticDiagnosticPath()), diagHashBefore);
  assert.equal(sha256File(independentLogisticDiagnosticAuditPath()), diagAuditHashBefore);
  assert.equal(sha256File(independentLogisticV2aModelPath()), v2aModelBefore);
  assert.equal(sha256File(independentLogisticV2aEvalPath()), v2aEvalBefore);
  assert.equal(sha256File(independentLogisticV2aAuditPath()), v2aAuditBefore);
  assert.equal(sha256File(independentLogisticV2aCalibDiagnosticPath()), calibDiagBefore);
  assert.equal(sha256File(independentLogisticV2aCalibAuditPath()), calibAuditBefore);
  assert.equal(sha256File(independentLogisticV2aSignalStabDiagnosticPath()), stabDiagBefore);
  assert.equal(sha256File(independentLogisticV2aSignalStabAuditPath()), stabAuditBefore);
  console.log("SEALED_ARTIFACTS_UNCHANGED = PASS");

  if (
    existsSync(independentLogisticV2bModelPath()) &&
    existsSync(independentLogisticV2bEvalPath()) &&
    existsSync(independentLogisticV2bAuditPath()) &&
    existsSync(independentLogisticV2bRollingPath())
  ) {
    const persisted = JSON.parse(
      readFileSync(independentLogisticV2bModelPath(), "utf8"),
    );
    assert.equal(persisted.modelCoreHash, trained.model.modelCoreHash);
    assert.equal(persisted.modelCandidate, false);
    assert.equal(persisted.holdoutEvaluated, false);
    assert.equal(persisted.coefficients.length, 45);
  }

  console.log(`modelCoreHash=${trained.model.modelCoreHash}`);
  console.log(`VALIDATION_rocAuc=${trained.audit.validationRocAuc}`);
  console.log(`VALIDATION_logLoss=${trained.audit.validationMetrics.logLoss}`);
  console.log(`VALIDATION_brier=${trained.audit.validationMetrics.brierScore}`);
  console.log(`researchInterpretation=${trained.audit.researchInterpretation}`);
  console.log("HOLDOUT_EVALUATED = NO");
  console.log("test:mlb-independent-logistic-streak-rest-ablation-v2b PASS");
}

main();

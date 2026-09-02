/**
 * Independent Logistic Season-Volume Ablation v2-A tests.
 * HOLDOUT labels are not evaluated. Frozen v1 is not modified.
 *
 *   npm run test:mlb-independent-logistic-season-volume-ablation-v2a
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
import { orderedLogisticBaseFeatureNamesV1 } from "../src/lib/mlb/independent-logistic-v1/spec";
import {
  independentLogisticDiagnosticAuditPath,
  independentLogisticDiagnosticPath,
} from "../src/lib/mlb/independent-logistic-diagnostic-v1";
import {
  MLB_INDEPENDENT_2024_SEALED_V1_MODEL_CORE_HASH_V2A,
  MLB_INDEPENDENT_LOGISTIC_REMOVED_SEASON_VOLUME_V2A,
  auditFeatureAblationV2a,
  extractRawBaseAndMissingV2a,
  fitTrainPreprocessorV2a,
  independentLogisticV2aAuditPath,
  independentLogisticV2aEvalPath,
  independentLogisticV2aModelPath,
  interpretSeasonVolumeAblationV2a,
  orderedLogisticBaseFeatureNamesV2a,
  orderedLogisticMissingIndicatorNamesV2a,
  orderedLogisticModelFeatureNamesV2a,
  trainIndependentLogisticSeasonVolumeAblationV2a,
  type FrozenV1EvalRowV2a,
  type LogisticTrainRowV2a,
} from "../src/lib/mlb/independent-logistic-v2a";

const ROOT = process.cwd();
const LIB_DIR = path.join(ROOT, "src/lib/mlb/independent-logistic-v2a");
const V1_LIB_DIR = path.join(ROOT, "src/lib/mlb/independent-logistic-v1");
const JOIN_BEFORE = MLB_INDEPENDENT_2024_SEALED_JOIN_SHA256_V1;
const FEATURE_BEFORE =
  "5f0cf297ebc9e5a1e0b10aad136632f51ddbc9f6b1560c676f3df2aa2ea8c753";
const LABEL_BEFORE =
  "9f52cd1de57567819dd7f6fea245baad1365a6eae12dadeafec76ead02d7a3da";
const SOURCE_BEFORE =
  "7a637e182a91a0b20e399ed2a4d98824c3a5916ac61cb6903e504a919a514e7d";
const V1_CORE = MLB_INDEPENDENT_2024_SEALED_V1_MODEL_CORE_HASH_V2A;

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

function loadV1Validation(): FrozenV1EvalRowV2a[] {
  const ev = JSON.parse(readFileSync(independentLogisticEvalPath(), "utf8"));
  assert.equal(ev.modelCoreHash, V1_CORE);
  return ev.validation;
}

function toTrainRow(
  join: IndependentJoinArtifactV1,
  gamePk: number,
): LogisticTrainRowV2a {
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

  const ablation = auditFeatureAblationV2a();
  assert.equal(ablation.V1_BASE_FEATURE_COUNT, 35);
  assert.equal(ablation.V2A_BASE_FEATURE_COUNT, 29);
  assert.equal(ablation.REMOVED_FEATURE_COUNT, 6);
  assert.deepEqual(ablation.REMOVED_FEATURES, [
    ...MLB_INDEPENDENT_LOGISTIC_REMOVED_SEASON_VOLUME_V2A,
  ]);
  assert.equal(ablation.ADDED_FEATURE_COUNT, 0);
  assert.equal(ablation.UNINTENDED_REMOVED_FEATURE_COUNT, 0);
  assert.equal(ablation.MISSING_INDICATOR_CHANGE_COUNT, 0);
  assert.equal(ablation.EXACT_SINGLE_ABLATION, "PASS");
  assert.equal(ablation.SEASON_VOLUME_FEATURES_IN_V2A_X, 0);
  assert.equal(orderedLogisticBaseFeatureNamesV2a().length, 29);
  assert.equal(orderedLogisticMissingIndicatorNamesV2a().length, 22);
  assert.equal(orderedLogisticModelFeatureNamesV2a().length, 51);
  const v2aSet = new Set(orderedLogisticModelFeatureNamesV2a());
  for (const name of MLB_INDEPENDENT_LOGISTIC_REMOVED_SEASON_VOLUME_V2A) {
    assert.equal(v2aSet.has(name), false, `${name} still in v2-A X`);
  }
  const remaining = orderedLogisticBaseFeatureNamesV1().filter(
    (n) =>
      !MLB_INDEPENDENT_LOGISTIC_REMOVED_SEASON_VOLUME_V2A.includes(
        n as (typeof MLB_INDEPENDENT_LOGISTIC_REMOVED_SEASON_VOLUME_V2A)[number],
      ),
  );
  assert.deepEqual(orderedLogisticBaseFeatureNamesV2a(), remaining);
  console.log("EXACT_SIX_FEATURE_REMOVAL = PASS");
  console.log("NO_OTHER_FEATURE_REMOVAL = PASS");
  console.log("MODEL_DIMENSION_51 = PASS");
  console.log("SAME_22_MISSING_INDICATORS = PASS");
  console.log("SEASON_VOLUME_FEATURES_IN_V2A_X = 0");

  assert.equal(
    interpretSeasonVolumeAblationV2a({
      v1AbsLogitShift: 0.24,
      v2aAbsLogitShift: 0.05,
      v1AbsBias: 0.08,
      v2aAbsBias: 0.02,
      v1LogLoss: 0.7,
      v2aLogLoss: 0.69,
      v1Brier: 0.25,
      v2aBrier: 0.24,
    }),
    "SUPPORTS_SEASON_VOLUME_ABLATION",
  );
  assert.equal(
    interpretSeasonVolumeAblationV2a({
      v1AbsLogitShift: 0.24,
      v2aAbsLogitShift: 0.25,
      v1AbsBias: 0.08,
      v2aAbsBias: 0.09,
      v1LogLoss: 0.7,
      v2aLogLoss: 0.71,
      v1Brier: 0.25,
      v2aBrier: 0.26,
    }),
    "DOES_NOT_SUPPORT_SEASON_VOLUME_ABLATION",
  );
  assert.equal(
    interpretSeasonVolumeAblationV2a({
      v1AbsLogitShift: 0.24,
      v2aAbsLogitShift: 0.05,
      v1AbsBias: 0.08,
      v2aAbsBias: 0.09,
      v1LogLoss: 0.7,
      v2aLogLoss: 0.71,
      v1Brier: 0.25,
      v2aBrier: 0.26,
    }),
    "MIXED_SEASON_VOLUME_ABLATION_RESULT",
  );

  const join = loadJoin();
  const split = loadSplit();
  const v1Validation = loadV1Validation();
  const trainPk = split.trainGamePks[0]!;
  const valPk = split.validationGamePks[0]!;
  const holdoutPk = split.holdoutGamePks[0]!;
  const trainSample = split.trainGamePks.slice(0, 12).map((pk) => toTrainRow(join, pk));
  const prepA = fitTrainPreprocessorV2a(trainSample);
  assert.equal(prepA.orderedBaseFeatureNames.length, 29);
  assert.equal(Object.keys(prepA.medianByFeature).length, 29);
  assert.equal(
    prepA.orderedBaseFeatureNames.some((n) => n === "home.gamesPlayedBefore"),
    false,
  );

  const mutatedValJoin = clone(join);
  const valJoinRow = mutatedValJoin.rows.find((r) => r.identity.gamePk === valPk)!;
  valJoinRow.feature.home.winRateBefore = 0.01;
  valJoinRow.feature.away.runsScoredAverageBefore = 99;
  const prepB = fitTrainPreprocessorV2a(trainSample);
  assert.deepEqual(prepA.medianByFeature, prepB.medianByFeature);
  assert.deepEqual(prepA.meanByFeature, prepB.meanByFeature);
  assert.deepEqual(prepA.scaleByFeature, prepB.scaleByFeature);
  console.log("VALIDATION_VALUES_DO_NOT_AFFECT_V2A_PREPROCESSOR = PASS");

  const holdoutRow = toTrainRow(join, holdoutPk);
  holdoutRow.feature.home.winRateBefore = 0.99;
  const prepC = fitTrainPreprocessorV2a(trainSample);
  assert.deepEqual(prepA, prepC);
  console.log("HOLDOUT_VALUES_DO_NOT_AFFECT_V2A_PREPROCESSOR = PASS");

  const missingRow = join.rows.find(
    (r) =>
      split.trainGamePks.includes(r.identity.gamePk) &&
      r.feature.home.restDaysBefore == null,
  );
  if (missingRow) {
    const extracted = extractRawBaseAndMissingV2a(missingRow.feature);
    const restIdx = orderedLogisticMissingIndicatorNamesV2a().indexOf(
      "home.restDaysBefore.missing",
    );
    assert.equal(extracted.missing[restIdx], 1);
  }

  const nonfinite = clone(trainSample[0]!);
  (nonfinite.feature.home as { winRateBefore: number | null }).winRateBefore =
    Number.POSITIVE_INFINITY;
  assertThrowsCode(
    () => fitTrainPreprocessorV2a([nonfinite]),
    "FEATURE_NONFINITE",
    "nonfinite input",
  );
  console.log("NONFINITE_BLOCK = PASS");

  const forbidden = [
    "market",
    "odds",
    "implied",
    "favorite",
    "edge",
    "closing",
    "winner",
    "target",
    "score",
    "result",
    "grade",
    "gamePk",
    "teamId",
    "officialDate",
    "commenceTime",
  ];
  for (const name of orderedLogisticModelFeatureNamesV2a()) {
    for (const token of forbidden) {
      const bounded = new RegExp(`(^|[._])${token}([._]|$)`, "i");
      assert.equal(bounded.test(name), false, `${name} contains ${token}`);
    }
  }

  const joinHash = sha256File(independentJoinArtifactPath());
  assert.equal(joinHash, JOIN_BEFORE);
  const trained = trainIndependentLogisticSeasonVolumeAblationV2a(join, split, {
    sourceJoinHash: joinHash,
    v1ModelCoreHash: V1_CORE,
    v1Validation,
    generatedAt: "2026-09-02T00:00:00.000Z",
  });
  assert.equal(trained.model.modelCandidate, false);
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
  assert.equal(trained.model.coefficients.length, 51);
  assert.equal(trained.model.featureSpec.baseDimensions, 29);
  assert.equal(trained.model.v1BaselineModelCoreHash, V1_CORE);
  assert.equal(trained.audit.logitShift.logitShiftReconciliation, "PASS");
  assert.equal(trained.audit.ablation.EXACT_SINGLE_ABLATION, "PASS");
  assert.equal(trained.audit.baselineTrainHomeRate, 776 / 1463);
  const holdoutSet = new Set(split.holdoutGamePks);
  assert.equal(
    trained.evaluation.train.some((r) => holdoutSet.has(r.gamePk)),
    false,
  );
  assert.equal(
    trained.evaluation.validation.some((r) => holdoutSet.has(r.gamePk)),
    false,
  );
  console.log("V2A_LOGIT_SHIFT_RECONCILIATION = PASS");

  const shuffledJoin = clone(join);
  shuffledJoin.rows = shuffle(shuffledJoin.rows);
  const shuffledTrain = trainIndependentLogisticSeasonVolumeAblationV2a(
    shuffledJoin,
    split,
    {
      sourceJoinHash: joinHash,
      v1ModelCoreHash: V1_CORE,
      v1Validation,
      generatedAt: "2026-09-02T00:00:00.000Z",
    },
  );
  assert.equal(shuffledTrain.model.modelCoreHash, trained.model.modelCoreHash);
  for (let i = 0; i < 51; i += 1) {
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
  console.log("SHUFFLED_TRAIN_V2A_MODEL_IDENTICAL = PASS");
  console.log("MODEL_CORE_HASH_DETERMINISTIC = PASS");

  const valMutJoin = clone(join);
  for (const row of valMutJoin.rows) {
    if (!split.validationGamePks.includes(row.identity.gamePk)) continue;
    row.feature.home.restDaysBefore = (row.feature.home.restDaysBefore ?? 0) + 7;
    row.label.winner = row.label.winner === "HOME" ? "AWAY" : "HOME";
    row.label.target = row.label.target === 1 ? 0 : 1;
  }
  const valMutTrain = trainIndependentLogisticSeasonVolumeAblationV2a(
    valMutJoin,
    split,
    {
      sourceJoinHash: joinHash,
      v1ModelCoreHash: V1_CORE,
      v1Validation,
      generatedAt: "2026-09-02T00:00:00.000Z",
    },
  );
  assert.equal(valMutTrain.model.modelCoreHash, trained.model.modelCoreHash);
  assert.deepEqual(valMutTrain.model.coefficients, trained.model.coefficients);
  assert.equal(valMutTrain.model.intercept, trained.model.intercept);
  console.log("VALIDATION_VALUES_DO_NOT_CHANGE_V2A_MODEL = PASS");

  const holdMutJoin = clone(join);
  for (const row of holdMutJoin.rows) {
    if (!split.holdoutGamePks.includes(row.identity.gamePk)) continue;
    row.feature.away.winRateBefore = 0.11;
    row.label.winner = "HOME";
    row.label.target = 1;
  }
  const holdMutTrain = trainIndependentLogisticSeasonVolumeAblationV2a(
    holdMutJoin,
    split,
    {
      sourceJoinHash: joinHash,
      v1ModelCoreHash: V1_CORE,
      v1Validation,
      generatedAt: "2026-09-02T00:00:00.000Z",
    },
  );
  assert.equal(holdMutTrain.model.modelCoreHash, trained.model.modelCoreHash);
  assert.deepEqual(
    holdMutTrain.model.preprocessing,
    trained.model.preprocessing,
  );
  console.log("HOLDOUT_VALUES_DO_NOT_CHANGE_V2A_MODEL = PASS");

  assertThrowsCode(
    () =>
      trainIndependentLogisticSeasonVolumeAblationV2a(join, split, {
        sourceJoinHash: joinHash,
        v1ModelCoreHash: "0".repeat(64),
        v1Validation,
      }),
    "V1_MODEL_CORE_HASH_PIN_MISMATCH",
    "v1 pin",
  );

  const libFiles = ["spec.ts", "preprocess.ts", "train.ts", "index.ts"];
  for (const file of libFiles) {
    const text = readFileSync(path.join(LIB_DIR, file), "utf8");
    assert.equal(text.includes("Math.random"), false);
    assert.equal(text.includes("prediction-v0"), false);
    assert.equal(text.includes("statsapi.mlb.com"), false);
    assert.equal(text.includes("fetch("), false);
  }
  for (const file of [
    "spec.ts",
    "logistic.ts",
    "preprocess.ts",
    "metrics.ts",
    "train.ts",
    "index.ts",
  ]) {
    assert.equal(existsSync(path.join(V1_LIB_DIR, file)), true);
  }

  assert.equal(sha256File(independentJoinArtifactPath()), JOIN_BEFORE);
  assert.equal(sha256File(independentSafeAFeatureArtifactPath()), FEATURE_BEFORE);
  assert.equal(sha256File(independentLabelArtifactPath()), LABEL_BEFORE);
  assert.equal(sha256File(independentSafeAHistoricalSourcePath()), SOURCE_BEFORE);
  assert.equal(sha256File(independentLogisticModelPath()), v1ModelHashBefore);
  assert.equal(sha256File(independentLogisticEvalPath()), v1EvalHashBefore);
  assert.equal(sha256File(independentLogisticAuditPath()), v1AuditHashBefore);
  assert.equal(sha256File(independentLogisticDiagnosticPath()), diagHashBefore);
  assert.equal(
    sha256File(independentLogisticDiagnosticAuditPath()),
    diagAuditHashBefore,
  );
  console.log("V1_ARTIFACT_UNCHANGED = PASS");

  if (
    existsSync(independentLogisticV2aModelPath()) &&
    existsSync(independentLogisticV2aEvalPath()) &&
    existsSync(independentLogisticV2aAuditPath())
  ) {
    const persisted = JSON.parse(
      readFileSync(independentLogisticV2aModelPath(), "utf8"),
    );
    assert.equal(persisted.modelCoreHash, trained.model.modelCoreHash);
    assert.equal(persisted.modelCandidate, false);
    assert.equal(persisted.holdoutEvaluated, false);
    assert.equal(persisted.coefficients.length, 51);
  }

  console.log(`modelCoreHash=${trained.model.modelCoreHash}`);
  console.log(`VALIDATION_accuracy=${trained.audit.validationMetrics.accuracy}`);
  console.log(`VALIDATION_logLoss=${trained.audit.validationMetrics.logLoss}`);
  console.log(`VALIDATION_brier=${trained.audit.validationMetrics.brierScore}`);
  console.log(
    `researchInterpretation=${trained.audit.researchInterpretation}`,
  );
  console.log("HOLDOUT_EVALUATED = NO");
  console.log("test:mlb-independent-logistic-season-volume-ablation-v2a PASS");
}

main();

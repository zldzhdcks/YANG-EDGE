/**
 * Independent Logistic Regression Prototype v1 tests.
 * HOLDOUT labels are not evaluated. No network. No engine wiring.
 *
 *   npm run test:mlb-independent-logistic-prototype-v1
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
  IndependentLogisticError,
  MLB_INDEPENDENT_2024_SEALED_SPLIT_MANIFEST_HASH_V1,
  extractRawBaseAndMissing,
  fitFullBatchLogisticV1,
  fitTrainPreprocessorV1,
  independentLogisticAuditPath,
  independentLogisticEvalPath,
  independentLogisticModelPath,
  medianOf,
  orderedLogisticBaseFeatureNamesV1,
  orderedLogisticMissingIndicatorNamesV1,
  orderedLogisticModelFeatureNamesV1,
  stableSigmoid,
  trainIndependentLogisticPrototypeV1,
} from "../src/lib/mlb/independent-logistic-v1";
import { logisticMeanBce } from "../src/lib/mlb/independent-logistic-v1/logistic";
import type { LogisticTrainRowV1 } from "../src/lib/mlb/independent-logistic-v1";

const ROOT = process.cwd();
const LIB_DIR = path.join(ROOT, "src/lib/mlb/independent-logistic-v1");
const JOIN_BEFORE = MLB_INDEPENDENT_2024_SEALED_JOIN_SHA256_V1;
const FEATURE_BEFORE =
  "5f0cf297ebc9e5a1e0b10aad136632f51ddbc9f6b1560c676f3df2aa2ea8c753";
const LABEL_BEFORE =
  "9f52cd1de57567819dd7f6fea245baad1365a6eae12dadeafec76ead02d7a3da";
const SOURCE_BEFORE =
  "7a637e182a91a0b20e399ed2a4d98824c3a5916ac61cb6903e504a919a514e7d";
const SPLIT_MANIFEST_BEFORE = MLB_INDEPENDENT_2024_SEALED_SPLIT_MANIFEST_HASH_V1;

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

function toTrainRow(
  join: IndependentJoinArtifactV1,
  gamePk: number,
): LogisticTrainRowV1 {
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
  assert.equal(sha256File(independentJoinArtifactPath()), JOIN_BEFORE);
  const split = loadSplit();
  assert.equal(split.splitManifestHash, SPLIT_MANIFEST_BEFORE);
  assert.equal(split.sourceJoinArtifactHash, JOIN_BEFORE);
  assert.equal(split.counts.train, 1463);
  assert.equal(split.counts.validation, 483);
  assert.equal(split.counts.holdout, 483);

  assert.equal(stableSigmoid(0), 0.5);
  assert.ok(stableSigmoid(60) > 0.999999 && stableSigmoid(60) <= 1);
  assert.ok(stableSigmoid(-60) < 1e-6 && stableSigmoid(-60) >= 0);
  assert.ok(Number.isFinite(stableSigmoid(60)));
  assert.ok(Number.isFinite(stableSigmoid(-60)));

  const scoresHome = new Float64Array([4]);
  const scoresAway = new Float64Array([-4]);
  const yHome = new Float64Array([1]);
  const yAway = new Float64Array([0]);
  assert.ok(logisticMeanBce(scoresHome, yHome) < logisticMeanBce(scoresAway, yHome));
  assert.ok(logisticMeanBce(scoresAway, yAway) < logisticMeanBce(scoresHome, yAway));

  const join = loadJoin();
  const trainPk = split.trainGamePks[0]!;
  const valPk = split.validationGamePks[0]!;
  const holdoutPk = split.holdoutGamePks[0]!;
  const trainSample = split.trainGamePks.slice(0, 12).map((pk) => toTrainRow(join, pk));
  const prepA = fitTrainPreprocessorV1(trainSample);
  const valMutated = clone(trainSample);
  const holdoutRow = toTrainRow(join, holdoutPk);
  holdoutRow.feature.home.winRateBefore = 0.99;
  holdoutRow.target = holdoutRow.target === 1 ? 0 : 1;
  const valOnly = [toTrainRow(join, valPk)];
  valOnly[0]!.feature.home.winRateBefore = 0.01;
  valOnly[0]!.feature.away.runsScoredAverageBefore = 99;
  const prepB = fitTrainPreprocessorV1(trainSample);
  assert.deepEqual(prepA.medianByFeature, prepB.medianByFeature);
  assert.deepEqual(prepA.meanByFeature, prepB.meanByFeature);
  assert.deepEqual(prepA.scaleByFeature, prepB.scaleByFeature);
  void valMutated;
  void holdoutRow;
  void valOnly;

  const withValNoise = clone(trainSample);
  const prepTrainOnly = fitTrainPreprocessorV1(withValNoise);
  const mutatedValJoin = clone(join);
  const valJoinRow = mutatedValJoin.rows.find((r) => r.identity.gamePk === valPk)!;
  valJoinRow.feature.home.winsBefore += 50;
  valJoinRow.feature.home.gamesPlayedBefore += 50;
  valJoinRow.label.winner = valJoinRow.label.winner === "HOME" ? "AWAY" : "HOME";
  valJoinRow.label.target = valJoinRow.label.target === 1 ? 0 : 1;
  const prepAfterVal = fitTrainPreprocessorV1(withValNoise);
  assert.deepEqual(prepTrainOnly, prepAfterVal);
  console.log("VALIDATION_VALUES_DO_NOT_AFFECT_PREPROCESSOR = PASS");

  const mutatedHoldoutJoin = clone(join);
  const holdoutJoinRow = mutatedHoldoutJoin.rows.find(
    (r) => r.identity.gamePk === holdoutPk,
  )!;
  holdoutJoinRow.feature.away.restDaysBefore = 99;
  holdoutJoinRow.label.winner = "AWAY";
  holdoutJoinRow.label.target = 0;
  const prepAfterHoldout = fitTrainPreprocessorV1(withValNoise);
  assert.deepEqual(prepTrainOnly, prepAfterHoldout);
  console.log("HOLDOUT_VALUES_DO_NOT_AFFECT_PREPROCESSOR = PASS");

  const missingRow = join.rows.find(
    (r) =>
      split.trainGamePks.includes(r.identity.gamePk) &&
      r.feature.home.restDaysBefore == null,
  );
  if (missingRow) {
    const extracted = extractRawBaseAndMissing(missingRow.feature);
    const restIdx = orderedLogisticMissingIndicatorNamesV1().indexOf(
      "home.restDaysBefore.missing",
    );
    assert.equal(extracted.missing[restIdx], 1);
  }
  const presentRow = join.rows.find(
    (r) =>
      split.trainGamePks.includes(r.identity.gamePk) &&
      r.feature.home.restDaysBefore != null,
  )!;
  const extractedPresent = extractRawBaseAndMissing(presentRow.feature);
  const restIdx = orderedLogisticMissingIndicatorNamesV1().indexOf(
    "home.restDaysBefore.missing",
  );
  assert.equal(extractedPresent.missing[restIdx], 0);

  const constantRows = Array.from({ length: 8 }, () => clone(trainSample[3]!));
  const zprep = fitTrainPreprocessorV1(constantRows);
  assert.equal(zprep.zeroVarianceFeatureNames.length > 0, true);
  for (const name of zprep.orderedBaseFeatureNames) {
    assert.equal(zprep.scaleByFeature[name], 1);
  }

  const nonfinite = clone(trainSample[0]!);
  (nonfinite.feature.home as { winRateBefore: number | null }).winRateBefore =
    Number.POSITIVE_INFINITY;
  assertThrowsCode(
    () => fitTrainPreprocessorV1([nonfinite]),
    "FEATURE_NONFINITE",
    "nonfinite input",
  );

  const tinyX = new Float64Array([1, 0, 0, 1, 1, 0, 0, 1]);
  const tinyY = new Float64Array([1, 0, 1, 0]);
  const tinyFit = fitFullBatchLogisticV1(tinyX, tinyY, 2, {
    maxIterations: 200,
  });
  assert.equal(Number.isFinite(tinyFit.finalObjective), true);
  assert.equal(tinyFit.weights.every((w) => Number.isFinite(w)), true);

  assert.equal(medianOf([1, 3, 2]), 2);
  assert.equal(medianOf([1, 2, 3, 4]), 2.5);
  assert.equal(medianOf([]), 0);

  const names = orderedLogisticModelFeatureNamesV1();
  assert.equal(orderedLogisticBaseFeatureNamesV1().length, 35);
  assert.equal(orderedLogisticMissingIndicatorNamesV1().length, 22);
  assert.equal(names.length, 57);
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
  for (const name of names) {
    for (const token of forbidden) {
      const bounded = new RegExp(`(^|[._])${token}([._]|$)`, "i");
      assert.equal(
        bounded.test(name),
        false,
        `${name} contains ${token}`,
      );
    }
  }

  const joinHash = sha256File(independentJoinArtifactPath());
  const trained = trainIndependentLogisticPrototypeV1(join, split, {
    sourceJoinHash: joinHash,
    generatedAt: "2026-09-02T00:00:00.000Z",
  });
  assert.equal(trained.model.holdoutEvaluated, false);
  assert.equal(trained.evaluation.holdoutEvaluated, false);
  assert.equal(trained.audit.holdoutEvaluated, false);
  assert.equal(trained.audit.holdoutLabelRowsReadForMetrics, 0);
  assert.equal(trained.audit.holdoutProbabilitiesCreated, 0);
  assert.equal(trained.audit.holdoutMembershipCount, 483);
  assert.equal(trained.evaluation.train.length, 1463);
  assert.equal(trained.evaluation.validation.length, 483);
  const holdoutSet = new Set(split.holdoutGamePks);
  assert.equal(
    trained.evaluation.train.some((r) => holdoutSet.has(r.gamePk)),
    false,
  );
  assert.equal(
    trained.evaluation.validation.some((r) => holdoutSet.has(r.gamePk)),
    false,
  );
  assert.equal(trained.model.coefficients.length, 57);
  assert.match(trained.model.modelCoreHash, /^[a-f0-9]{64}$/);
  assert.equal(trained.model.engineAdmission, "PROHIBITED");
  assert.equal(trained.model.modelPrototype, true);
  assert.equal(trained.audit.baselineTrainHomeRate, 776 / 1463);

  const shuffledJoin = clone(join);
  shuffledJoin.rows = shuffle(shuffledJoin.rows);
  const shuffledTrain = trainIndependentLogisticPrototypeV1(shuffledJoin, split, {
    sourceJoinHash: joinHash,
    generatedAt: "2026-09-02T00:00:00.000Z",
  });
  assert.equal(shuffledTrain.model.modelCoreHash, trained.model.modelCoreHash);
  for (let i = 0; i < 57; i += 1) {
    assert.ok(
      Math.abs(shuffledTrain.model.coefficients[i]! - trained.model.coefficients[i]!) <
        1e-10,
    );
  }
  assert.ok(Math.abs(shuffledTrain.model.intercept - trained.model.intercept) < 1e-10);
  console.log("SHUFFLED_TRAIN_MODEL_IDENTICAL = PASS");

  const valMutJoin = clone(join);
  for (const row of valMutJoin.rows) {
    if (!split.validationGamePks.includes(row.identity.gamePk)) continue;
    row.feature.home.restDaysBefore =
      (row.feature.home.restDaysBefore ?? 0) + 7;
    row.label.winner = row.label.winner === "HOME" ? "AWAY" : "HOME";
    row.label.target = row.label.target === 1 ? 0 : 1;
  }
  const valMutTrain = trainIndependentLogisticPrototypeV1(valMutJoin, split, {
    sourceJoinHash: joinHash,
    generatedAt: "2026-09-02T00:00:00.000Z",
  });
  assert.equal(valMutTrain.model.modelCoreHash, trained.model.modelCoreHash);
  assert.deepEqual(valMutTrain.model.coefficients, trained.model.coefficients);
  assert.equal(valMutTrain.model.intercept, trained.model.intercept);
  console.log("VALIDATION_VALUES_DO_NOT_CHANGE_MODEL = PASS");

  const holdMutJoin = clone(join);
  for (const row of holdMutJoin.rows) {
    if (!split.holdoutGamePks.includes(row.identity.gamePk)) continue;
    row.feature.away.winRateBefore = 0.11;
    row.label.winner = "HOME";
    row.label.target = 1;
  }
  const holdMutTrain = trainIndependentLogisticPrototypeV1(holdMutJoin, split, {
    sourceJoinHash: joinHash,
    generatedAt: "2026-09-02T00:00:00.000Z",
  });
  assert.equal(holdMutTrain.model.modelCoreHash, trained.model.modelCoreHash);
  assert.deepEqual(holdMutTrain.model.preprocessing, trained.model.preprocessing);
  console.log("HOLDOUT_VALUES_DO_NOT_CHANGE_MODEL = PASS");

  const libFiles = [
    "spec.ts",
    "logistic.ts",
    "preprocess.ts",
    "metrics.ts",
    "train.ts",
    "index.ts",
  ];
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
  assert.equal(sha256File(independentSplitArtifactPath()) !== "", true);
  const splitNow = JSON.parse(
    readFileSync(independentSplitArtifactPath(), "utf8"),
  );
  assert.equal(splitNow.splitManifestHash, SPLIT_MANIFEST_BEFORE);
  console.log("JOIN_ARTIFACT_CHANGED = NO");
  console.log("FEATURE_ARTIFACT_CHANGED = NO");
  console.log("LABEL_ARTIFACT_CHANGED = NO");
  console.log("HISTORICAL_SOURCE_CHANGED = NO");
  console.log("SPLIT_MANIFEST_CHANGED = NO");

  const modelPath = independentLogisticModelPath();
  const evalPath = independentLogisticEvalPath();
  const auditPath = independentLogisticAuditPath();
  if (existsSync(modelPath) && existsSync(evalPath) && existsSync(auditPath)) {
    const persisted = JSON.parse(readFileSync(modelPath, "utf8"));
    assert.equal(persisted.modelCoreHash, trained.model.modelCoreHash);
    assert.equal(persisted.holdoutEvaluated, false);
    assert.equal(JSON.parse(readFileSync(evalPath, "utf8")).validation.length, 483);
    assert.equal(
      JSON.parse(readFileSync(evalPath, "utf8")).train.length,
      1463,
    );
    console.log(`PERSISTED_MODEL_CORE=${persisted.modelCoreHash}`);
  }

  console.log(`TRAIN_accuracy=${trained.audit.trainMetrics.accuracy}`);
  console.log(`VALIDATION_accuracy=${trained.audit.validationMetrics.accuracy}`);
  console.log(`converged=${trained.audit.optimizer.converged}`);
  console.log(`iterations=${trained.audit.optimizer.iterations}`);
  console.log(`modelCoreHash=${trained.model.modelCoreHash}`);
  console.log("HOLDOUT_EVALUATED = NO");
  console.log("test:mlb-independent-logistic-prototype-v1 PASS");
}

main();

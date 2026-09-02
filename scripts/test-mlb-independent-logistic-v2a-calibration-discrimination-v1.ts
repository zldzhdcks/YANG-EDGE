/**
 * Frozen v2-A calibration / discrimination diagnostic tests.
 * HOLDOUT features/labels are not read. No retrain. No calibration applied.
 *
 *   npm run test:mlb-independent-logistic-v2a-calibration-discrimination-v1
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
import { orderedLogisticModelFeatureNamesV2a } from "../src/lib/mlb/independent-logistic-v2a/spec";
import {
  independentLogisticV2aAuditPath,
  independentLogisticV2aEvalPath,
  independentLogisticV2aModelPath,
} from "../src/lib/mlb/independent-logistic-v2a";
import {
  independentLogisticDiagnosticAuditPath,
  independentLogisticDiagnosticPath,
} from "../src/lib/mlb/independent-logistic-diagnostic-v1";
import { stableSigmoid } from "../src/lib/mlb/independent-logistic-v1/logistic";
import {
  FIXED_CALIBRATION_BINS_V2A,
  MLB_INDEPENDENT_2024_SEALED_V2A_MODEL_CORE_HASH,
  SEMANTIC_FEATURE_GROUPS_V2A,
  assertSemanticGroupCoverageV2a,
  assignFixedCalibrationBinIndex,
  calibrationOffsetForMeanProbability,
  diagnoseV2aCalibrationDiscriminationV1,
  fixedBinCalibrationTable,
  independentLogisticV2aCalibAuditPath,
  independentLogisticV2aCalibDiagnosticPath,
  rocAucMannWhitney,
  sealedV2aEvalPath,
  sealedV2aModelPath,
  type FrozenV2aModelV1,
} from "../src/lib/mlb/independent-logistic-v2a-diagnostic-v1";

const ROOT = process.cwd();
const LIB_DIR = path.join(
  ROOT,
  "src/lib/mlb/independent-logistic-v2a-diagnostic-v1",
);
const JOIN_BEFORE = MLB_INDEPENDENT_2024_SEALED_JOIN_SHA256_V1;
const FEATURE_BEFORE =
  "5f0cf297ebc9e5a1e0b10aad136632f51ddbc9f6b1560c676f3df2aa2ea8c753";
const LABEL_BEFORE =
  "9f52cd1de57567819dd7f6fea245baad1365a6eae12dadeafec76ead02d7a3da";
const SOURCE_BEFORE =
  "7a637e182a91a0b20e399ed2a4d98824c3a5916ac61cb6903e504a919a514e7d";
const V2A_CORE = MLB_INDEPENDENT_2024_SEALED_V2A_MODEL_CORE_HASH;

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
  const v1ModelBefore = sha256File(independentLogisticModelPath());
  const v1EvalBefore = sha256File(independentLogisticEvalPath());
  const v1AuditBefore = sha256File(independentLogisticAuditPath());
  const diagBefore = sha256File(independentLogisticDiagnosticPath());
  const diagAuditBefore = sha256File(independentLogisticDiagnosticAuditPath());
  const v2aModelBefore = sha256File(independentLogisticV2aModelPath());
  const v2aEvalBefore = sha256File(independentLogisticV2aEvalPath());
  const v2aAuditBefore = sha256File(independentLogisticV2aAuditPath());
  assert.equal(joinHashBefore, JOIN_BEFORE);
  assert.equal(featureHashBefore, FEATURE_BEFORE);
  assert.equal(labelHashBefore, LABEL_BEFORE);
  assert.equal(sourceHashBefore, SOURCE_BEFORE);

  assert.equal(rocAucMannWhitney([0, 0, 1, 1], [0.1, 0.2, 0.8, 0.9]), 1);
  assert.equal(rocAucMannWhitney([0, 0, 1, 1], [0.9, 0.8, 0.2, 0.1]), 0);
  assert.equal(rocAucMannWhitney([0, 1, 0, 1], [0.5, 0.5, 0.5, 0.5]), 0.5);
  console.log("AUC_PERFECT = 1");
  console.log("AUC_REVERSED = 0");
  console.log("AUC_ALL_TIED = 0.5");

  const z = Math.log(0.6 / 0.4);
  const offset = calibrationOffsetForMeanProbability([z, z, z, z], 0.5);
  assert.ok(Math.abs(offset + z) < 1e-10);
  assert.ok(Math.abs(stableSigmoid(z + offset) - 0.5) < 1e-10);
  console.log("CALIBRATION_OFFSET_BISECTION = PASS");

  assert.equal(FIXED_CALIBRATION_BINS_V2A.length, 8);
  assert.equal(assignFixedCalibrationBinIndex(0), 0);
  assert.equal(assignFixedCalibrationBinIndex(0.399999), 0);
  assert.equal(assignFixedCalibrationBinIndex(0.4), 1);
  assert.equal(assignFixedCalibrationBinIndex(0.5), 3);
  assert.equal(assignFixedCalibrationBinIndex(0.7), 7);
  assert.equal(assignFixedCalibrationBinIndex(1), 7);
  console.log("FIXED_CALIBRATION_BIN_BOUNDARIES = PASS");

  const eceFix = fixedBinCalibrationTable(
    [0, 1, 1, 1],
    [0.2, 0.2, 0.8, 0.8],
  );
  assert.equal(eceFix.bins[0]!.n, 2);
  assert.equal(eceFix.bins[7]!.n, 2);
  assert.ok(Math.abs(eceFix.ece - 0.25) < 1e-12);
  console.log("ECE_KNOWN_FIXTURE = PASS");

  assertSemanticGroupCoverageV2a();
  const grouped = Object.values(SEMANTIC_FEATURE_GROUPS_V2A).flat();
  assert.equal(grouped.length, 51);
  assert.equal(new Set(grouped).size, 51);
  assert.equal(orderedLogisticModelFeatureNamesV2a().length, 51);
  console.log("GROUP_COVERAGE_51 = PASS");

  const join = JSON.parse(
    readFileSync(independentJoinArtifactPath(), "utf8"),
  ) as IndependentJoinArtifactV1;
  const split = JSON.parse(
    readFileSync(independentSplitArtifactPath(), "utf8"),
  ) as IndependentSplitArtifactV1;
  const model = JSON.parse(
    readFileSync(sealedV2aModelPath(), "utf8"),
  ) as FrozenV2aModelV1;
  const evaluation = JSON.parse(readFileSync(sealedV2aEvalPath(), "utf8"));
  const v1Evaluation = JSON.parse(readFileSync(independentLogisticEvalPath(), "utf8"));
  assert.equal(model.modelCoreHash, V2A_CORE);

  const pinModel = clone(model);
  pinModel.modelCoreHash = "0".repeat(64);
  assertThrowsCode(
    () =>
      diagnoseV2aCalibrationDiscriminationV1({
        join,
        split,
        model: pinModel,
        evaluation,
        v1Evaluation,
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
      diagnoseV2aCalibrationDiscriminationV1({
        join,
        split,
        model,
        evaluation: pinEval,
        v1Evaluation,
        sourceJoinHash: JOIN_BEFORE,
      }),
    "EVALUATION_MODEL_CORE_HASH_MISMATCH",
    "eval pin",
  );
  console.log("V2A_EVALUATION_HASH_MISMATCH_BLOCK = PASS");

  const sealedJoin = sealHoldoutRows(join, split.holdoutGamePks);
  const official = diagnoseV2aCalibrationDiscriminationV1({
    join: sealedJoin,
    split,
    model,
    evaluation,
    v1Evaluation,
    sourceJoinHash: JOIN_BEFORE,
    generatedAt: "2026-09-02T00:00:00.000Z",
  });
  console.log("HOLDOUT_MEMBERSHIP_ONLY = PASS");
  assert.equal(official.diagnostic.trainProbabilityReplayMatch, "PASS");
  assert.equal(official.diagnostic.validationProbabilityReplayMatch, "PASS");
  assert.equal(official.diagnostic.residualLogitShiftReconciliation, "PASS");
  assert.equal(official.diagnostic.holdoutEvaluated, false);
  assert.equal(official.audit.trainingFunctionCalled, false);
  assert.equal(official.audit.preprocessorFitCalled, false);
  assert.equal(official.audit.optimizerCalled, false);
  assert.equal(official.audit.modelCoreChanged, false);
  console.log("FROZEN_PROBABILITY_REPLAY = PASS");
  console.log("RESIDUAL_LOGIT_SHIFT_RECONCILIATION = PASS");

  const shuffledJoin = clone(join);
  shuffledJoin.rows = shuffle(shuffledJoin.rows);
  const shuffled = diagnoseV2aCalibrationDiscriminationV1({
    join: shuffledJoin,
    split,
    model,
    evaluation,
    v1Evaluation,
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
    assert.equal(text.includes("fetch("), false);
    assert.equal(text.includes("fitTrainPreprocessorV2a"), false);
    assert.equal(text.includes("fitFullBatchLogisticV1"), false);
    assert.equal(
      text.includes("trainIndependentLogisticSeasonVolumeAblationV2a"),
      false,
    );
    assert.equal(text.includes("independent-logistic-v2a/train"), false);
  }

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
  console.log("SEALED_ARTIFACTS_UNCHANGED = PASS");

  if (
    existsSync(independentLogisticV2aCalibDiagnosticPath()) &&
    existsSync(independentLogisticV2aCalibAuditPath())
  ) {
    const persisted = JSON.parse(
      readFileSync(independentLogisticV2aCalibDiagnosticPath(), "utf8"),
    );
    assert.equal(persisted.modelCoreHash, V2A_CORE);
    assert.equal(persisted.holdoutEvaluated, false);
  }

  console.log(`modelCoreHash=${official.diagnostic.modelCoreHash}`);
  console.log(`residualLogitShift=${official.diagnostic.residualLogitShift}`);
  console.log(`validationRocAuc=${official.diagnostic.validationRocAuc}`);
  console.log("HOLDOUT_EVALUATED = NO");
  console.log("test:mlb-independent-logistic-v2a-calibration-discrimination-v1 PASS");
}

main();

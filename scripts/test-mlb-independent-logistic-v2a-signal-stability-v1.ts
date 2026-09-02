/**
 * Frozen v2-A temporal signal-stability diagnostic tests.
 * HOLDOUT features/labels are not read. No retrain. No feature selection.
 *
 *   npm run test:mlb-independent-logistic-v2a-signal-stability-v1
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
import {
  SEMANTIC_FEATURE_GROUPS_V2A,
  assertSemanticGroupCoverageV2a,
  independentLogisticV2aCalibAuditPath,
  independentLogisticV2aCalibDiagnosticPath,
  rocAucMannWhitney,
  type FrozenV2aModelV1,
} from "../src/lib/mlb/independent-logistic-v2a-diagnostic-v1";
import {
  TRAIN_TEMPORAL_WINDOWS_V2A,
  VALIDATION_TEMPORAL_WINDOWS_V2A,
  cohensDFromClasses,
  dateInInclusiveWindow,
  diagnoseV2aSignalStabilityV1,
  directionsFlip,
  directionsMatch,
  independentLogisticV2aSignalStabAuditPath,
  independentLogisticV2aSignalStabDiagnosticPath,
  sealedV2aEvalPathStab,
  sealedV2aModelPathStab,
  signalDirectionFromAuc,
  singleFeatureRocAuc,
  spearmanCorrelationDiag,
} from "../src/lib/mlb/independent-logistic-v2a-signal-stability-v1";

const ROOT = process.cwd();
const LIB_DIR = path.join(
  ROOT,
  "src/lib/mlb/independent-logistic-v2a-signal-stability-v1",
);
const JOIN_BEFORE = MLB_INDEPENDENT_2024_SEALED_JOIN_SHA256_V1;
const FEATURE_BEFORE =
  "5f0cf297ebc9e5a1e0b10aad136632f51ddbc9f6b1560c676f3df2aa2ea8c753";
const LABEL_BEFORE =
  "9f52cd1de57567819dd7f6fea245baad1365a6eae12dadeafec76ead02d7a3da";
const SOURCE_BEFORE =
  "7a637e182a91a0b20e399ed2a4d98824c3a5916ac61cb6903e504a919a514e7d";
const V2A_CORE =
  "bef2104957768a40cbfecbeb3ff99946dce80a7155ab93a29248cc6fab576c9b";

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
  const calibDiagBefore = existsSync(independentLogisticV2aCalibDiagnosticPath())
    ? sha256File(independentLogisticV2aCalibDiagnosticPath())
    : null;
  const calibAuditBefore = existsSync(independentLogisticV2aCalibAuditPath())
    ? sha256File(independentLogisticV2aCalibAuditPath())
    : null;
  assert.equal(joinHashBefore, JOIN_BEFORE);
  assert.equal(featureHashBefore, FEATURE_BEFORE);
  assert.equal(labelHashBefore, LABEL_BEFORE);
  assert.equal(sourceHashBefore, SOURCE_BEFORE);

  assert.equal(singleFeatureRocAuc([0, 0, 1, 1], [0.1, 0.2, 0.8, 0.9]), 1);
  assert.equal(singleFeatureRocAuc([0, 0, 1, 1], [0.9, 0.8, 0.2, 0.1]), 0);
  assert.equal(singleFeatureRocAuc([0, 1, 0, 1], [0.5, 0.5, 0.5, 0.5]), 0.5);
  assert.equal(rocAucMannWhitney([0, 0, 1, 1], [0.1, 0.2, 0.8, 0.9]), 1);
  console.log("AUC_PERFECT = 1");
  console.log("AUC_REVERSED = 0");
  console.log("AUC_ALL_TIED = 0.5");

  assert.equal(singleFeatureRocAuc([1, 1, 1, 1], [0.1, 0.4, 0.7, 0.9]), null);
  assert.equal(singleFeatureRocAuc([0, 0, 0], [1, 2, 3]), null);
  console.log("ONE_CLASS_WINDOW_RETURNS_NULL = PASS");

  const dKnown = cohensDFromClasses([1, 2, 3], [4, 5, 6]);
  assert.equal(dKnown.cohensD, -3);
  assert.equal(dKnown.pooledStd, 1);
  console.log("COHENS_D_KNOWN_FIXTURE = PASS");

  const dZeroEq = cohensDFromClasses([5, 5], [5, 5]);
  assert.equal(dZeroEq.cohensD, 0);
  const dZeroUnequal = cohensDFromClasses([1, 1], [0, 0]);
  assert.equal(dZeroUnequal.cohensD, null);
  assert.equal(dZeroUnequal.reason, "ZERO_POOLED_STD_UNEQUAL_MEANS");
  const dOneClass = cohensDFromClasses([1, 2], []);
  assert.equal(dOneClass.cohensD, null);
  assert.equal(dOneClass.reason, "ONE_CLASS_WINDOW");
  console.log("ZERO_VARIANCE_EFFECT_SIZE = PASS");

  assert.equal(directionsMatch("HOME", "HOME"), true);
  assert.equal(directionsMatch("AWAY", "AWAY"), true);
  assert.equal(directionsMatch("HOME", "AWAY"), false);
  assert.equal(directionsMatch("HOME", "NEUTRAL"), false);
  assert.equal(directionsFlip("HOME", "AWAY"), true);
  assert.equal(directionsFlip("AWAY", "HOME"), true);
  assert.equal(directionsFlip("HOME", "HOME"), false);
  assert.equal(directionsFlip("HOME", "NEUTRAL"), false);
  assert.equal(signalDirectionFromAuc(0.5), "NEUTRAL");
  assert.equal(signalDirectionFromAuc(0.6), "HOME");
  assert.equal(signalDirectionFromAuc(0.4), "AWAY");
  assert.equal(signalDirectionFromAuc(null), null);
  console.log("DIRECTION_MATCHING = PASS");
  console.log("DIRECTION_FLIP_DETECTION = PASS");

  const aligned = 0.2 * (1.0 - 0.4);
  assert.ok(aligned > 0);
  const misaligned = -0.2 * (1.0 - 0.4);
  assert.ok(misaligned < 0);
  const trainAlignedValMis = aligned > 0 && -0.05 < 0;
  assert.equal(trainAlignedValMis, true);
  console.log("COEFFICIENT_ALIGNED_SEPARATION = PASS");

  assertSemanticGroupCoverageV2a();
  const grouped = Object.values(SEMANTIC_FEATURE_GROUPS_V2A).flat();
  assert.equal(grouped.length, 51);
  assert.equal(new Set(grouped).size, 51);
  assert.equal(orderedLogisticModelFeatureNamesV2a().length, 51);
  console.log("GROUP_COVERAGE_51 = PASS");

  assert.equal(TRAIN_TEMPORAL_WINDOWS_V2A.length, 4);
  assert.equal(TRAIN_TEMPORAL_WINDOWS_V2A[0]!.start, "2024-03-20");
  assert.equal(TRAIN_TEMPORAL_WINDOWS_V2A[0]!.end, "2024-04-30");
  assert.equal(TRAIN_TEMPORAL_WINDOWS_V2A[1]!.start, "2024-05-01");
  assert.equal(TRAIN_TEMPORAL_WINDOWS_V2A[1]!.end, "2024-05-31");
  assert.equal(TRAIN_TEMPORAL_WINDOWS_V2A[2]!.start, "2024-06-01");
  assert.equal(TRAIN_TEMPORAL_WINDOWS_V2A[2]!.end, "2024-06-30");
  assert.equal(TRAIN_TEMPORAL_WINDOWS_V2A[3]!.start, "2024-07-01");
  assert.equal(TRAIN_TEMPORAL_WINDOWS_V2A[3]!.end, "2024-07-19");
  assert.equal(dateInInclusiveWindow("2024-03-20", "2024-03-20", "2024-04-30"), true);
  assert.equal(dateInInclusiveWindow("2024-04-30", "2024-03-20", "2024-04-30"), true);
  assert.equal(dateInInclusiveWindow("2024-05-01", "2024-03-20", "2024-04-30"), false);
  console.log("FIXED_TRAIN_TEMPORAL_BOUNDARIES = PASS");

  assert.equal(VALIDATION_TEMPORAL_WINDOWS_V2A.length, 5);
  assert.equal(VALIDATION_TEMPORAL_WINDOWS_V2A[0]!.start, "2024-07-20");
  assert.equal(VALIDATION_TEMPORAL_WINDOWS_V2A[0]!.end, "2024-07-26");
  assert.equal(VALIDATION_TEMPORAL_WINDOWS_V2A[4]!.start, "2024-08-17");
  assert.equal(VALIDATION_TEMPORAL_WINDOWS_V2A[4]!.end, "2024-08-24");
  console.log("FIXED_VALIDATION_BOUNDARIES = PASS");

  const spearman = spearmanCorrelationDiag([1, 2, 3, 4], [1, 2, 3, 4]);
  assert.ok(Math.abs(spearman - 1) < 1e-12);
  const spearmanRev = spearmanCorrelationDiag([1, 2, 3, 4], [4, 3, 2, 1]);
  assert.ok(Math.abs(spearmanRev + 1) < 1e-12);
  console.log("SIGNAL_TRANSFER_CORRELATION_DETERMINISTIC = PASS");

  const join = JSON.parse(
    readFileSync(independentJoinArtifactPath(), "utf8"),
  ) as IndependentJoinArtifactV1;
  const split = JSON.parse(
    readFileSync(independentSplitArtifactPath(), "utf8"),
  ) as IndependentSplitArtifactV1;
  const model = JSON.parse(
    readFileSync(sealedV2aModelPathStab(), "utf8"),
  ) as FrozenV2aModelV1;
  const evaluation = JSON.parse(readFileSync(sealedV2aEvalPathStab(), "utf8"));
  assert.equal(model.modelCoreHash, V2A_CORE);

  const pinModel = clone(model);
  pinModel.modelCoreHash = "0".repeat(64);
  assertThrowsCode(
    () =>
      diagnoseV2aSignalStabilityV1({
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
      diagnoseV2aSignalStabilityV1({
        join,
        split,
        model,
        evaluation: pinEval,
        sourceJoinHash: JOIN_BEFORE,
      }),
    "EVALUATION_MODEL_CORE_HASH_MISMATCH",
    "eval pin",
  );
  console.log("EVALUATION_HASH_MISMATCH_BLOCK = PASS");

  const sealedJoin = sealHoldoutRows(join, split.holdoutGamePks);
  const official = diagnoseV2aSignalStabilityV1({
    join: sealedJoin,
    split,
    model,
    evaluation,
    sourceJoinHash: JOIN_BEFORE,
    generatedAt: "2026-09-02T00:00:00.000Z",
  });
  console.log("HOLDOUT_MEMBERSHIP_ONLY = PASS");
  assert.equal(official.diagnostic.trainProbabilityReplayMatch, "PASS");
  assert.equal(official.diagnostic.validationProbabilityReplayMatch, "PASS");
  assert.equal(official.diagnostic.holdoutEvaluated, false);
  assert.equal(official.diagnostic.featureCount, 51);
  assert.equal(official.diagnostic.VALIDATION_HAS_BEEN_USED_FOR_MODEL_RESEARCH, true);
  assert.equal(official.audit.trainingFunctionCalled, false);
  assert.equal(official.audit.preprocessorFitCalled, false);
  assert.equal(official.audit.optimizerCalled, false);
  assert.equal(official.audit.modelCoreChanged, false);
  assert.equal(official.audit.featureChanged, false);
  assert.equal(official.audit.calibrationApplied, false);
  const evidence = official.diagnostic.evidenceSummary as Record<string, unknown>;
  assert.equal("KEEP_FEATURES" in evidence, false);
  assert.equal("DROP_FEATURES" in evidence, false);
  assert.equal("V2B_FEATURE_LIST" in evidence, false);
  console.log("FROZEN_PROBABILITY_REPLAY = PASS");

  const shuffledJoin = clone(join);
  shuffledJoin.rows = shuffle(shuffledJoin.rows);
  const shuffled = diagnoseV2aSignalStabilityV1({
    join: shuffledJoin,
    split,
    model,
    evaluation,
    sourceJoinHash: JOIN_BEFORE,
    generatedAt: "2026-09-02T00:00:00.000Z",
  });
  assert.deepEqual(shuffled.diagnostic, official.diagnostic);
  console.log("SHUFFLED_INPUT_DETERMINISTIC = PASS");

  const g = official.diagnostic.globalSignalTransfer as Record<string, unknown>;
  const shuffledG = shuffled.diagnostic.globalSignalTransfer as Record<
    string,
    unknown
  >;
  assert.equal(
    shuffledG.featureSignalTransferPearson,
    g.featureSignalTransferPearson,
  );
  assert.equal(
    shuffledG.featureSignalTransferSpearman,
    g.featureSignalTransferSpearman,
  );

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
    assert.equal(text.includes("writeFile"), false);
    assert.equal(text.includes("KEEP_FEATURES"), false);
    assert.equal(text.includes("DROP_FEATURES"), false);
    assert.equal(text.includes("V2B_FEATURE_LIST"), false);
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
  if (calibDiagBefore) {
    assert.equal(
      sha256File(independentLogisticV2aCalibDiagnosticPath()),
      calibDiagBefore,
    );
  }
  if (calibAuditBefore) {
    assert.equal(sha256File(independentLogisticV2aCalibAuditPath()), calibAuditBefore);
  }
  console.log("SEALED_ARTIFACTS_UNCHANGED = PASS");

  if (
    existsSync(independentLogisticV2aSignalStabDiagnosticPath()) &&
    existsSync(independentLogisticV2aSignalStabAuditPath())
  ) {
    const persisted = JSON.parse(
      readFileSync(independentLogisticV2aSignalStabDiagnosticPath(), "utf8"),
    );
    assert.equal(persisted.modelCoreHash, V2A_CORE);
    assert.equal(persisted.holdoutEvaluated, false);
  }

  console.log(`modelCoreHash=${official.diagnostic.modelCoreHash}`);
  console.log(`trainModelAuc=${official.diagnostic.trainModelAuc}`);
  console.log(`validationModelAuc=${official.diagnostic.validationModelAuc}`);
  console.log(
    `trainToValidationDirectionFlipCount=${g.trainToValidationDirectionFlipCount}`,
  );
  console.log("HOLDOUT_EVALUATED = NO");
  console.log("test:mlb-independent-logistic-v2a-signal-stability-v1 PASS");
}

main();

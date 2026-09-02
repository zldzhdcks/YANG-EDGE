/**
 * TRAIN-only v2-B group contribution diagnostic tests.
 * Validation and Holdout feature/label values are not read.
 * No v2-C model is produced.
 *
 *   npm run test:mlb-independent-logistic-v2b-group-contribution-v1
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
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
  orderedLogisticModelFeatureNamesV2b,
  ROLLING_FOLDS_V2B,
  TRAIN_TEMPORAL_WINDOWS_V2B,
} from "../src/lib/mlb/independent-logistic-v2b";
import {
  LEAVE_ONE_GROUP_OUT_V2B,
  MLB_INDEPENDENT_2024_SEALED_V2B_MODEL_CORE_HASH_GCV1,
  SEMANTIC_FEATURE_GROUPS_V2B,
  VARIANT_EXPECTED_DIM_V2B,
  assertSemanticGroupCoverageV2b,
  dateInInclusiveWindow,
  diagnoseV2bTrainGroupContributionV1,
  fitVariantOnFold,
  independentLogisticV2bGroupContribAuditPath,
  independentLogisticV2bGroupContribDiagnosticPath,
  labeledTrainRowsOnly,
  preprocessorFingerprintV2b,
  remainingFeatureNamesAfterRemovingGroup,
  type SealedV2bRollingArtifactV1,
} from "../src/lib/mlb/independent-logistic-v2b-group-contribution-v1";

const ROOT = process.cwd();
const LIB_DIR = path.join(
  ROOT,
  "src/lib/mlb/independent-logistic-v2b-group-contribution-v1",
);
const JOIN_BEFORE = MLB_INDEPENDENT_2024_SEALED_JOIN_SHA256_V1;
const FEATURE_BEFORE =
  "5f0cf297ebc9e5a1e0b10aad136632f51ddbc9f6b1560c676f3df2aa2ea8c753";
const LABEL_BEFORE =
  "9f52cd1de57567819dd7f6fea245baad1365a6eae12dadeafec76ead02d7a3da";
const SOURCE_BEFORE =
  "7a637e182a91a0b20e399ed2a4d98824c3a5916ac61cb6903e504a919a514e7d";
const V2B_CORE = MLB_INDEPENDENT_2024_SEALED_V2B_MODEL_CORE_HASH_GCV1;

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

function collectV2cPaths(dir: string, acc: string[] = []): string[] {
  if (!existsSync(dir)) return acc;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collectV2cPaths(full, acc);
    else if (/v2c/i.test(entry.name) || /v2-c/i.test(entry.name)) acc.push(full);
  }
  return acc;
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
  assert.equal(joinHashBefore, JOIN_BEFORE);
  assert.equal(featureHashBefore, FEATURE_BEFORE);
  assert.equal(labelHashBefore, LABEL_BEFORE);
  assert.equal(sourceHashBefore, SOURCE_BEFORE);

  const coverage = assertSemanticGroupCoverageV2b();
  assert.equal(coverage.GROUP_FEATURE_COUNT, 45);
  assert.equal(coverage.GROUP_OVERLAP, 0);
  assert.equal(coverage.GROUP_MISSING, 0);
  assert.equal("STREAK_REST" in SEMANTIC_FEATURE_GROUPS_V2B, false);
  for (const name of MLB_INDEPENDENT_LOGISTIC_REMOVED_STREAK_REST_V2B) {
    assert.equal(orderedLogisticModelFeatureNamesV2b().includes(name), false);
  }
  console.log("GROUP_EXACT_COVERAGE = PASS");
  console.log("NO_OVERLAP = PASS");
  console.log("STREAK_REST_ABSENT = PASS");

  assert.equal(remainingFeatureNamesAfterRemovingGroup(null).length, 45);
  assert.equal(VARIANT_EXPECTED_DIM_V2B.BASELINE, 45);
  for (const group of LEAVE_ONE_GROUP_OUT_V2B) {
    const remaining = remainingFeatureNamesAfterRemovingGroup(group);
    assert.equal(remaining.length, VARIANT_EXPECTED_DIM_V2B[group]);
    const dropped = SEMANTIC_FEATURE_GROUPS_V2B[group]!;
    for (const name of dropped) {
      assert.equal(remaining.includes(name), false, `${group} still has ${name}`);
    }
    const intendedDrop = new Set(dropped);
    const actualDrop = orderedLogisticModelFeatureNamesV2b().filter(
      (name) => !remaining.includes(name),
    );
    assert.deepEqual([...actualDrop].sort(), [...intendedDrop].sort());
  }
  console.log("LEAVE_ONE_GROUP_DIMENSIONS = PASS");

  assert.deepEqual(
    TRAIN_TEMPORAL_WINDOWS_V2B.map((w) => [w.id, w.start, w.end, w.expectedN]),
    [
      ["TRAIN_T1", "2024-03-20", "2024-04-30", 452],
      ["TRAIN_T2", "2024-05-01", "2024-05-31", 409],
      ["TRAIN_T3", "2024-06-01", "2024-06-30", 401],
      ["TRAIN_T4", "2024-07-01", "2024-07-19", 201],
    ],
  );
  assert.deepEqual(
    ROLLING_FOLDS_V2B.map((f) => [f.id, [...f.fit], f.eval]),
    [
      ["FOLD_1", ["TRAIN_T1"], "TRAIN_T2"],
      ["FOLD_2", ["TRAIN_T1", "TRAIN_T2"], "TRAIN_T3"],
      ["FOLD_3", ["TRAIN_T1", "TRAIN_T2", "TRAIN_T3"], "TRAIN_T4"],
    ],
  );
  assert.equal(dateInInclusiveWindow("2024-04-30", "2024-03-20", "2024-04-30"), true);
  assert.equal(dateInInclusiveWindow("2024-05-01", "2024-03-20", "2024-04-30"), false);
  console.log("FIXED_FOLD_BOUNDARIES = PASS");

  const join = JSON.parse(
    readFileSync(independentJoinArtifactPath(), "utf8"),
  ) as IndependentJoinArtifactV1;
  const split = JSON.parse(
    readFileSync(independentSplitArtifactPath(), "utf8"),
  ) as IndependentSplitArtifactV1;
  const sealedRolling = JSON.parse(
    readFileSync(independentLogisticV2bRollingPath(), "utf8"),
  ) as SealedV2bRollingArtifactV1;
  const v2bModel = JSON.parse(
    readFileSync(independentLogisticV2bModelPath(), "utf8"),
  ) as { modelCoreHash: string };
  assert.equal(v2bModel.modelCoreHash, V2B_CORE);

  const sealedJoin = sealPartitionRows(
    sealPartitionRows(join, split.validationGamePks, "VALIDATION"),
    split.holdoutGamePks,
    "HOLDOUT",
  );

  const result = diagnoseV2bTrainGroupContributionV1({
    join: sealedJoin,
    split,
    sourceJoinHash: joinHashBefore,
    sealedRolling,
    sealedV2bModelCoreHash: v2bModel.modelCoreHash,
    generatedAt: "2026-09-02T00:00:00.000Z",
  });
  console.log("VALIDATION_SEALED_PROXY = PASS");
  console.log("HOLDOUT_SEALED_PROXY = PASS");

  const d = result.diagnostic as Record<string, unknown>;
  assert.equal(d.V2B_ROLLING_FOLD_1_REPLAY, "PASS");
  assert.equal(d.V2B_ROLLING_FOLD_2_REPLAY, "PASS");
  assert.equal(d.V2B_ROLLING_FOLD_3_REPLAY, "PASS");
  console.log("V2B_ROLLING_FOLD_1_REPLAY = PASS");
  console.log("V2B_ROLLING_FOLD_2_REPLAY = PASS");
  console.log("V2B_ROLLING_FOLD_3_REPLAY = PASS");

  assert.equal(d.VALIDATION_FEATURE_ROWS_READ, 0);
  assert.equal(d.VALIDATION_LABEL_ROWS_READ, 0);
  assert.equal(d.VALIDATION_TRANSFORMED_ROWS, 0);
  assert.equal(d.VALIDATION_PROBABILITIES_CREATED, 0);
  assert.equal(d.VALIDATION_EVALUATED, false);
  assert.equal(d.HOLDOUT_FEATURE_ROWS_READ, 0);
  assert.equal(d.HOLDOUT_LABEL_ROWS_READ, 0);
  assert.equal(d.HOLDOUT_TRANSFORMED_ROWS, 0);
  assert.equal(d.HOLDOUT_PROBABILITIES_CREATED, 0);
  assert.equal(d.HOLDOUT_EVALUATED, false);
  assert.equal(d.newModelCreated, false);
  assert.equal(d.featureSelectionPerformed, false);
  assert.equal(d.validationNewAnalysisPerformed, false);
  assert.equal(d.modelCandidate, false);

  const folds = d.folds as Array<{
    id: string;
    fitN: number;
    evalN: number;
    baseline: {
      metrics: { preprocessorFitSampleCount: number; modelDimensions: number };
    };
    variants: Array<{
      group: string;
      metrics: { preprocessorFitSampleCount: number; modelDimensions: number };
    }>;
  }>;
  assert.equal(folds[0]!.fitN, 452);
  assert.equal(folds[0]!.evalN, 409);
  assert.equal(folds[1]!.fitN, 861);
  assert.equal(folds[1]!.evalN, 401);
  assert.equal(folds[2]!.fitN, 1262);
  assert.equal(folds[2]!.evalN, 201);
  for (const fold of folds) {
    assert.equal(
      fold.baseline.metrics.preprocessorFitSampleCount,
      fold.fitN,
      `${fold.id} baseline prep used eval`,
    );
    assert.equal(fold.baseline.metrics.modelDimensions, 45);
    for (const variant of fold.variants) {
      assert.equal(
        variant.metrics.preprocessorFitSampleCount,
        fold.fitN,
        `${fold.id} ${variant.group} prep used eval`,
      );
      assert.equal(
        variant.metrics.modelDimensions,
        VARIANT_EXPECTED_DIM_V2B[variant.group as keyof typeof VARIANT_EXPECTED_DIM_V2B],
      );
    }
  }
  console.log("EVAL_WINDOW_NEVER_USED_FOR_PREPROCESSING = PASS");

  const trainRows = labeledTrainRowsOnly(join, split.trainGamePks);
  const t1 = TRAIN_TEMPORAL_WINDOWS_V2B[0]!;
  const t2 = TRAIN_TEMPORAL_WINDOWS_V2B[1]!;
  const fitT1 = trainRows.filter((r) =>
    dateInInclusiveWindow(r.officialDate, t1.start, t1.end),
  );
  const evalT2 = trainRows.filter((r) =>
    dateInInclusiveWindow(r.officialDate, t2.start, t2.end),
  );
  const baselineNames = remainingFeatureNamesAfterRemovingGroup(null);
  const origFold1 = fitVariantOnFold(fitT1, evalT2, baselineNames);
  const mutatedEval = evalT2.map((row) => {
    const copy = clone(row);
    copy.feature.home.winRateBefore = 0.01;
    copy.feature.away.winRateBefore = 0.99;
    return copy;
  });
  const mutatedFold1 = fitVariantOnFold(fitT1, mutatedEval, baselineNames);
  assert.equal(
    preprocessorFingerprintV2b(origFold1.preprocessor),
    preprocessorFingerprintV2b(mutatedFold1.preprocessor),
  );
  assert.equal(origFold1.intercept, mutatedFold1.intercept);
  assert.deepEqual(origFold1.coefficients, mutatedFold1.coefficients);
  console.log("EVAL_MUTATION_DOES_NOT_CHANGE_FIT_PREPROCESSOR = PASS");

  const shuffledFit = shuffle(fitT1).sort((a, b) => {
    if (a.officialDate !== b.officialDate) {
      return a.officialDate < b.officialDate ? -1 : 1;
    }
    if (a.commenceTimeUtc !== b.commenceTimeUtc) {
      return a.commenceTimeUtc < b.commenceTimeUtc ? -1 : 1;
    }
    return a.gamePk - b.gamePk;
  });
  const shuffledFold1 = fitVariantOnFold(shuffledFit, evalT2, baselineNames);
  assert.equal(
    preprocessorFingerprintV2b(origFold1.preprocessor),
    preprocessorFingerprintV2b(shuffledFold1.preprocessor),
  );
  for (let i = 0; i < origFold1.coefficients.length; i += 1) {
    assert.ok(
      Math.abs(origFold1.coefficients[i]! - shuffledFold1.coefficients[i]!) <
        1e-10,
      `coef ${i}`,
    );
  }
  assert.ok(Math.abs(origFold1.intercept - shuffledFold1.intercept) < 1e-10);
  assert.ok(
    Math.abs(origFold1.metrics.rocAuc - shuffledFold1.metrics.rocAuc) < 1e-12,
  );
  console.log("SHUFFLED_FIT_ROWS_DETERMINISTIC = PASS");

  const shuffledJoin = {
    ...join,
    rows: shuffle(join.rows),
  };
  const shuffledResult = diagnoseV2bTrainGroupContributionV1({
    join: shuffledJoin,
    split,
    sourceJoinHash: joinHashBefore,
    sealedRolling,
    sealedV2bModelCoreHash: v2bModel.modelCoreHash,
    generatedAt: "2026-09-02T00:00:00.000Z",
  });
  const aFolds = result.diagnostic.folds as unknown[];
  const bFolds = shuffledResult.diagnostic.folds as unknown[];
  assert.equal(JSON.stringify(aFolds), JSON.stringify(bFolds));
  assert.equal(
    JSON.stringify(result.diagnostic.groupAggregates),
    JSON.stringify(shuffledResult.diagnostic.groupAggregates),
  );
  console.log("DETERMINISM = PASS");

  const valMutJoin = clone(join);
  for (const row of valMutJoin.rows) {
    if (!split.validationGamePks.includes(row.identity.gamePk)) continue;
    row.feature.home.winRateBefore = 0.11;
    row.label.winner = "HOME";
    row.label.target = 1;
  }
  const valMut = diagnoseV2bTrainGroupContributionV1({
    join: valMutJoin,
    split,
    sourceJoinHash: joinHashBefore,
    sealedRolling,
    sealedV2bModelCoreHash: v2bModel.modelCoreHash,
    generatedAt: "2026-09-02T00:00:00.000Z",
  });
  assert.equal(
    JSON.stringify(valMut.diagnostic.folds),
    JSON.stringify(result.diagnostic.folds),
  );
  console.log("VALIDATION_VALUES_DO_NOT_AFFECT_DIAGNOSTIC = PASS");

  const holdMutJoin = clone(join);
  for (const row of holdMutJoin.rows) {
    if (!split.holdoutGamePks.includes(row.identity.gamePk)) continue;
    row.feature.away.winRateBefore = 0.11;
    row.label.winner = "HOME";
    row.label.target = 1;
  }
  const holdMut = diagnoseV2bTrainGroupContributionV1({
    join: holdMutJoin,
    split,
    sourceJoinHash: joinHashBefore,
    sealedRolling,
    sealedV2bModelCoreHash: v2bModel.modelCoreHash,
    generatedAt: "2026-09-02T00:00:00.000Z",
  });
  assert.equal(
    JSON.stringify(holdMut.diagnostic.folds),
    JSON.stringify(result.diagnostic.folds),
  );
  console.log("HOLDOUT_VALUES_DO_NOT_AFFECT_DIAGNOSTIC = PASS");

  const v2cHits = [
    ...collectV2cPaths(path.join(ROOT, "data/research/mlb/independent-model-v1")),
    ...collectV2cPaths(path.join(ROOT, "src/lib/mlb")),
    ...collectV2cPaths(path.join(ROOT, "scripts")),
  ];
  assert.equal(v2cHits.length, 0, v2cHits.join(","));
  assert.equal(existsSync(path.join(LIB_DIR, "diagnose.ts")), true);
  assert.equal(d.newModelCreated, false);
  console.log("NO_V2C_ARTIFACT_PRODUCED = PASS");

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
  console.log("SEALED_ARTIFACTS_UNCHANGED = PASS");

  if (existsSync(independentLogisticV2bGroupContribDiagnosticPath())) {
    const persisted = JSON.parse(
      readFileSync(independentLogisticV2bGroupContribDiagnosticPath(), "utf8"),
    );
    assert.equal(persisted.V2B_ROLLING_FOLD_1_REPLAY, "PASS");
    assert.equal(persisted.newModelCreated, false);
  }
  if (existsSync(independentLogisticV2bGroupContribAuditPath())) {
    const persistedAudit = JSON.parse(
      readFileSync(independentLogisticV2bGroupContribAuditPath(), "utf8"),
    );
    assert.equal(persistedAudit.HOLDOUT_EVALUATED, false);
  }

  console.log(
    `v2bBaselineModelCoreHash=${d.v2bBaselineModelCoreHash}`,
  );
  console.log(`VALIDATION_EVALUATED = NO`);
  console.log(`HOLDOUT_EVALUATED = NO`);
  console.log("test:mlb-independent-logistic-v2b-group-contribution-v1 PASS");
}

main();

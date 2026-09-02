/**
 * Independent Logistic STREAK_REST Ablation Prototype v2-B.
 * TRAIN-internal rolling first. Full-TRAIN freeze. Then Validation.
 * HOLDOUT sealed. Does not modify frozen v1 or v2-A modules.
 */
import { createHash } from "node:crypto";
import path from "node:path";
import { MLB_INDEPENDENT_ENGINE_ADMISSION } from "../independent-model-v1";
import type {
  IndependentJoinArtifactV1,
  IndependentJoinRowV1,
} from "../independent-join-v1";
import type { IndependentSplitArtifactV1 } from "../independent-split-v1";
import {
  MLB_INDEPENDENT_2024_SEALED_SPLIT_MANIFEST_HASH_V1,
  verifySealedSplitForTrainingV1,
} from "../independent-logistic-v1/train";
import {
  MLB_INDEPENDENT_LOGISTIC_ARMIJO_V1,
  MLB_INDEPENDENT_LOGISTIC_BACKTRACK_V1,
  MLB_INDEPENDENT_LOGISTIC_GRAD_TOL_V1,
  MLB_INDEPENDENT_LOGISTIC_INITIAL_STEP_V1,
  MLB_INDEPENDENT_LOGISTIC_LAMBDA_V1,
  MLB_INDEPENDENT_LOGISTIC_MAX_ITERS_V1,
  MLB_INDEPENDENT_LOGISTIC_MIN_STEP_V1,
  MLB_INDEPENDENT_LOGISTIC_THRESHOLD_V1,
  fitFullBatchLogisticV1,
  predictLogisticProbability,
  type LogisticFitResultV1,
} from "../independent-logistic-v1/logistic";
import {
  constantBaselineMetricsV1,
  evaluateProbabilitiesV1,
  type LogisticMetricsV1,
} from "../independent-logistic-v1/metrics";
import {
  MLB_INDEPENDENT_LOGISTIC_MODEL_DIM_V2A,
} from "../independent-logistic-v2a/spec";
import {
  fitTrainPreprocessorV2a,
  transformMatrixV2a,
  transformRowV2a,
  type LogisticTrainRowV2a,
} from "../independent-logistic-v2a/preprocess";
import {
  fixedBinCalibrationTable,
  rocAucMannWhitney,
} from "../independent-logistic-v2a-diagnostic-v1";
import {
  IndependentLogisticError,
  MLB_INDEPENDENT_2024_SEALED_V1_MODEL_CORE_HASH_V2B,
  MLB_INDEPENDENT_2024_SEALED_V2A_MODEL_CORE_HASH_V2B,
  MLB_INDEPENDENT_LOGISTIC_BASE_DIM_V2B,
  MLB_INDEPENDENT_LOGISTIC_EXPERIMENT_ID_V2B,
  MLB_INDEPENDENT_LOGISTIC_EXPERIMENT_TYPE_V2B,
  MLB_INDEPENDENT_LOGISTIC_MISSING_DIM_V2B,
  MLB_INDEPENDENT_LOGISTIC_MODEL_DIM_V2B,
  MLB_INDEPENDENT_LOGISTIC_REMOVED_STREAK_REST_V2B,
  assertLogisticFeatureSpecV2b,
  auditFeatureAblationV2b,
  orderedLogisticBaseFeatureNamesV2b,
  orderedLogisticMissingIndicatorNamesV2b,
  orderedLogisticModelFeatureNamesV2b,
  type FeatureAblationAuditV2b,
} from "./spec";
import {
  fitTrainPreprocessorV2b,
  transformMatrixV2b,
  transformRowV2b,
  type LogisticPreprocessorV2b,
  type LogisticTrainRowV2b,
} from "./preprocess";

export const MLB_INDEPENDENT_LOGISTIC_SCHEMA_V2B =
  "mlb-independent-logistic-streak-rest-ablation-v2b" as const;
export const MLB_INDEPENDENT_LOGISTIC_BUILDER_VERSION_V2B =
  "mlb-independent-logistic-v2b" as const;

export const BASELINE_TRAIN_HOME_RATE_V2B = 776 / 1463;
export const LOGIT_RECONCILE_TOLERANCE_V2B = 1e-12;
export const V1_TOTAL_LOGIT_SHIFT_V2B = 0.2417182727197169;
export const V2A_TOTAL_LOGIT_SHIFT_V2B = 0.03245128717505322;
export const V2A_VALIDATION_ACTUAL_HOME_RATE_V2B = 0.5072463768115942;

export const FROZEN_V2A_VALIDATION_V2B = {
  rocAuc: 0.5318298748070657,
  accuracy: 0.5175983436853002,
  logLoss: 0.6945540989030753,
  brierScore: 0.25061940316473763,
  predictedHomeRate: 0.7453416149068323,
  meanPredictedProbability: 0.5384169698868772,
  meanProbabilityBias: 0.031170593075282915,
  trainRocAuc: 0.6027204414832156,
} as const;

export const TRAIN_TEMPORAL_WINDOWS_V2B = [
  { id: "TRAIN_T1", start: "2024-03-20", end: "2024-04-30", expectedN: 452 },
  { id: "TRAIN_T2", start: "2024-05-01", end: "2024-05-31", expectedN: 409 },
  { id: "TRAIN_T3", start: "2024-06-01", end: "2024-06-30", expectedN: 401 },
  { id: "TRAIN_T4", start: "2024-07-01", end: "2024-07-19", expectedN: 201 },
] as const;

export const VALIDATION_BINS_V2B = [
  { id: "BIN_1", start: "2024-07-20", end: "2024-07-26" },
  { id: "BIN_2", start: "2024-07-27", end: "2024-08-02" },
  { id: "BIN_3", start: "2024-08-03", end: "2024-08-09" },
  { id: "BIN_4", start: "2024-08-10", end: "2024-08-16" },
  { id: "BIN_5", start: "2024-08-17", end: "2024-08-24" },
] as const;

export const ROLLING_FOLDS_V2B = [
  { id: "FOLD_1", fit: ["TRAIN_T1"], eval: "TRAIN_T2" },
  { id: "FOLD_2", fit: ["TRAIN_T1", "TRAIN_T2"], eval: "TRAIN_T3" },
  { id: "FOLD_3", fit: ["TRAIN_T1", "TRAIN_T2", "TRAIN_T3"], eval: "TRAIN_T4" },
] as const;

export function independentLogisticV2bModelRel(): string {
  return "data/research/mlb/independent-model-v1/model/2024-logistic-regression-streak-rest-ablation-v2b.json";
}
export function independentLogisticV2bModelPath(cwd = process.cwd()): string {
  return path.join(cwd, independentLogisticV2bModelRel());
}
export function independentLogisticV2bEvalRel(): string {
  return "data/research/mlb/independent-model-v1/evaluations/2024-logistic-regression-streak-rest-ablation-v2b-train-validation.json";
}
export function independentLogisticV2bEvalPath(cwd = process.cwd()): string {
  return path.join(cwd, independentLogisticV2bEvalRel());
}
export function independentLogisticV2bRollingRel(): string {
  return "data/research/mlb/independent-model-v1/diagnostics/2024-logistic-streak-rest-ablation-v2b-train-rolling-v1.json";
}
export function independentLogisticV2bRollingPath(cwd = process.cwd()): string {
  return path.join(cwd, independentLogisticV2bRollingRel());
}
export function independentLogisticV2bAuditRel(): string {
  return "data/research/mlb/independent-model-v1/audits/2024-logistic-regression-streak-rest-ablation-v2b-audit.json";
}
export function independentLogisticV2bAuditPath(cwd = process.cwd()): string {
  return path.join(cwd, independentLogisticV2bAuditRel());
}

function sha256Utf8(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

export function hashModelCoreV2b(core: Record<string, unknown>): string {
  return sha256Utf8(JSON.stringify(core));
}

function compareTrainOrder(
  a: { officialDate: string; commenceTimeUtc: string; gamePk: number },
  b: { officialDate: string; commenceTimeUtc: string; gamePk: number },
): number {
  if (a.officialDate !== b.officialDate) {
    return a.officialDate < b.officialDate ? -1 : 1;
  }
  if (a.commenceTimeUtc !== b.commenceTimeUtc) {
    return a.commenceTimeUtc < b.commenceTimeUtc ? -1 : 1;
  }
  return a.gamePk - b.gamePk;
}

function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  let s = 0;
  for (const v of xs) s += v;
  return s / xs.length;
}

function medianOf(xs: number[]): number {
  if (xs.length === 0) return 0;
  const sorted = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid]!;
  return (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function dateInWindow(officialDate: string, start: string, end: string): boolean {
  return officialDate >= start && officialDate <= end;
}

export type LogisticEvalRowV2b = {
  gamePk: number;
  officialDate: string;
  commenceTimeUtc: string;
  target: 0 | 1;
  probability: number;
  predictedClass: 0 | 1;
  correct: boolean;
};

export type FrozenV2aEvalRowV2b = {
  gamePk: number;
  officialDate?: string;
  target: 0 | 1;
  probability: number;
};

export type RollingSpecMetricsV2b = {
  spec: "v2a" | "v2b";
  fitN: number;
  evalN: number;
  actualHomeRate: number;
  rocAuc: number;
  accuracy: number;
  logLoss: number;
  brierScore: number;
  meanProbability: number;
  meanProbabilityBias: number;
  predictedHomeClassRate: number;
};

export type RollingFoldResultV2b = {
  id: string;
  fitWindows: string[];
  evalWindow: string;
  v2a: RollingSpecMetricsV2b;
  v2b: RollingSpecMetricsV2b;
  v2bMinusV2aAuc: number;
  v2bMinusV2aLogLoss: number;
  v2bMinusV2aBrier: number;
  v2bMinusV2aAbsProbabilityBias: number;
};

export type AblationResearchInterpretationV2b =
  | "SUPPORTS_STREAK_REST_ABLATION"
  | "MIXED_STREAK_REST_ABLATION_RESULT"
  | "DOES_NOT_SUPPORT_STREAK_REST_ABLATION";

export type IndependentLogisticModelArtifactV2b = {
  schemaVersion: typeof MLB_INDEPENDENT_LOGISTIC_SCHEMA_V2B;
  builderVersion: typeof MLB_INDEPENDENT_LOGISTIC_BUILDER_VERSION_V2B;
  researchOnly: true;
  engineAdmission: typeof MLB_INDEPENDENT_ENGINE_ADMISSION;
  target: "HOME_WIN";
  modelType: "LOGISTIC_REGRESSION";
  experimentId: typeof MLB_INDEPENDENT_LOGISTIC_EXPERIMENT_ID_V2B;
  experimentType: typeof MLB_INDEPENDENT_LOGISTIC_EXPERIMENT_TYPE_V2B;
  modelPrototype: true;
  modelCandidate: false;
  engineApproved: false;
  sourceJoinArtifactHash: string;
  sourceSplitManifestHash: string;
  v1BaselineModelCoreHash: string;
  v2aBaselineModelCoreHash: string;
  trainingSampleCount: number;
  validationSampleCount: number;
  holdoutSampleCount: number;
  holdoutEvaluated: false;
  featureSpec: {
    orderedBaseFeatureNames: string[];
    orderedMissingIndicatorNames: string[];
    orderedModelFeatureNames: string[];
    baseDimensions: 23;
    missingIndicators: 22;
    modelDimensions: 45;
    removedFeatures: string[];
  };
  preprocessing: LogisticPreprocessorV2b;
  hyperparameters: {
    lambda: number;
    intercept: true;
    interceptRegularized: false;
    threshold: number;
    initialWeights: 0;
    initialIntercept: 0;
  };
  optimizer: {
    type: "FULL_BATCH_GRADIENT_DESCENT_BACKTRACKING";
    initialStep: number;
    backtrackFactor: number;
    armijoConstant: number;
    maxIterations: number;
    gradientTolerance: number;
    minimumStep: number;
    result: Omit<LogisticFitResultV1, "weights">;
  };
  intercept: number;
  coefficients: number[];
  modelCoreHash: string;
};

function labeledRowsForPks(
  join: IndependentJoinArtifactV1,
  pks: number[],
): LogisticTrainRowV2b[] {
  const allowed = new Set(pks);
  const found: IndependentJoinRowV1[] = [];
  for (const row of join.rows) {
    if (!allowed.has(row.identity.gamePk)) continue;
    found.push(row);
  }
  if (found.length !== pks.length) {
    throw new IndependentLogisticError(
      "PARTITION_ROW_COUNT",
      `${found.length} != ${pks.length}`,
    );
  }
  const rows: LogisticTrainRowV2b[] = found.map((row) => {
    const target = row.label.target;
    if (target !== 0 && target !== 1) {
      throw new IndependentLogisticError(
        "LABEL_TARGET_INVALID",
        `gamePk ${row.identity.gamePk}`,
      );
    }
    return {
      gamePk: row.identity.gamePk,
      officialDate: row.identity.officialDate,
      commenceTimeUtc: row.identity.commenceTimeUtc,
      target,
      feature: row.feature,
    };
  });
  rows.sort(compareTrainOrder);
  return rows;
}

function rowsInWindows(
  rows: LogisticTrainRowV2b[],
  windowIds: readonly string[],
): LogisticTrainRowV2b[] {
  const windows = TRAIN_TEMPORAL_WINDOWS_V2B.filter((w) =>
    windowIds.includes(w.id),
  );
  return rows.filter((r) =>
    windows.some((w) => dateInWindow(r.officialDate, w.start, w.end)),
  );
}

function evalSummary(
  spec: "v2a" | "v2b",
  fitN: number,
  rows: Array<{ target: 0 | 1; probability: number }>,
): RollingSpecMetricsV2b {
  const y = rows.map((r) => r.target);
  const p = rows.map((r) => r.probability);
  const m = evaluateProbabilitiesV1(y, p);
  const rocAuc = rocAucMannWhitney(y, p);
  return {
    spec,
    fitN,
    evalN: rows.length,
    actualHomeRate: m.actualHomeRate,
    rocAuc,
    accuracy: m.accuracy,
    logLoss: m.logLoss,
    brierScore: m.brierScore,
    meanProbability: m.meanPredictedProbability,
    meanProbabilityBias: m.meanPredictedProbability - m.actualHomeRate,
    predictedHomeClassRate: m.predictedHomeRate,
  };
}

function fitEvalV2a(
  fitRows: LogisticTrainRowV2b[],
  evalRowsIn: LogisticTrainRowV2b[],
): RollingSpecMetricsV2b {
  const asV2a = fitRows as unknown as LogisticTrainRowV2a[];
  const prep = fitTrainPreprocessorV2a(asV2a);
  const { X, y } = transformMatrixV2a(asV2a, prep);
  const fit = fitFullBatchLogisticV1(X, y, MLB_INDEPENDENT_LOGISTIC_MODEL_DIM_V2A);
  const scored = evalRowsIn.map((row) => ({
    target: row.target,
    probability: predictLogisticProbability(
      transformRowV2a(row.feature, prep),
      fit.weights,
      fit.intercept,
    ),
  }));
  return evalSummary("v2a", fitRows.length, scored);
}

function fitEvalV2b(
  fitRows: LogisticTrainRowV2b[],
  evalRowsIn: LogisticTrainRowV2b[],
): RollingSpecMetricsV2b {
  const prep = fitTrainPreprocessorV2b(fitRows);
  const { X, y } = transformMatrixV2b(fitRows, prep);
  const fit = fitFullBatchLogisticV1(X, y, MLB_INDEPENDENT_LOGISTIC_MODEL_DIM_V2B);
  const scored = evalRowsIn.map((row) => ({
    target: row.target,
    probability: predictLogisticProbability(
      transformRowV2b(row.feature, prep),
      fit.weights,
      fit.intercept,
    ),
  }));
  return evalSummary("v2b", fitRows.length, scored);
}

export function runTrainInternalRollingV2b(
  trainRows: LogisticTrainRowV2b[],
): {
  windowCounts: Array<{ id: string; n: number }>;
  folds: RollingFoldResultV2b[];
  aggregate: {
    meanAucDelta: number;
    medianAucDelta: number;
    meanLogLossDelta: number;
    meanBrierDelta: number;
    foldsWithHigherAuc: number;
    foldsWithLowerLogLoss: number;
    foldsWithLowerBrier: number;
  };
} {
  if (trainRows.length !== 1463) {
    throw new IndependentLogisticError("PARTITION_ROW_COUNT", `${trainRows.length}`);
  }
  const windowCounts = TRAIN_TEMPORAL_WINDOWS_V2B.map((w) => {
    const n = trainRows.filter((r) =>
      dateInWindow(r.officialDate, w.start, w.end),
    ).length;
    if (n !== w.expectedN) {
      throw new IndependentLogisticError(
        "TRAIN_WINDOW_COUNT_MISMATCH",
        `${w.id} n=${n} expected=${w.expectedN}`,
      );
    }
    return { id: w.id, n };
  });
  const assigned = windowCounts.reduce((s, w) => s + w.n, 0);
  if (assigned !== 1463) {
    throw new IndependentLogisticError("TRAIN_WINDOW_COVERAGE", `${assigned}`);
  }

  const folds: RollingFoldResultV2b[] = ROLLING_FOLDS_V2B.map((fold) => {
    const fitRows = rowsInWindows(trainRows, fold.fit);
    const evalRowsIn = rowsInWindows(trainRows, [fold.eval]);
    const v2a = fitEvalV2a(fitRows, evalRowsIn);
    const v2b = fitEvalV2b(fitRows, evalRowsIn);
    return {
      id: fold.id,
      fitWindows: [...fold.fit],
      evalWindow: fold.eval,
      v2a,
      v2b,
      v2bMinusV2aAuc: v2b.rocAuc - v2a.rocAuc,
      v2bMinusV2aLogLoss: v2b.logLoss - v2a.logLoss,
      v2bMinusV2aBrier: v2b.brierScore - v2a.brierScore,
      v2bMinusV2aAbsProbabilityBias:
        Math.abs(v2b.meanProbabilityBias) - Math.abs(v2a.meanProbabilityBias),
    };
  });
  const aucDeltas = folds.map((f) => f.v2bMinusV2aAuc);
  const logLossDeltas = folds.map((f) => f.v2bMinusV2aLogLoss);
  const brierDeltas = folds.map((f) => f.v2bMinusV2aBrier);
  return {
    windowCounts,
    folds,
    aggregate: {
      meanAucDelta: mean(aucDeltas),
      medianAucDelta: medianOf(aucDeltas),
      meanLogLossDelta: mean(logLossDeltas),
      meanBrierDelta: mean(brierDeltas),
      foldsWithHigherAuc: aucDeltas.filter((d) => d > 0).length,
      foldsWithLowerLogLoss: logLossDeltas.filter((d) => d < 0).length,
      foldsWithLowerBrier: brierDeltas.filter((d) => d < 0).length,
    },
  };
}

function evalRowsV2b(
  rows: LogisticTrainRowV2b[],
  prep: LogisticPreprocessorV2b,
  weights: number[],
  intercept: number,
): LogisticEvalRowV2b[] {
  return rows.map((row) => {
    const x = transformRowV2b(row.feature, prep);
    const probability = predictLogisticProbability(x, weights, intercept);
    const predictedClass: 0 | 1 =
      probability >= MLB_INDEPENDENT_LOGISTIC_THRESHOLD_V1 ? 1 : 0;
    return {
      gamePk: row.gamePk,
      officialDate: row.officialDate,
      commenceTimeUtc: row.commenceTimeUtc,
      target: row.target,
      probability,
      predictedClass,
      correct: predictedClass === row.target,
    };
  });
}

export function partitionMeanLogitV2b(
  rows: LogisticTrainRowV2b[],
  prep: LogisticPreprocessorV2b,
  weights: number[],
  intercept: number,
): {
  directMeanLogit: number;
  meanFromFeatureMeans: number;
  transformedMeans: number[];
} {
  const dim = MLB_INDEPENDENT_LOGISTIC_MODEL_DIM_V2B;
  const sums = new Array<number>(dim).fill(0);
  const logits: number[] = [];
  for (const row of rows) {
    const x = transformRowV2b(row.feature, prep);
    let z = intercept;
    for (let j = 0; j < dim; j += 1) {
      z += weights[j]! * x[j]!;
      sums[j]! += x[j]!;
    }
    logits.push(z);
  }
  const n = rows.length;
  const transformedMeans = sums.map((s) => s / n);
  let meanFromFeatureMeans = intercept;
  for (let j = 0; j < dim; j += 1) {
    meanFromFeatureMeans += weights[j]! * transformedMeans[j]!;
  }
  return {
    directMeanLogit: mean(logits),
    meanFromFeatureMeans,
    transformedMeans,
  };
}

export function interpretStreakRestAblationV2b(input: {
  v2aAuc: number;
  v2bAuc: number;
  v2aLogLoss: number;
  v2bLogLoss: number;
  v2aBrier: number;
  v2bBrier: number;
}): AblationResearchInterpretationV2b {
  const aucImproved = input.v2bAuc > input.v2aAuc + 1e-6;
  const aucWorse = input.v2bAuc < input.v2aAuc - 1e-6;
  const logLossImproved = input.v2bLogLoss < input.v2aLogLoss - 1e-6;
  const logLossWorse = input.v2bLogLoss > input.v2aLogLoss + 1e-6;
  const brierImproved = input.v2bBrier < input.v2aBrier - 1e-6;
  const brierWorse = input.v2bBrier > input.v2aBrier + 1e-6;
  const qualityMateriallyWorse = logLossWorse || brierWorse;
  if (aucImproved && !qualityMateriallyWorse) {
    return "SUPPORTS_STREAK_REST_ABLATION";
  }
  if (aucWorse && qualityMateriallyWorse && !logLossImproved && !brierImproved) {
    return "DOES_NOT_SUPPORT_STREAK_REST_ABLATION";
  }
  return "MIXED_STREAK_REST_ABLATION_RESULT";
}

export function trainIndependentLogisticStreakRestAblationV2b(
  join: IndependentJoinArtifactV1,
  split: IndependentSplitArtifactV1,
  options: {
    sourceJoinHash: string;
    v1ModelCoreHash: string;
    v2aModelCoreHash: string;
    v2aValidation: FrozenV2aEvalRowV2b[];
    generatedAt?: string;
  },
): {
  model: IndependentLogisticModelArtifactV2b;
  evaluation: {
    schemaVersion: "mlb-independent-logistic-streak-rest-ablation-v2b-eval";
    builderVersion: typeof MLB_INDEPENDENT_LOGISTIC_BUILDER_VERSION_V2B;
    researchOnly: true;
    engineAdmission: typeof MLB_INDEPENDENT_ENGINE_ADMISSION;
    holdoutEvaluated: false;
    modelCoreHash: string;
    train: LogisticEvalRowV2b[];
    validation: LogisticEvalRowV2b[];
  };
  rolling: Record<string, unknown>;
  audit: Record<string, unknown>;
} {
  const specBeforeRolling = orderedLogisticModelFeatureNamesV2b();
  assertLogisticFeatureSpecV2b();
  verifySealedSplitForTrainingV1(join, split, options.sourceJoinHash);
  if (options.v1ModelCoreHash !== MLB_INDEPENDENT_2024_SEALED_V1_MODEL_CORE_HASH_V2B) {
    throw new IndependentLogisticError(
      "V1_MODEL_CORE_HASH_PIN_MISMATCH",
      options.v1ModelCoreHash,
    );
  }
  if (options.v2aModelCoreHash !== MLB_INDEPENDENT_2024_SEALED_V2A_MODEL_CORE_HASH_V2B) {
    throw new IndependentLogisticError(
      "V2A_MODEL_CORE_HASH_PIN_MISMATCH",
      options.v2aModelCoreHash,
    );
  }
  if (split.splitManifestHash !== MLB_INDEPENDENT_2024_SEALED_SPLIT_MANIFEST_HASH_V1) {
    throw new IndependentLogisticError(
      "SEALED_SPLIT_MANIFEST_HASH_MISMATCH",
      split.splitManifestHash,
    );
  }
  if (split.holdoutGamePks.length !== 483) {
    throw new IndependentLogisticError(
      "HOLDOUT_SEAL_INVALID",
      `${split.holdoutGamePks.length}`,
    );
  }
  const identityPks = new Set(join.rows.map((r) => r.identity.gamePk));
  for (const pk of split.holdoutGamePks) {
    if (!identityPks.has(pk)) {
      throw new IndependentLogisticError("HOLDOUT_MEMBERSHIP_MISSING", `${pk}`);
    }
  }

  const ablation = auditFeatureAblationV2b();
  const trainRows = labeledRowsForPks(join, split.trainGamePks);
  if (trainRows.length !== 1463) {
    throw new IndependentLogisticError("PARTITION_ROW_COUNT", `train=${trainRows.length}`);
  }
  const trainHomeCount = trainRows.filter((r) => r.target === 1).length;
  if (trainHomeCount !== 776) {
    throw new IndependentLogisticError("BASELINE_TRAIN_HOME_COUNT", `${trainHomeCount}`);
  }

  const specAfterRowLoad = orderedLogisticModelFeatureNamesV2b();
  if (JSON.stringify(specAfterRowLoad) !== JSON.stringify(specBeforeRolling)) {
    throw new IndependentLogisticError("V2B_SPEC_CHANGED_BEFORE_ROLLING", "spec");
  }

  const TRAIN_INTERNAL_ROLLING_COMPLETE_PRE = true;
  const rollingResult = runTrainInternalRollingV2b(trainRows);
  const TRAIN_INTERNAL_ROLLING_COMPLETE = TRAIN_INTERNAL_ROLLING_COMPLETE_PRE;
  const V2B_SPEC_FROZEN = JSON.stringify(orderedLogisticModelFeatureNamesV2b()) ===
    JSON.stringify(specBeforeRolling);

  if (!V2B_SPEC_FROZEN) {
    throw new IndependentLogisticError(
      "TRAIN_INTERNAL_FOLD_EVAL_CHANGED_FINAL_SPEC",
      "spec",
    );
  }

  const preprocessing = fitTrainPreprocessorV2b(trainRows);
  const { X, y } = transformMatrixV2b(trainRows, preprocessing);
  const fit = fitFullBatchLogisticV1(
    X,
    y,
    MLB_INDEPENDENT_LOGISTIC_MODEL_DIM_V2B,
  );
  const trainGamePkListHash = sha256Utf8(JSON.stringify(split.trainGamePks));
  const modelCore = {
    schema: "mlb-independent-logistic-core-v2b",
    modelType: "LOGISTIC_REGRESSION",
    experimentId: MLB_INDEPENDENT_LOGISTIC_EXPERIMENT_ID_V2B,
    target: "HOME_WIN",
    sourceJoinHash: options.sourceJoinHash,
    sourceSplitManifestHash: split.splitManifestHash,
    v1BaselineModelCoreHash: options.v1ModelCoreHash,
    v2aBaselineModelCoreHash: options.v2aModelCoreHash,
    trainGamePkListHash,
    orderedBaseFeatureNames: orderedLogisticBaseFeatureNamesV2b(),
    orderedMissingIndicatorNames: orderedLogisticMissingIndicatorNamesV2b(),
    orderedModelFeatureNames: orderedLogisticModelFeatureNamesV2b(),
    removedFeatures: [...MLB_INDEPENDENT_LOGISTIC_REMOVED_STREAK_REST_V2B],
    medianByFeature: preprocessing.medianByFeature,
    meanByFeature: preprocessing.meanByFeature,
    scaleByFeature: preprocessing.scaleByFeature,
    zeroVarianceFeatureNames: preprocessing.zeroVarianceFeatureNames,
    lambda: MLB_INDEPENDENT_LOGISTIC_LAMBDA_V1,
    threshold: MLB_INDEPENDENT_LOGISTIC_THRESHOLD_V1,
    interceptIncluded: true,
    interceptRegularized: false,
    optimizer: {
      type: "FULL_BATCH_GRADIENT_DESCENT_BACKTRACKING",
      initialStep: MLB_INDEPENDENT_LOGISTIC_INITIAL_STEP_V1,
      backtrackFactor: MLB_INDEPENDENT_LOGISTIC_BACKTRACK_V1,
      armijoConstant: MLB_INDEPENDENT_LOGISTIC_ARMIJO_V1,
      maxIterations: MLB_INDEPENDENT_LOGISTIC_MAX_ITERS_V1,
      gradientTolerance: MLB_INDEPENDENT_LOGISTIC_GRAD_TOL_V1,
      minimumStep: MLB_INDEPENDENT_LOGISTIC_MIN_STEP_V1,
    },
    intercept: fit.intercept,
    coefficients: fit.weights,
  };
  const modelCoreHash = hashModelCoreV2b(modelCore);
  const V2B_FULL_TRAIN_MODEL_FIT = true;
  const V2B_MODEL_CORE_HASH_CREATED = true;

  const trainEval = evalRowsV2b(trainRows, preprocessing, fit.weights, fit.intercept);
  const trainY = trainRows.map((r) => r.target);
  const trainMetrics = evaluateProbabilitiesV1(
    trainY,
    trainEval.map((r) => r.probability),
  );
  const trainRocAuc = rocAucMannWhitney(
    trainY,
    trainEval.map((r) => r.probability),
  );

  const validationRows = labeledRowsForPks(join, split.validationGamePks);
  if (validationRows.length !== 483) {
    throw new IndependentLogisticError(
      "PARTITION_ROW_COUNT",
      `validation=${validationRows.length}`,
    );
  }
  const validationEval = evalRowsV2b(
    validationRows,
    preprocessing,
    fit.weights,
    fit.intercept,
  );
  const VALIDATION_EVALUATION_AFTER_MODEL_FREEZE = true;
  const valY = validationRows.map((r) => r.target);
  const validationMetrics = evaluateProbabilitiesV1(
    valY,
    validationEval.map((r) => r.probability),
  );
  const validationRocAuc = rocAucMannWhitney(
    valY,
    validationEval.map((r) => r.probability),
  );
  const baselineTrainMetrics = constantBaselineMetricsV1(
    trainY,
    BASELINE_TRAIN_HOME_RATE_V2B,
  );
  const baselineValidationMetrics = constantBaselineMetricsV1(
    valY,
    BASELINE_TRAIN_HOME_RATE_V2B,
  );

  const trainLogit = partitionMeanLogitV2b(
    trainRows,
    preprocessing,
    fit.weights,
    fit.intercept,
  );
  const valLogit = partitionMeanLogitV2b(
    validationRows,
    preprocessing,
    fit.weights,
    fit.intercept,
  );
  if (
    Math.abs(trainLogit.directMeanLogit - trainLogit.meanFromFeatureMeans) >
    LOGIT_RECONCILE_TOLERANCE_V2B
  ) {
    throw new IndependentLogisticError("V2B_LOGIT_RECONCILIATION_FAIL", "train");
  }
  if (
    Math.abs(valLogit.directMeanLogit - valLogit.meanFromFeatureMeans) >
    LOGIT_RECONCILE_TOLERANCE_V2B
  ) {
    throw new IndependentLogisticError("V2B_LOGIT_RECONCILIATION_FAIL", "validation");
  }
  const v2bTotalLogitShift = valLogit.directMeanLogit - trainLogit.directMeanLogit;
  let sumFeatureShift = 0;
  for (let j = 0; j < MLB_INDEPENDENT_LOGISTIC_MODEL_DIM_V2B; j += 1) {
    sumFeatureShift +=
      fit.weights[j]! *
      (valLogit.transformedMeans[j]! - trainLogit.transformedMeans[j]!);
  }
  if (Math.abs(v2bTotalLogitShift - sumFeatureShift) > LOGIT_RECONCILE_TOLERANCE_V2B) {
    throw new IndependentLogisticError(
      "V2B_LOGIT_SHIFT_RECONCILIATION_FAIL",
      `${v2bTotalLogitShift} vs ${sumFeatureShift}`,
    );
  }

  const actualValHome = V2A_VALIDATION_ACTUAL_HOME_RATE_V2B;
  const v2bMeanP = validationMetrics.meanPredictedProbability;
  const v2bBias = v2bMeanP - actualValHome;
  const v2aMeanP = FROZEN_V2A_VALIDATION_V2B.meanPredictedProbability;
  const v2aBias = FROZEN_V2A_VALIDATION_V2B.meanProbabilityBias;
  const ece = fixedBinCalibrationTable(valY, validationEval.map((r) => r.probability));

  if (options.v2aValidation.length !== 483) {
    throw new IndependentLogisticError(
      "V2A_VALIDATION_COUNT",
      `${options.v2aValidation.length}`,
    );
  }
  const v2aValByPk = new Map(options.v2aValidation.map((r) => [r.gamePk, r]));
  const bins = VALIDATION_BINS_V2B.map((bin) => {
    const v2bSubset = validationEval.filter(
      (r) => r.officialDate >= bin.start && r.officialDate <= bin.end,
    );
    const v2aSubset = options.v2aValidation.filter((r) => {
      const date = r.officialDate;
      if (!date) {
        const match = validationEval.find((x) => x.gamePk === r.gamePk);
        return (
          match != null &&
          match.officialDate >= bin.start &&
          match.officialDate <= bin.end
        );
      }
      return date >= bin.start && date <= bin.end;
    });
    const v2bM = evaluateProbabilitiesV1(
      v2bSubset.map((r) => r.target),
      v2bSubset.map((r) => r.probability),
    );
    const v2aM = evaluateProbabilitiesV1(
      v2aSubset.map((r) => r.target),
      v2aSubset.map((r) => r.probability),
    );
    const v2bAuc = rocAucMannWhitney(
      v2bSubset.map((r) => r.target),
      v2bSubset.map((r) => r.probability),
    );
    const v2aAuc = rocAucMannWhitney(
      v2aSubset.map((r) => r.target),
      v2aSubset.map((r) => r.probability),
    );
    for (const row of v2bSubset) {
      if (!v2aValByPk.has(row.gamePk)) {
        throw new IndependentLogisticError(
          "V2A_VALIDATION_GAMEPK_MISSING",
          `${row.gamePk}`,
        );
      }
    }
    return {
      id: bin.id,
      start: bin.start,
      end: bin.end,
      n: v2bSubset.length,
      actualHomeRate: v2bM.actualHomeRate,
      v2bRocAuc: v2bAuc,
      v2aRocAuc: v2aAuc,
      v2bMeanProbability: v2bM.meanPredictedProbability,
      v2aMeanProbability: v2aM.meanPredictedProbability,
      v2bMeanProbabilityBias: v2bM.meanPredictedProbability - v2bM.actualHomeRate,
      v2aMeanProbabilityBias: v2aM.meanPredictedProbability - v2aM.actualHomeRate,
      v2bPredictedHomeClassRate: v2bM.predictedHomeRate,
      v2aPredictedHomeClassRate: v2aM.predictedHomeRate,
      v2bLogLoss: v2bM.logLoss,
      v2aLogLoss: v2aM.logLoss,
      v2bBrier: v2bM.brierScore,
      v2aBrier: v2aM.brierScore,
    };
  });

  const researchInterpretation = interpretStreakRestAblationV2b({
    v2aAuc: FROZEN_V2A_VALIDATION_V2B.rocAuc,
    v2bAuc: validationRocAuc,
    v2aLogLoss: FROZEN_V2A_VALIDATION_V2B.logLoss,
    v2bLogLoss: validationMetrics.logLoss,
    v2aBrier: FROZEN_V2A_VALIDATION_V2B.brierScore,
    v2bBrier: validationMetrics.brierScore,
  });

  const model: IndependentLogisticModelArtifactV2b = {
    schemaVersion: MLB_INDEPENDENT_LOGISTIC_SCHEMA_V2B,
    builderVersion: MLB_INDEPENDENT_LOGISTIC_BUILDER_VERSION_V2B,
    researchOnly: true,
    engineAdmission: MLB_INDEPENDENT_ENGINE_ADMISSION,
    target: "HOME_WIN",
    modelType: "LOGISTIC_REGRESSION",
    experimentId: MLB_INDEPENDENT_LOGISTIC_EXPERIMENT_ID_V2B,
    experimentType: MLB_INDEPENDENT_LOGISTIC_EXPERIMENT_TYPE_V2B,
    modelPrototype: true,
    modelCandidate: false,
    engineApproved: false,
    sourceJoinArtifactHash: options.sourceJoinHash,
    sourceSplitManifestHash: split.splitManifestHash,
    v1BaselineModelCoreHash: options.v1ModelCoreHash,
    v2aBaselineModelCoreHash: options.v2aModelCoreHash,
    trainingSampleCount: 1463,
    validationSampleCount: 483,
    holdoutSampleCount: 483,
    holdoutEvaluated: false,
    featureSpec: {
      orderedBaseFeatureNames: orderedLogisticBaseFeatureNamesV2b(),
      orderedMissingIndicatorNames: orderedLogisticMissingIndicatorNamesV2b(),
      orderedModelFeatureNames: orderedLogisticModelFeatureNamesV2b(),
      baseDimensions: MLB_INDEPENDENT_LOGISTIC_BASE_DIM_V2B,
      missingIndicators: MLB_INDEPENDENT_LOGISTIC_MISSING_DIM_V2B,
      modelDimensions: MLB_INDEPENDENT_LOGISTIC_MODEL_DIM_V2B,
      removedFeatures: [...MLB_INDEPENDENT_LOGISTIC_REMOVED_STREAK_REST_V2B],
    },
    preprocessing,
    hyperparameters: {
      lambda: MLB_INDEPENDENT_LOGISTIC_LAMBDA_V1,
      intercept: true,
      interceptRegularized: false,
      threshold: MLB_INDEPENDENT_LOGISTIC_THRESHOLD_V1,
      initialWeights: 0,
      initialIntercept: 0,
    },
    optimizer: {
      type: "FULL_BATCH_GRADIENT_DESCENT_BACKTRACKING",
      initialStep: MLB_INDEPENDENT_LOGISTIC_INITIAL_STEP_V1,
      backtrackFactor: MLB_INDEPENDENT_LOGISTIC_BACKTRACK_V1,
      armijoConstant: MLB_INDEPENDENT_LOGISTIC_ARMIJO_V1,
      maxIterations: MLB_INDEPENDENT_LOGISTIC_MAX_ITERS_V1,
      gradientTolerance: MLB_INDEPENDENT_LOGISTIC_GRAD_TOL_V1,
      minimumStep: MLB_INDEPENDENT_LOGISTIC_MIN_STEP_V1,
      result: {
        intercept: fit.intercept,
        iterations: fit.iterations,
        converged: fit.converged,
        initialObjective: fit.initialObjective,
        finalObjective: fit.finalObjective,
        finalGradientNorm: fit.finalGradientNorm,
        weightL2Norm: fit.weightL2Norm,
      },
    },
    intercept: fit.intercept,
    coefficients: fit.weights,
    modelCoreHash,
  };

  const evaluation = {
    schemaVersion: "mlb-independent-logistic-streak-rest-ablation-v2b-eval" as const,
    builderVersion: MLB_INDEPENDENT_LOGISTIC_BUILDER_VERSION_V2B,
    researchOnly: true as const,
    engineAdmission: MLB_INDEPENDENT_ENGINE_ADMISSION,
    holdoutEvaluated: false as const,
    modelCoreHash,
    train: trainEval,
    validation: validationEval,
  };

  const rolling = {
    schemaVersion: "mlb-independent-logistic-streak-rest-ablation-v2b-train-rolling-v1",
    builderVersion: MLB_INDEPENDENT_LOGISTIC_BUILDER_VERSION_V2B,
    researchOnly: true,
    modelCandidate: false,
    holdoutEvaluated: false,
    TRAIN_INTERNAL_ROLLING_COMPLETE,
    V2B_SPEC_FROZEN,
    frozenFeatureNames: specBeforeRolling,
    windowCounts: rollingResult.windowCounts,
    folds: rollingResult.folds,
    aggregate: rollingResult.aggregate,
    note: "Rolling folds are entirely inside official TRAIN. They do not replace the sealed full-TRAIN v2-A model. Fold eval did not change the pre-registered v2-B spec.",
  };

  const aucRetention =
    trainRocAuc === 0 ? null : validationRocAuc / trainRocAuc;
  const audit = {
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    researchOnly: true,
    engineAdmission: "PROHIBITED",
    modelCandidate: false,
    engineApproved: false,
    holdoutEvaluated: false,
    sourceJoinArtifactHash: options.sourceJoinHash,
    sourceSplitManifestHash: split.splitManifestHash,
    v1BaselineModelCoreHash: options.v1ModelCoreHash,
    v2aBaselineModelCoreHash: options.v2aModelCoreHash,
    trainingSampleCount: 1463,
    validationSampleCount: 483,
    holdoutMembershipCount: 483,
    holdoutFeatureRowsRead: 0,
    holdoutLabelRowsRead: 0,
    holdoutTransformedRows: 0,
    holdoutProbabilitiesCreated: 0,
    baseDimensions: 23,
    missingIndicators: 22,
    modelDimensions: 45,
    preprocessingFitPartition: "TRAIN",
    zeroVarianceFeatureNames: preprocessing.zeroVarianceFeatureNames,
    optimizer: fit,
    modelCoreHash,
    ablation,
    TRAIN_INTERNAL_ROLLING_COMPLETE,
    V2B_SPEC_FROZEN,
    V2B_FULL_TRAIN_MODEL_FIT,
    V2B_MODEL_CORE_HASH_CREATED,
    VALIDATION_EVALUATION_AFTER_MODEL_FREEZE,
    VALIDATION_HAS_BEEN_USED_FOR_MODEL_RESEARCH: true,
    LATE_ONLY_FEATURE_ADDED: false,
    T3H_COMPATIBILITY_CHANGED: false,
    trainMetrics,
    trainRocAuc,
    validationMetrics,
    validationRocAuc,
    baselineTrainHomeRate: BASELINE_TRAIN_HOME_RATE_V2B,
    baselineTrainMetrics,
    baselineValidationMetrics,
    v2bMinusV2a: {
      auc: validationRocAuc - FROZEN_V2A_VALIDATION_V2B.rocAuc,
      accuracy: validationMetrics.accuracy - FROZEN_V2A_VALIDATION_V2B.accuracy,
      logLoss: validationMetrics.logLoss - FROZEN_V2A_VALIDATION_V2B.logLoss,
      brierScore: validationMetrics.brierScore - FROZEN_V2A_VALIDATION_V2B.brierScore,
      predictedHomeRate:
        validationMetrics.predictedHomeRate -
        FROZEN_V2A_VALIDATION_V2B.predictedHomeRate,
      meanProbability: v2bMeanP - v2aMeanP,
      absMeanProbabilityBias: Math.abs(v2bBias) - Math.abs(v2aBias),
    },
    v2bMinusConstant: {
      logLoss: validationMetrics.logLoss - baselineValidationMetrics.logLoss,
      brierScore: validationMetrics.brierScore - baselineValidationMetrics.brierScore,
      auc: validationRocAuc - 0.5,
    },
    discriminationTransfer: {
      trainRocAuc,
      validationRocAuc,
      aucRetention,
      absoluteDrop: validationRocAuc - trainRocAuc,
      v2aTrainRocAuc: FROZEN_V2A_VALIDATION_V2B.trainRocAuc,
      v2aValidationRocAuc: FROZEN_V2A_VALIDATION_V2B.rocAuc,
      v2aAbsoluteDrop:
        FROZEN_V2A_VALIDATION_V2B.rocAuc - FROZEN_V2A_VALIDATION_V2B.trainRocAuc,
    },
    probabilityBias: {
      actualValidationHomeRate: actualValHome,
      v2aMeanProbability: v2aMeanP,
      v2aMeanProbabilityBias: v2aBias,
      v2aAbsMeanProbabilityBias: Math.abs(v2aBias),
      v2bMeanProbability: v2bMeanP,
      v2bMeanProbabilityBias: v2bBias,
      v2bAbsMeanProbabilityBias: Math.abs(v2bBias),
    },
    calibration: {
      actualHomeRate: actualValHome,
      meanPredictedProbability: v2bMeanP,
      signedMeanProbabilityBias: v2bBias,
      absoluteMeanProbabilityBias: Math.abs(v2bBias),
      validationFixedBinECE: ece.ece,
      bins: ece.bins,
      applied: false,
    },
    logitShift: {
      trainMeanLogit: trainLogit.directMeanLogit,
      validationMeanLogit: valLogit.directMeanLogit,
      trainMeanLogitFromFeatureMeans: trainLogit.meanFromFeatureMeans,
      validationMeanLogitFromFeatureMeans: valLogit.meanFromFeatureMeans,
      v2bTotalLogitShift,
      sumFeatureShiftContributions: sumFeatureShift,
      logitShiftReconciliation: "PASS",
      v1TotalLogitShift: V1_TOTAL_LOGIT_SHIFT_V2B,
      v2aTotalLogitShift: V2A_TOTAL_LOGIT_SHIFT_V2B,
    },
    validationChronologicalBins: bins,
    rollingAggregate: rollingResult.aggregate,
    researchInterpretation,
    interpretationNote:
      "Descriptive only. Validation AUC is central because weak discrimination is the primary remaining issue, but AUC improvement alone is insufficient if probability quality materially deteriorates. Not an Engine decision and not automatic promotion to a model candidate. Validation has already been used for prior research, so it is not an untouched final estimate. Holdout stays sealed.",
    marketUsed: false,
    networkUsed: false,
    engineChanged: false,
  };

  return { model, evaluation, rolling, audit };
}

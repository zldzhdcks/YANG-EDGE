/**
 * Independent Logistic HEAD_TO_HEAD Ablation Prototype v2-C.
 * TRAIN rolling replay of sealed H2H leave-one-group-out, then full-TRAIN freeze,
 * then one aggregate Validation evaluation. HOLDOUT sealed. No Validation slicing.
 * Does not modify frozen v1 / v2-A / v2-B modules.
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
} from "../independent-logistic-v1/metrics";
import { rocAucMannWhitney } from "../independent-logistic-v2a-diagnostic-v1";
import { MLB_INDEPENDENT_LOGISTIC_MODEL_DIM_V2B } from "../independent-logistic-v2b/spec";
import {
  fitTrainPreprocessorV2b,
  transformMatrixV2b,
  transformRowV2b,
  type LogisticTrainRowV2b,
} from "../independent-logistic-v2b/preprocess";
import {
  ROLLING_FOLDS_V2B,
  TRAIN_TEMPORAL_WINDOWS_V2B,
} from "../independent-logistic-v2b/train";
import {
  IndependentLogisticError,
  MLB_INDEPENDENT_2024_SEALED_V1_MODEL_CORE_HASH_V2C,
  MLB_INDEPENDENT_2024_SEALED_V2A_MODEL_CORE_HASH_V2C,
  MLB_INDEPENDENT_2024_SEALED_V2B_MODEL_CORE_HASH_V2C,
  MLB_INDEPENDENT_LOGISTIC_BASE_DIM_V2C,
  MLB_INDEPENDENT_LOGISTIC_EXPERIMENT_ID_V2C,
  MLB_INDEPENDENT_LOGISTIC_EXPERIMENT_TYPE_V2C,
  MLB_INDEPENDENT_LOGISTIC_MISSING_DIM_V2C,
  MLB_INDEPENDENT_LOGISTIC_MODEL_DIM_V2C,
  MLB_INDEPENDENT_LOGISTIC_REMOVED_H2H_V2C,
  assertLogisticFeatureSpecV2c,
  auditFeatureAblationV2c,
  orderedLogisticBaseFeatureNamesV2c,
  orderedLogisticMissingIndicatorNamesV2c,
  orderedLogisticModelFeatureNamesV2c,
} from "./spec";
import {
  fitTrainPreprocessorV2c,
  transformMatrixV2c,
  transformRowV2c,
  type LogisticPreprocessorV2c,
  type LogisticTrainRowV2c,
} from "./preprocess";

export const MLB_INDEPENDENT_LOGISTIC_SCHEMA_V2C =
  "mlb-independent-logistic-head-to-head-ablation-v2c" as const;
export const MLB_INDEPENDENT_LOGISTIC_BUILDER_VERSION_V2C =
  "mlb-independent-logistic-v2c" as const;

export const BASELINE_TRAIN_HOME_RATE_V2C = 776 / 1463;
export const LOGIT_RECONCILE_TOLERANCE_V2C = 1e-12;
export const H2H_REPLAY_TOLERANCE_V2C = 1e-12;
export const V1_TOTAL_LOGIT_SHIFT_V2C = 0.2417182727197169;
export const V2A_TOTAL_LOGIT_SHIFT_V2C = 0.03245128717505322;
export const V2B_TOTAL_LOGIT_SHIFT_V2C = 0.021037301018044838;

export const FROZEN_V2B_TRAIN_V2C = {
  rocAuc: 0.6005501658188148,
  accuracy: 0.5768967874231032,
  logLoss: 0.6780678155260765,
  brierScore: 0.24250463391642488,
  actualHomeRate: 0.530416951469583,
  meanPredictedProbability: 0.5304169545544264,
} as const;

export const FROZEN_V2B_VALIDATION_V2C = {
  rocAuc: 0.5471445721145601,
  accuracy: 0.5631469979296067,
  logLoss: 0.6923976944705145,
  brierScore: 0.2495718525450235,
  meanPredictedProbability: 0.5356691280681309,
  actualHomeRate: 0.5072463768115942,
  meanProbabilityBias: 0.028422751256536705,
  predictedHomeRate: 0.7577639751552795,
} as const;

export const SEALED_H2H_LEAVE_ONE_GROUP_ROLLING_V2C = {
  FOLD_1: {
    fitN: 452,
    evalN: 409,
    rocAuc: 0.5976110038610039,
    logLoss: 0.6837777774613407,
    brierScore: 0.2453135137209121,
    accuracy: 0.5721271393643031,
    actualHomeRate: 0.5476772616136919,
    meanPredictedProbability: 0.4848835550353531,
    signedProbabilityBias: -0.06279370657833883,
    predictedHomeClassRate: 0.4034229828850856,
  },
  FOLD_2: {
    fitN: 861,
    evalN: 401,
    rocAuc: 0.5336299563938749,
    logLoss: 0.6911080100699022,
    brierScore: 0.248980753090234,
    accuracy: 0.5411471321695761,
    actualHomeRate: 0.5685785536159601,
    meanPredictedProbability: 0.5172181958966092,
    signedProbabilityBias: -0.05136035771935088,
    predictedHomeClassRate: 0.5835411471321695,
  },
  FOLD_3: {
    fitN: 1262,
    evalN: 201,
    rocAuc: 0.5177722772277228,
    logLoss: 0.6991963766150874,
    brierScore: 0.252910253104634,
    accuracy: 0.4975124378109453,
    actualHomeRate: 0.5024875621890548,
    meanPredictedProbability: 0.538323554886244,
    signedProbabilityBias: 0.03583599269718918,
    predictedHomeClassRate: 0.746268656716418,
  },
} as const;

export function independentLogisticV2cModelRel(): string {
  return "data/research/mlb/independent-model-v1/model/2024-logistic-regression-head-to-head-ablation-v2c.json";
}
export function independentLogisticV2cModelPath(cwd = process.cwd()): string {
  return path.join(cwd, independentLogisticV2cModelRel());
}
export function independentLogisticV2cEvalRel(): string {
  return "data/research/mlb/independent-model-v1/evaluations/2024-logistic-regression-head-to-head-ablation-v2c-train-validation.json";
}
export function independentLogisticV2cEvalPath(cwd = process.cwd()): string {
  return path.join(cwd, independentLogisticV2cEvalRel());
}
export function independentLogisticV2cRollingRel(): string {
  return "data/research/mlb/independent-model-v1/diagnostics/2024-logistic-head-to-head-ablation-v2c-train-rolling-replay-v1.json";
}
export function independentLogisticV2cRollingPath(cwd = process.cwd()): string {
  return path.join(cwd, independentLogisticV2cRollingRel());
}
export function independentLogisticV2cAuditRel(): string {
  return "data/research/mlb/independent-model-v1/audits/2024-logistic-regression-head-to-head-ablation-v2c-audit.json";
}
export function independentLogisticV2cAuditPath(cwd = process.cwd()): string {
  return path.join(cwd, independentLogisticV2cAuditRel());
}

function sha256Utf8(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

export function hashModelCoreV2c(core: Record<string, unknown>): string {
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

function dateInWindow(officialDate: string, start: string, end: string): boolean {
  return officialDate >= start && officialDate <= end;
}

function withinTol(a: number, b: number, tol = H2H_REPLAY_TOLERANCE_V2C): boolean {
  return Math.abs(a - b) <= tol;
}

export type LogisticEvalRowV2c = {
  gamePk: number;
  officialDate: string;
  commenceTimeUtc: string;
  target: 0 | 1;
  probability: number;
  predictedClass: 0 | 1;
  correct: boolean;
};

export type RollingSpecMetricsV2c = {
  spec: "v2b" | "v2c";
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

export type RollingFoldResultV2c = {
  id: string;
  fitWindows: string[];
  evalWindow: string;
  v2b: RollingSpecMetricsV2c;
  v2c: RollingSpecMetricsV2c;
  v2cMinusV2bAuc: number;
  v2cMinusV2bLogLoss: number;
  v2cMinusV2bBrier: number;
  H2H_ROLLING_REPLAY: "PASS";
};

export type AblationResearchInterpretationV2c =
  | "SUPPORTS_H2H_ABLATION"
  | "MIXED_H2H_ABLATION_RESULT"
  | "DOES_NOT_SUPPORT_H2H_ABLATION";

export type IndependentLogisticModelArtifactV2c = {
  schemaVersion: typeof MLB_INDEPENDENT_LOGISTIC_SCHEMA_V2C;
  builderVersion: typeof MLB_INDEPENDENT_LOGISTIC_BUILDER_VERSION_V2C;
  researchOnly: true;
  engineAdmission: typeof MLB_INDEPENDENT_ENGINE_ADMISSION;
  target: "HOME_WIN";
  modelType: "LOGISTIC_REGRESSION";
  experimentId: typeof MLB_INDEPENDENT_LOGISTIC_EXPERIMENT_ID_V2C;
  experimentType: typeof MLB_INDEPENDENT_LOGISTIC_EXPERIMENT_TYPE_V2C;
  modelPrototype: true;
  modelCandidate: false;
  engineApproved: false;
  sourceJoinArtifactHash: string;
  sourceSplitManifestHash: string;
  v1BaselineModelCoreHash: string;
  v2aBaselineModelCoreHash: string;
  v2bBaselineModelCoreHash: string;
  trainingSampleCount: number;
  validationSampleCount: number;
  holdoutSampleCount: number;
  holdoutEvaluated: false;
  featureSpec: {
    orderedBaseFeatureNames: string[];
    orderedMissingIndicatorNames: string[];
    orderedModelFeatureNames: string[];
    baseDimensions: 20;
    missingIndicators: 22;
    modelDimensions: 42;
    removedFeatures: string[];
  };
  preprocessing: LogisticPreprocessorV2c;
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
): LogisticTrainRowV2c[] {
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
  const rows: LogisticTrainRowV2c[] = found.map((row) => {
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
  rows: LogisticTrainRowV2c[],
  windowIds: readonly string[],
): LogisticTrainRowV2c[] {
  const windows = TRAIN_TEMPORAL_WINDOWS_V2B.filter((w) =>
    windowIds.includes(w.id),
  );
  return rows.filter((r) =>
    windows.some((w) => dateInWindow(r.officialDate, w.start, w.end)),
  );
}

function evalSummary(
  spec: "v2b" | "v2c",
  fitN: number,
  rows: Array<{ target: 0 | 1; probability: number }>,
): RollingSpecMetricsV2c {
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

function fitEvalV2b(
  fitRows: LogisticTrainRowV2c[],
  evalRowsIn: LogisticTrainRowV2c[],
): RollingSpecMetricsV2c {
  const asV2b = fitRows as unknown as LogisticTrainRowV2b[];
  const prep = fitTrainPreprocessorV2b(asV2b);
  const { X, y } = transformMatrixV2b(asV2b, prep);
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

function fitEvalV2c(
  fitRows: LogisticTrainRowV2c[],
  evalRowsIn: LogisticTrainRowV2c[],
): RollingSpecMetricsV2c {
  const prep = fitTrainPreprocessorV2c(fitRows);
  const { X, y } = transformMatrixV2c(fitRows, prep);
  const fit = fitFullBatchLogisticV1(X, y, MLB_INDEPENDENT_LOGISTIC_MODEL_DIM_V2C);
  const scored = evalRowsIn.map((row) => ({
    target: row.target,
    probability: predictLogisticProbability(
      transformRowV2c(row.feature, prep),
      fit.weights,
      fit.intercept,
    ),
  }));
  return evalSummary("v2c", fitRows.length, scored);
}

function replayH2hFold(
  actual: RollingSpecMetricsV2c,
  sealed: (typeof SEALED_H2H_LEAVE_ONE_GROUP_ROLLING_V2C)[keyof typeof SEALED_H2H_LEAVE_ONE_GROUP_ROLLING_V2C],
): boolean {
  return (
    actual.fitN === sealed.fitN &&
    actual.evalN === sealed.evalN &&
    withinTol(actual.rocAuc, sealed.rocAuc) &&
    withinTol(actual.logLoss, sealed.logLoss) &&
    withinTol(actual.brierScore, sealed.brierScore) &&
    withinTol(actual.accuracy, sealed.accuracy) &&
    withinTol(actual.actualHomeRate, sealed.actualHomeRate) &&
    withinTol(actual.meanProbability, sealed.meanPredictedProbability) &&
    withinTol(actual.meanProbabilityBias, sealed.signedProbabilityBias) &&
    withinTol(actual.predictedHomeClassRate, sealed.predictedHomeClassRate)
  );
}

export function runTrainInternalRollingReplayV2c(
  trainRows: LogisticTrainRowV2c[],
): {
  windowCounts: Array<{ id: string; n: number }>;
  folds: RollingFoldResultV2c[];
  H2H_ROLLING_FOLD_1_REPLAY: "PASS";
  H2H_ROLLING_FOLD_2_REPLAY: "PASS";
  H2H_ROLLING_FOLD_3_REPLAY: "PASS";
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

  const folds: RollingFoldResultV2c[] = ROLLING_FOLDS_V2B.map((fold) => {
    const fitRows = rowsInWindows(trainRows, fold.fit);
    const evalRowsIn = rowsInWindows(trainRows, [fold.eval]);
    const v2b = fitEvalV2b(fitRows, evalRowsIn);
    const v2c = fitEvalV2c(fitRows, evalRowsIn);
    const sealed =
      SEALED_H2H_LEAVE_ONE_GROUP_ROLLING_V2C[
        fold.id as keyof typeof SEALED_H2H_LEAVE_ONE_GROUP_ROLLING_V2C
      ];
    if (!replayH2hFold(v2c, sealed)) {
      throw new IndependentLogisticError(
        "H2H_ROLLING_REPLAY_FAIL",
        JSON.stringify({ id: fold.id, actual: v2c, sealed }),
      );
    }
    return {
      id: fold.id,
      fitWindows: [...fold.fit],
      evalWindow: fold.eval,
      v2b,
      v2c,
      v2cMinusV2bAuc: v2c.rocAuc - v2b.rocAuc,
      v2cMinusV2bLogLoss: v2c.logLoss - v2b.logLoss,
      v2cMinusV2bBrier: v2c.brierScore - v2b.brierScore,
      H2H_ROLLING_REPLAY: "PASS",
    };
  });
  return {
    windowCounts,
    folds,
    H2H_ROLLING_FOLD_1_REPLAY: "PASS",
    H2H_ROLLING_FOLD_2_REPLAY: "PASS",
    H2H_ROLLING_FOLD_3_REPLAY: "PASS",
  };
}

function evalRowsV2c(
  rows: LogisticTrainRowV2c[],
  prep: LogisticPreprocessorV2c,
  weights: number[],
  intercept: number,
): LogisticEvalRowV2c[] {
  return rows.map((row) => {
    const x = transformRowV2c(row.feature, prep);
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

export function partitionMeanLogitV2c(
  rows: LogisticTrainRowV2c[],
  prep: LogisticPreprocessorV2c,
  weights: number[],
  intercept: number,
): {
  directMeanLogit: number;
  meanFromFeatureMeans: number;
  transformedMeans: number[];
} {
  const dim = MLB_INDEPENDENT_LOGISTIC_MODEL_DIM_V2C;
  const sums = new Array<number>(dim).fill(0);
  const logits: number[] = [];
  for (const row of rows) {
    const x = transformRowV2c(row.feature, prep);
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

export function interpretHeadToHeadAblationV2c(input: {
  v2bAuc: number;
  v2cAuc: number;
  v2bLogLoss: number;
  v2cLogLoss: number;
  v2bBrier: number;
  v2cBrier: number;
}): AblationResearchInterpretationV2c {
  const aucImproved = input.v2cAuc > input.v2bAuc + 1e-6;
  const aucWorse = input.v2cAuc < input.v2bAuc - 1e-6;
  const logLossImproved = input.v2cLogLoss < input.v2bLogLoss - 1e-6;
  const logLossWorse = input.v2cLogLoss > input.v2bLogLoss + 1e-6;
  const brierImproved = input.v2cBrier < input.v2bBrier - 1e-6;
  const brierWorse = input.v2cBrier > input.v2bBrier + 1e-6;
  const qualityMateriallyWorse = logLossWorse || brierWorse;
  if (aucImproved && !qualityMateriallyWorse) {
    return "SUPPORTS_H2H_ABLATION";
  }
  if (aucWorse && qualityMateriallyWorse && !logLossImproved && !brierImproved) {
    return "DOES_NOT_SUPPORT_H2H_ABLATION";
  }
  return "MIXED_H2H_ABLATION_RESULT";
}

export function trainIndependentLogisticHeadToHeadAblationV2c(
  join: IndependentJoinArtifactV1,
  split: IndependentSplitArtifactV1,
  options: {
    sourceJoinHash: string;
    v1ModelCoreHash: string;
    v2aModelCoreHash: string;
    v2bModelCoreHash: string;
    generatedAt?: string;
  },
): {
  model: IndependentLogisticModelArtifactV2c;
  evaluation: {
    schemaVersion: "mlb-independent-logistic-head-to-head-ablation-v2c-eval";
    builderVersion: typeof MLB_INDEPENDENT_LOGISTIC_BUILDER_VERSION_V2C;
    researchOnly: true;
    engineAdmission: typeof MLB_INDEPENDENT_ENGINE_ADMISSION;
    holdoutEvaluated: false;
    modelCoreHash: string;
    train: LogisticEvalRowV2c[];
    validation: LogisticEvalRowV2c[];
  };
  rolling: Record<string, unknown>;
  audit: Record<string, unknown>;
} {
  const specBeforeRolling = orderedLogisticModelFeatureNamesV2c();
  assertLogisticFeatureSpecV2c();
  verifySealedSplitForTrainingV1(join, split, options.sourceJoinHash);
  if (options.v1ModelCoreHash !== MLB_INDEPENDENT_2024_SEALED_V1_MODEL_CORE_HASH_V2C) {
    throw new IndependentLogisticError(
      "V1_MODEL_CORE_HASH_PIN_MISMATCH",
      options.v1ModelCoreHash,
    );
  }
  if (options.v2aModelCoreHash !== MLB_INDEPENDENT_2024_SEALED_V2A_MODEL_CORE_HASH_V2C) {
    throw new IndependentLogisticError(
      "V2A_MODEL_CORE_HASH_PIN_MISMATCH",
      options.v2aModelCoreHash,
    );
  }
  if (options.v2bModelCoreHash !== MLB_INDEPENDENT_2024_SEALED_V2B_MODEL_CORE_HASH_V2C) {
    throw new IndependentLogisticError(
      "V2B_MODEL_CORE_HASH_PIN_MISMATCH",
      options.v2bModelCoreHash,
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
  for (const pk of split.validationGamePks) {
    if (!identityPks.has(pk)) {
      throw new IndependentLogisticError("VALIDATION_MEMBERSHIP_MISSING", `${pk}`);
    }
  }

  const ablation = auditFeatureAblationV2c();
  const trainRows = labeledRowsForPks(join, split.trainGamePks);
  if (trainRows.length !== 1463) {
    throw new IndependentLogisticError("PARTITION_ROW_COUNT", `train=${trainRows.length}`);
  }
  const trainHomeCount = trainRows.filter((r) => r.target === 1).length;
  if (trainHomeCount !== 776) {
    throw new IndependentLogisticError("BASELINE_TRAIN_HOME_COUNT", `${trainHomeCount}`);
  }

  const specAfterRowLoad = orderedLogisticModelFeatureNamesV2c();
  if (JSON.stringify(specAfterRowLoad) !== JSON.stringify(specBeforeRolling)) {
    throw new IndependentLogisticError("V2C_SPEC_CHANGED_BEFORE_ROLLING", "spec");
  }

  const rollingResult = runTrainInternalRollingReplayV2c(trainRows);
  const TRAIN_ROLLING_REPLAY_COMPLETE = true;
  const V2C_SPEC_FROZEN =
    JSON.stringify(orderedLogisticModelFeatureNamesV2c()) ===
    JSON.stringify(specBeforeRolling);
  if (!V2C_SPEC_FROZEN) {
    throw new IndependentLogisticError(
      "ROLLING_EVAL_VALUES_CHANGED_FINAL_SPEC",
      "spec",
    );
  }

  const preprocessing = fitTrainPreprocessorV2c(trainRows);
  const { X, y } = transformMatrixV2c(trainRows, preprocessing);
  const fit = fitFullBatchLogisticV1(
    X,
    y,
    MLB_INDEPENDENT_LOGISTIC_MODEL_DIM_V2C,
  );
  const trainGamePkListHash = sha256Utf8(JSON.stringify(split.trainGamePks));
  const modelCore = {
    schema: "mlb-independent-logistic-core-v2c",
    modelType: "LOGISTIC_REGRESSION",
    experimentId: MLB_INDEPENDENT_LOGISTIC_EXPERIMENT_ID_V2C,
    target: "HOME_WIN",
    sourceJoinHash: options.sourceJoinHash,
    sourceSplitManifestHash: split.splitManifestHash,
    v1BaselineModelCoreHash: options.v1ModelCoreHash,
    v2aBaselineModelCoreHash: options.v2aModelCoreHash,
    v2bBaselineModelCoreHash: options.v2bModelCoreHash,
    trainGamePkListHash,
    orderedBaseFeatureNames: orderedLogisticBaseFeatureNamesV2c(),
    orderedMissingIndicatorNames: orderedLogisticMissingIndicatorNamesV2c(),
    orderedModelFeatureNames: orderedLogisticModelFeatureNamesV2c(),
    removedFeatures: [...MLB_INDEPENDENT_LOGISTIC_REMOVED_H2H_V2C],
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
  const modelCoreHash = hashModelCoreV2c(modelCore);
  const V2C_FULL_TRAIN_MODEL_FIT = true;
  const V2C_MODEL_CORE_HASH_CREATED = true;
  const VALIDATION_FEATURE_ACCESS_ALLOWED = true;

  const trainEval = evalRowsV2c(trainRows, preprocessing, fit.weights, fit.intercept);
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
  const validationEval = evalRowsV2c(
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
    BASELINE_TRAIN_HOME_RATE_V2C,
  );
  const baselineValidationMetrics = constantBaselineMetricsV1(
    valY,
    BASELINE_TRAIN_HOME_RATE_V2C,
  );

  const trainLogit = partitionMeanLogitV2c(
    trainRows,
    preprocessing,
    fit.weights,
    fit.intercept,
  );
  const valLogit = partitionMeanLogitV2c(
    validationRows,
    preprocessing,
    fit.weights,
    fit.intercept,
  );
  if (
    Math.abs(trainLogit.directMeanLogit - trainLogit.meanFromFeatureMeans) >
    LOGIT_RECONCILE_TOLERANCE_V2C
  ) {
    throw new IndependentLogisticError("V2C_LOGIT_RECONCILIATION_FAIL", "train");
  }
  if (
    Math.abs(valLogit.directMeanLogit - valLogit.meanFromFeatureMeans) >
    LOGIT_RECONCILE_TOLERANCE_V2C
  ) {
    throw new IndependentLogisticError("V2C_LOGIT_RECONCILIATION_FAIL", "validation");
  }
  const v2cTotalLogitShift = valLogit.directMeanLogit - trainLogit.directMeanLogit;
  let sumFeatureShift = 0;
  for (let j = 0; j < MLB_INDEPENDENT_LOGISTIC_MODEL_DIM_V2C; j += 1) {
    sumFeatureShift +=
      fit.weights[j]! *
      (valLogit.transformedMeans[j]! - trainLogit.transformedMeans[j]!);
  }
  if (Math.abs(v2cTotalLogitShift - sumFeatureShift) > LOGIT_RECONCILE_TOLERANCE_V2C) {
    throw new IndependentLogisticError(
      "V2C_LOGIT_SHIFT_RECONCILIATION_FAIL",
      `${v2cTotalLogitShift} vs ${sumFeatureShift}`,
    );
  }

  const v2cMeanP = validationMetrics.meanPredictedProbability;
  const v2cBias = v2cMeanP - validationMetrics.actualHomeRate;
  const researchInterpretation = interpretHeadToHeadAblationV2c({
    v2bAuc: FROZEN_V2B_VALIDATION_V2C.rocAuc,
    v2cAuc: validationRocAuc,
    v2bLogLoss: FROZEN_V2B_VALIDATION_V2C.logLoss,
    v2cLogLoss: validationMetrics.logLoss,
    v2bBrier: FROZEN_V2B_VALIDATION_V2C.brierScore,
    v2cBrier: validationMetrics.brierScore,
  });

  const model: IndependentLogisticModelArtifactV2c = {
    schemaVersion: MLB_INDEPENDENT_LOGISTIC_SCHEMA_V2C,
    builderVersion: MLB_INDEPENDENT_LOGISTIC_BUILDER_VERSION_V2C,
    researchOnly: true,
    engineAdmission: MLB_INDEPENDENT_ENGINE_ADMISSION,
    target: "HOME_WIN",
    modelType: "LOGISTIC_REGRESSION",
    experimentId: MLB_INDEPENDENT_LOGISTIC_EXPERIMENT_ID_V2C,
    experimentType: MLB_INDEPENDENT_LOGISTIC_EXPERIMENT_TYPE_V2C,
    modelPrototype: true,
    modelCandidate: false,
    engineApproved: false,
    sourceJoinArtifactHash: options.sourceJoinHash,
    sourceSplitManifestHash: split.splitManifestHash,
    v1BaselineModelCoreHash: options.v1ModelCoreHash,
    v2aBaselineModelCoreHash: options.v2aModelCoreHash,
    v2bBaselineModelCoreHash: options.v2bModelCoreHash,
    trainingSampleCount: 1463,
    validationSampleCount: 483,
    holdoutSampleCount: 483,
    holdoutEvaluated: false,
    featureSpec: {
      orderedBaseFeatureNames: orderedLogisticBaseFeatureNamesV2c(),
      orderedMissingIndicatorNames: orderedLogisticMissingIndicatorNamesV2c(),
      orderedModelFeatureNames: orderedLogisticModelFeatureNamesV2c(),
      baseDimensions: MLB_INDEPENDENT_LOGISTIC_BASE_DIM_V2C,
      missingIndicators: MLB_INDEPENDENT_LOGISTIC_MISSING_DIM_V2C,
      modelDimensions: MLB_INDEPENDENT_LOGISTIC_MODEL_DIM_V2C,
      removedFeatures: [...MLB_INDEPENDENT_LOGISTIC_REMOVED_H2H_V2C],
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
    schemaVersion: "mlb-independent-logistic-head-to-head-ablation-v2c-eval" as const,
    builderVersion: MLB_INDEPENDENT_LOGISTIC_BUILDER_VERSION_V2C,
    researchOnly: true as const,
    engineAdmission: MLB_INDEPENDENT_ENGINE_ADMISSION,
    holdoutEvaluated: false as const,
    modelCoreHash,
    train: trainEval,
    validation: validationEval,
  };

  const rolling = {
    schemaVersion:
      "mlb-independent-logistic-head-to-head-ablation-v2c-train-rolling-replay-v1",
    builderVersion: MLB_INDEPENDENT_LOGISTIC_BUILDER_VERSION_V2C,
    researchOnly: true,
    modelCandidate: false,
    holdoutEvaluated: false,
    TRAIN_ROLLING_REPLAY_COMPLETE,
    V2C_SPEC_FROZEN,
    V2C_SPEC_UNCHANGED_AFTER_ROLLING_REPLAY: "PASS",
    H2H_ROLLING_FOLD_1_REPLAY: rollingResult.H2H_ROLLING_FOLD_1_REPLAY,
    H2H_ROLLING_FOLD_2_REPLAY: rollingResult.H2H_ROLLING_FOLD_2_REPLAY,
    H2H_ROLLING_FOLD_3_REPLAY: rollingResult.H2H_ROLLING_FOLD_3_REPLAY,
    frozenFeatureNames: specBeforeRolling,
    windowCounts: rollingResult.windowCounts,
    folds: rollingResult.folds,
    note: "Rolling replay confirms the sealed TRAIN-only HEAD_TO_HEAD leave-one-group-out diagnostic. It does not change the pre-registered v2-C spec.",
  };

  const aucRetention = trainRocAuc === 0 ? null : validationRocAuc / trainRocAuc;
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
    v2bBaselineModelCoreHash: options.v2bModelCoreHash,
    trainingSampleCount: 1463,
    validationSampleCount: 483,
    holdoutMembershipCount: 483,
    holdoutFeatureRowsRead: 0,
    holdoutLabelRowsRead: 0,
    holdoutTransformedRows: 0,
    holdoutLogitsCreated: 0,
    holdoutProbabilitiesCreated: 0,
    baseDimensions: 20,
    missingIndicators: 22,
    modelDimensions: 42,
    preprocessingFitPartition: "TRAIN",
    zeroVarianceFeatureNames: preprocessing.zeroVarianceFeatureNames,
    optimizer: fit,
    modelCoreHash,
    ablation,
    TRAIN_ROLLING_REPLAY_COMPLETE,
    V2C_SPEC_FROZEN,
    V2C_SPEC_UNCHANGED_AFTER_ROLLING_REPLAY: "PASS",
    V2C_FULL_TRAIN_MODEL_FIT,
    V2C_MODEL_CORE_HASH_CREATED,
    VALIDATION_FEATURE_ACCESS_ALLOWED,
    VALIDATION_EVALUATION_AFTER_MODEL_FREEZE,
    VALIDATION_AGGREGATE_EVALUATION_COUNT: 1,
    VALIDATION_BIN_ANALYSIS_PERFORMED: false,
    VALIDATION_FEATURE_DIAGNOSTIC_PERFORMED: false,
    VALIDATION_SUBGROUP_ANALYSIS_PERFORMED: false,
    VALIDATION_HAS_BEEN_USED_FOR_MODEL_RESEARCH: true,
    LATE_ONLY_FEATURE_ADDED: false,
    T3H_COMPATIBILITY_CHANGED: false,
    EARLY_COMPATIBILITY_REGRESSION: false,
    H2H_ROLLING_FOLD_1_REPLAY: rollingResult.H2H_ROLLING_FOLD_1_REPLAY,
    H2H_ROLLING_FOLD_2_REPLAY: rollingResult.H2H_ROLLING_FOLD_2_REPLAY,
    H2H_ROLLING_FOLD_3_REPLAY: rollingResult.H2H_ROLLING_FOLD_3_REPLAY,
    trainMetrics,
    trainRocAuc,
    validationMetrics,
    validationRocAuc,
    baselineTrainHomeRate: BASELINE_TRAIN_HOME_RATE_V2C,
    baselineTrainMetrics,
    baselineValidationMetrics,
    frozenV2bTrain: FROZEN_V2B_TRAIN_V2C,
    frozenV2bValidation: FROZEN_V2B_VALIDATION_V2C,
    v2cMinusV2b: {
      auc: validationRocAuc - FROZEN_V2B_VALIDATION_V2C.rocAuc,
      accuracy: validationMetrics.accuracy - FROZEN_V2B_VALIDATION_V2C.accuracy,
      logLoss: validationMetrics.logLoss - FROZEN_V2B_VALIDATION_V2C.logLoss,
      brierScore:
        validationMetrics.brierScore - FROZEN_V2B_VALIDATION_V2C.brierScore,
      predictedHomeClassRate:
        validationMetrics.predictedHomeRate -
        FROZEN_V2B_VALIDATION_V2C.predictedHomeRate,
      meanProbability:
        v2cMeanP - FROZEN_V2B_VALIDATION_V2C.meanPredictedProbability,
      absProbabilityBias:
        Math.abs(v2cBias) - Math.abs(FROZEN_V2B_VALIDATION_V2C.meanProbabilityBias),
    },
    v2cMinusConstant: {
      auc: validationRocAuc - 0.5,
      accuracy:
        validationMetrics.accuracy - baselineValidationMetrics.accuracy,
      logLoss: validationMetrics.logLoss - baselineValidationMetrics.logLoss,
      brierScore:
        validationMetrics.brierScore - baselineValidationMetrics.brierScore,
    },
    discriminationTransfer: {
      trainRocAuc,
      validationRocAuc,
      aucRetention,
      absoluteDrop: validationRocAuc - trainRocAuc,
      v2bTrainRocAuc: FROZEN_V2B_TRAIN_V2C.rocAuc,
      v2bValidationRocAuc: FROZEN_V2B_VALIDATION_V2C.rocAuc,
      v2bAbsoluteDrop:
        FROZEN_V2B_VALIDATION_V2C.rocAuc - FROZEN_V2B_TRAIN_V2C.rocAuc,
    },
    probabilityBias: {
      actualValidationHomeRate: validationMetrics.actualHomeRate,
      v2cMeanProbability: v2cMeanP,
      signedMeanProbabilityBias: v2cBias,
      absoluteMeanProbabilityBias: Math.abs(v2cBias),
    },
    logitShift: {
      trainMeanLogit: trainLogit.directMeanLogit,
      validationMeanLogit: valLogit.directMeanLogit,
      trainMeanLogitFromFeatureMeans: trainLogit.meanFromFeatureMeans,
      validationMeanLogitFromFeatureMeans: valLogit.meanFromFeatureMeans,
      v2cTotalLogitShift,
      sumFeatureShiftContributions: sumFeatureShift,
      logitShiftReconciliation: "PASS",
      v1TotalLogitShift: V1_TOTAL_LOGIT_SHIFT_V2C,
      v2aTotalLogitShift: V2A_TOTAL_LOGIT_SHIFT_V2C,
      v2bTotalLogitShift: V2B_TOTAL_LOGIT_SHIFT_V2C,
    },
    researchInterpretation,
    interpretationNote:
      "Descriptive only. The TRAIN rolling H2H effect was small, so small Validation changes must not be exaggerated. Validation has accumulated model-selection exposure and is not an untouched production estimate. Holdout stays sealed. Not an Engine decision and not automatic promotion to a model candidate.",
    marketUsed: false,
    networkUsed: false,
    engineChanged: false,
  };

  return { model, evaluation, rolling, audit };
}

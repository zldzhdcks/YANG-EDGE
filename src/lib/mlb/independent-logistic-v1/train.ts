/**
 * Independent Logistic Regression Prototype v1.
 * TRAIN-only preprocess/fit. TRAIN+VALIDATION eval. HOLDOUT labels sealed.
 */
import { createHash } from "node:crypto";
import path from "node:path";
import { MLB_INDEPENDENT_ENGINE_ADMISSION } from "../independent-model-v1";
import type { IndependentJoinArtifactV1 } from "../independent-join-v1";
import type { IndependentJoinRowV1 } from "../independent-join-v1";
import {
  hashIndependentSplitManifestV1,
  MLB_INDEPENDENT_2024_SEALED_JOIN_SHA256_V1,
  type IndependentSplitArtifactV1,
} from "../independent-split-v1";
import {
  IndependentLogisticError,
  MLB_INDEPENDENT_LOGISTIC_MODEL_DIM_V1,
  assertLogisticFeatureSpecV1,
  orderedLogisticBaseFeatureNamesV1,
  orderedLogisticMissingIndicatorNamesV1,
  orderedLogisticModelFeatureNamesV1,
} from "./spec";
import {
  fitTrainPreprocessorV1,
  transformMatrixV1,
  transformRowV1,
  type LogisticPreprocessorV1,
  type LogisticTrainRowV1,
} from "./preprocess";
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
} from "./logistic";
import {
  constantBaselineMetricsV1,
  evaluateProbabilitiesV1,
  type LogisticMetricsV1,
} from "./metrics";

export const MLB_INDEPENDENT_LOGISTIC_SCHEMA_V1 =
  "mlb-independent-logistic-prototype-v1" as const;
export const MLB_INDEPENDENT_LOGISTIC_BUILDER_VERSION =
  "mlb-independent-logistic-v1" as const;
export const MLB_INDEPENDENT_2024_SEALED_SPLIT_MANIFEST_HASH_V1 =
  "a72b8586971ee81a04e119c7d860f226abb503b5cc2341bb370d49d2fb47e71d";

export function independentLogisticModelRel(): string {
  return "data/research/mlb/independent-model-v1/model/2024-logistic-regression-prototype-v1.json";
}
export function independentLogisticModelPath(cwd = process.cwd()): string {
  return path.join(cwd, independentLogisticModelRel());
}
export function independentLogisticEvalRel(): string {
  return "data/research/mlb/independent-model-v1/evaluations/2024-logistic-regression-train-validation-v1.json";
}
export function independentLogisticEvalPath(cwd = process.cwd()): string {
  return path.join(cwd, independentLogisticEvalRel());
}
export function independentLogisticAuditRel(): string {
  return "data/research/mlb/independent-model-v1/audits/2024-logistic-regression-prototype-audit-v1.json";
}
export function independentLogisticAuditPath(cwd = process.cwd()): string {
  return path.join(cwd, independentLogisticAuditRel());
}

function sha256Utf8(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function compareTrainOrder(a: LogisticTrainRowV1, b: LogisticTrainRowV1): number {
  if (a.officialDate !== b.officialDate) {
    return a.officialDate < b.officialDate ? -1 : 1;
  }
  if (a.commenceTimeUtc !== b.commenceTimeUtc) {
    return a.commenceTimeUtc < b.commenceTimeUtc ? -1 : 1;
  }
  return a.gamePk - b.gamePk;
}

export function verifySealedSplitForTrainingV1(
  join: IndependentJoinArtifactV1,
  split: IndependentSplitArtifactV1,
  sourceJoinHash: string,
): void {
  if (sourceJoinHash !== MLB_INDEPENDENT_2024_SEALED_JOIN_SHA256_V1) {
    throw new IndependentLogisticError(
      "SEALED_JOIN_ARTIFACT_HASH_MISMATCH",
      sourceJoinHash,
    );
  }
  if (split.sourceJoinArtifactHash !== MLB_INDEPENDENT_2024_SEALED_JOIN_SHA256_V1) {
    throw new IndependentLogisticError(
      "SPLIT_JOIN_HASH_MISMATCH",
      split.sourceJoinArtifactHash,
    );
  }
  const recomputed = hashIndependentSplitManifestV1({
    sourceJoinArtifactHash: split.sourceJoinArtifactHash,
    boundaries: split.boundaries,
    trainGamePks: split.trainGamePks,
    validationGamePks: split.validationGamePks,
    holdoutGamePks: split.holdoutGamePks,
  });
  if (recomputed !== split.splitManifestHash) {
    throw new IndependentLogisticError(
      "SPLIT_MANIFEST_HASH_MISMATCH",
      `recomputed=${recomputed} stored=${split.splitManifestHash}`,
    );
  }
  if (recomputed !== MLB_INDEPENDENT_2024_SEALED_SPLIT_MANIFEST_HASH_V1) {
    throw new IndependentLogisticError(
      "SEALED_SPLIT_MANIFEST_HASH_MISMATCH",
      recomputed,
    );
  }
  if (
    split.counts.train !== 1463 ||
    split.counts.validation !== 483 ||
    split.counts.holdout !== 483 ||
    split.counts.total !== 2429 ||
    join.rows.length !== 2429
  ) {
    throw new IndependentLogisticError(
      "SPLIT_COUNT_MISMATCH",
      JSON.stringify(split.counts),
    );
  }
  const joinPks = new Set(join.rows.map((r) => r.identity.gamePk));
  const train = new Set(split.trainGamePks);
  const validation = new Set(split.validationGamePks);
  const holdout = new Set(split.holdoutGamePks);
  if (train.size !== 1463 || validation.size !== 483 || holdout.size !== 483) {
    throw new IndependentLogisticError("SPLIT_UNIQUE_COUNT_MISMATCH", "unique pk");
  }
  for (const pk of train) {
    if (validation.has(pk) || holdout.has(pk) || !joinPks.has(pk)) {
      throw new IndependentLogisticError("PARTITION_OVERLAP", `train ${pk}`);
    }
  }
  for (const pk of validation) {
    if (holdout.has(pk) || !joinPks.has(pk)) {
      throw new IndependentLogisticError("PARTITION_OVERLAP", `validation ${pk}`);
    }
  }
  for (const pk of holdout) {
    if (!joinPks.has(pk)) {
      throw new IndependentLogisticError("PARTITION_UNION_MISSING", `holdout ${pk}`);
    }
  }
  if (train.size + validation.size + holdout.size !== joinPks.size) {
    throw new IndependentLogisticError("PARTITION_UNION_MISMATCH", "union");
  }
}

function labeledRowsForPks(
  byPk: Map<number, IndependentJoinRowV1>,
  pks: number[],
): LogisticTrainRowV1[] {
  const rows: LogisticTrainRowV1[] = [];
  for (const pk of pks) {
    const row = byPk.get(pk);
    if (!row) {
      throw new IndependentLogisticError("MISSING_GAMEPK", `gamePk ${pk}`);
    }
    const target = row.label.target;
    if (target !== 0 && target !== 1) {
      throw new IndependentLogisticError("LABEL_TARGET_INVALID", `gamePk ${pk}`);
    }
    rows.push({
      gamePk: row.identity.gamePk,
      officialDate: row.identity.officialDate,
      commenceTimeUtc: row.identity.commenceTimeUtc,
      target,
      feature: row.feature,
    });
  }
  rows.sort(compareTrainOrder);
  return rows;
}

function assertHoldoutMembershipOnly(
  byPk: Map<number, IndependentJoinRowV1>,
  holdoutGamePks: number[],
): number {
  for (const pk of holdoutGamePks) {
    if (!byPk.has(pk)) {
      throw new IndependentLogisticError("MISSING_GAMEPK", `holdout ${pk}`);
    }
  }
  return holdoutGamePks.length;
}

export function hashModelCoreV1(core: Record<string, unknown>): string {
  return sha256Utf8(JSON.stringify(core));
}

export type LogisticEvalRowV1 = {
  gamePk: number;
  officialDate: string;
  commenceTimeUtc: string;
  target: 0 | 1;
  probability: number;
  predictedClass: 0 | 1;
  correct: boolean;
};

export type IndependentLogisticModelArtifactV1 = {
  schemaVersion: typeof MLB_INDEPENDENT_LOGISTIC_SCHEMA_V1;
  builderVersion: typeof MLB_INDEPENDENT_LOGISTIC_BUILDER_VERSION;
  researchOnly: true;
  engineAdmission: typeof MLB_INDEPENDENT_ENGINE_ADMISSION;
  target: "HOME_WIN";
  modelType: "LOGISTIC_REGRESSION";
  modelPrototype: true;
  engineApproved: false;
  sourceJoinArtifactHash: string;
  sourceSplitManifestHash: string;
  trainingSampleCount: number;
  validationSampleCount: number;
  holdoutSampleCount: number;
  holdoutEvaluated: false;
  featureSpec: {
    orderedBaseFeatureNames: string[];
    orderedMissingIndicatorNames: string[];
    orderedModelFeatureNames: string[];
    baseDimensions: 35;
    missingIndicators: 22;
    modelDimensions: 57;
  };
  preprocessing: LogisticPreprocessorV1;
  hyperparameters: {
    lambda: number;
    intercept: true;
    interceptRegularized: false;
    threshold: number;
    initialWeights: 0;
    initialIntercept: 0;
  };
    optimizer: {
      type: "FULL_BATCH_GRADIENT_DESCENT_BACKTRACKING",
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

export type IndependentLogisticEvalArtifactV1 = {
  schemaVersion: "mlb-independent-logistic-train-validation-eval-v1";
  builderVersion: typeof MLB_INDEPENDENT_LOGISTIC_BUILDER_VERSION;
  researchOnly: true;
  engineAdmission: typeof MLB_INDEPENDENT_ENGINE_ADMISSION;
  holdoutEvaluated: false;
  modelCoreHash: string;
  train: LogisticEvalRowV1[];
  validation: LogisticEvalRowV1[];
};

export type IndependentLogisticAuditV1 = {
  generatedAt: string;
  sourceJoinArtifactHash: string;
  sourceSplitManifestHash: string;
  trainingSampleCount: number;
  validationSampleCount: number;
  holdoutMembershipCount: number;
  holdoutLabelRowsReadForMetrics: 0;
  holdoutProbabilitiesCreated: 0;
  holdoutEvaluated: false;
  baseDimensions: 35;
  missingIndicators: 22;
  modelDimensions: 57;
  preprocessingFitPartition: "TRAIN";
  zeroVarianceFeatureNames: string[];
  optimizer: LogisticFitResultV1;
  modelCoreHash: string;
  trainMetrics: LogisticMetricsV1;
  validationMetrics: LogisticMetricsV1;
  baselineTrainHomeRate: number;
  baselineTrainMetrics: LogisticMetricsV1;
  baselineValidationMetrics: LogisticMetricsV1;
  validationDeltas: {
    accuracyDelta: number;
    logLossDelta: number;
    brierDelta: number;
  };
  trainProbability: {
    min: number;
    max: number;
    mean: number;
    median: number;
  };
  validationProbability: {
    min: number;
    max: number;
    mean: number;
    median: number;
  };
  marketUsed: false;
  networkUsed: false;
  engineChanged: false;
};

export type IndependentLogisticTrainResultV1 = {
  model: IndependentLogisticModelArtifactV1;
  evaluation: IndependentLogisticEvalArtifactV1;
  audit: IndependentLogisticAuditV1;
};

function evalRows(
  rows: LogisticTrainRowV1[],
  prep: LogisticPreprocessorV1,
  weights: number[],
  intercept: number,
): LogisticEvalRowV1[] {
  return rows.map((row) => {
    const x = transformRowV1(row.feature, prep);
    const probability = predictLogisticProbability(x, weights, intercept);
    const predictedClass = probability >= MLB_INDEPENDENT_LOGISTIC_THRESHOLD_V1 ? 1 : 0;
    return {
      gamePk: row.gamePk,
      officialDate: row.officialDate,
      commenceTimeUtc: row.commenceTimeUtc,
      target: row.target,
      probability,
      predictedClass: predictedClass as 0 | 1,
      correct: predictedClass === row.target,
    };
  });
}

export function trainIndependentLogisticPrototypeV1(
  join: IndependentJoinArtifactV1,
  split: IndependentSplitArtifactV1,
  options: {
    sourceJoinHash: string;
    generatedAt?: string;
  },
): IndependentLogisticTrainResultV1 {
  assertLogisticFeatureSpecV1();
  verifySealedSplitForTrainingV1(join, split, options.sourceJoinHash);

  const byPk = new Map<number, IndependentJoinRowV1>();
  for (const row of join.rows) {
    byPk.set(row.identity.gamePk, row);
  }
  const holdoutMembershipCount = assertHoldoutMembershipOnly(
    byPk,
    split.holdoutGamePks,
  );
  const trainRows = labeledRowsForPks(byPk, split.trainGamePks);
  const validationRows = labeledRowsForPks(byPk, split.validationGamePks);
  if (trainRows.length !== 1463 || validationRows.length !== 483) {
    throw new IndependentLogisticError(
      "PARTITION_ROW_COUNT",
      `train=${trainRows.length} validation=${validationRows.length}`,
    );
  }

  const preprocessing = fitTrainPreprocessorV1(trainRows);
  const { X, y } = transformMatrixV1(trainRows, preprocessing);
  const fit = fitFullBatchLogisticV1(X, y, MLB_INDEPENDENT_LOGISTIC_MODEL_DIM_V1);
  const trainGamePkListHash = sha256Utf8(JSON.stringify(split.trainGamePks));
  const modelCore = {
    schema: "mlb-independent-logistic-core-v1",
    modelType: "LOGISTIC_REGRESSION",
    target: "HOME_WIN",
    sourceJoinHash: options.sourceJoinHash,
    sourceSplitManifestHash: split.splitManifestHash,
    trainGamePkListHash,
    orderedBaseFeatureNames: orderedLogisticBaseFeatureNamesV1(),
    orderedMissingIndicatorNames: orderedLogisticMissingIndicatorNamesV1(),
    orderedModelFeatureNames: orderedLogisticModelFeatureNamesV1(),
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
  const modelCoreHash = hashModelCoreV1(modelCore);

  const trainEval = evalRows(trainRows, preprocessing, fit.weights, fit.intercept);
  const validationEval = evalRows(
    validationRows,
    preprocessing,
    fit.weights,
    fit.intercept,
  );
  const trainY = trainRows.map((r) => r.target);
  const valY = validationRows.map((r) => r.target);
  const trainP = trainEval.map((r) => r.probability);
  const valP = validationEval.map((r) => r.probability);
  const trainMetrics = evaluateProbabilitiesV1(trainY, trainP);
  const validationMetrics = evaluateProbabilitiesV1(valY, valP);
  const baselineTrainHomeRate =
    trainRows.filter((r) => r.target === 1).length / trainRows.length;
  const baselineTrainMetrics = constantBaselineMetricsV1(
    trainY,
    baselineTrainHomeRate,
  );
  const baselineValidationMetrics = constantBaselineMetricsV1(
    valY,
    baselineTrainHomeRate,
  );

  const model: IndependentLogisticModelArtifactV1 = {
    schemaVersion: MLB_INDEPENDENT_LOGISTIC_SCHEMA_V1,
    builderVersion: MLB_INDEPENDENT_LOGISTIC_BUILDER_VERSION,
    researchOnly: true,
    engineAdmission: MLB_INDEPENDENT_ENGINE_ADMISSION,
    target: "HOME_WIN",
    modelType: "LOGISTIC_REGRESSION",
    modelPrototype: true,
    engineApproved: false,
    sourceJoinArtifactHash: options.sourceJoinHash,
    sourceSplitManifestHash: split.splitManifestHash,
    trainingSampleCount: 1463,
    validationSampleCount: 483,
    holdoutSampleCount: 483,
    holdoutEvaluated: false,
    featureSpec: {
      orderedBaseFeatureNames: orderedLogisticBaseFeatureNamesV1(),
      orderedMissingIndicatorNames: orderedLogisticMissingIndicatorNamesV1(),
      orderedModelFeatureNames: orderedLogisticModelFeatureNamesV1(),
      baseDimensions: 35,
      missingIndicators: 22,
      modelDimensions: 57,
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

  const evaluation: IndependentLogisticEvalArtifactV1 = {
    schemaVersion: "mlb-independent-logistic-train-validation-eval-v1",
    builderVersion: MLB_INDEPENDENT_LOGISTIC_BUILDER_VERSION,
    researchOnly: true,
    engineAdmission: MLB_INDEPENDENT_ENGINE_ADMISSION,
    holdoutEvaluated: false,
    modelCoreHash,
    train: trainEval,
    validation: validationEval,
  };

  const audit: IndependentLogisticAuditV1 = {
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    sourceJoinArtifactHash: options.sourceJoinHash,
    sourceSplitManifestHash: split.splitManifestHash,
    trainingSampleCount: 1463,
    validationSampleCount: 483,
    holdoutMembershipCount,
    holdoutLabelRowsReadForMetrics: 0,
    holdoutProbabilitiesCreated: 0,
    holdoutEvaluated: false,
    baseDimensions: 35,
    missingIndicators: 22,
    modelDimensions: 57,
    preprocessingFitPartition: "TRAIN",
    zeroVarianceFeatureNames: preprocessing.zeroVarianceFeatureNames,
    optimizer: fit,
    modelCoreHash,
    trainMetrics,
    validationMetrics,
    baselineTrainHomeRate,
    baselineTrainMetrics,
    baselineValidationMetrics,
    validationDeltas: {
      accuracyDelta: validationMetrics.accuracy - baselineValidationMetrics.accuracy,
      logLossDelta: validationMetrics.logLoss - baselineValidationMetrics.logLoss,
      brierDelta: validationMetrics.brierScore - baselineValidationMetrics.brierScore,
    },
    trainProbability: {
      min: trainMetrics.minimumProbability,
      max: trainMetrics.maximumProbability,
      mean: trainMetrics.meanPredictedProbability,
      median: trainMetrics.median,
    },
    validationProbability: {
      min: validationMetrics.minimumProbability,
      max: validationMetrics.maximumProbability,
      mean: validationMetrics.meanPredictedProbability,
      median: validationMetrics.median,
    },
    marketUsed: false,
    networkUsed: false,
    engineChanged: false,
  };

  return { model, evaluation, audit };
}

export { IndependentLogisticError };

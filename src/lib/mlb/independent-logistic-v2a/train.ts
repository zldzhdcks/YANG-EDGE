/**
 * Independent Logistic Season-Volume Ablation Prototype v2-A.
 * TRAIN-only preprocess/fit. TRAIN+VALIDATION eval. HOLDOUT sealed.
 * Does not modify frozen v1 modules.
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
  IndependentLogisticError,
  MLB_INDEPENDENT_2024_SEALED_V1_MODEL_CORE_HASH_V2A,
  MLB_INDEPENDENT_LOGISTIC_BASE_DIM_V2A,
  MLB_INDEPENDENT_LOGISTIC_EXPERIMENT_ID_V2A,
  MLB_INDEPENDENT_LOGISTIC_EXPERIMENT_TYPE_V2A,
  MLB_INDEPENDENT_LOGISTIC_MISSING_DIM_V2A,
  MLB_INDEPENDENT_LOGISTIC_MODEL_DIM_V2A,
  MLB_INDEPENDENT_LOGISTIC_REMOVED_SEASON_VOLUME_V2A,
  assertLogisticFeatureSpecV2a,
  auditFeatureAblationV2a,
  orderedLogisticBaseFeatureNamesV2a,
  orderedLogisticMissingIndicatorNamesV2a,
  orderedLogisticModelFeatureNamesV2a,
  type FeatureAblationAuditV2a,
} from "./spec";
import {
  fitTrainPreprocessorV2a,
  transformMatrixV2a,
  transformRowV2a,
  type LogisticPreprocessorV2a,
  type LogisticTrainRowV2a,
} from "./preprocess";

export const MLB_INDEPENDENT_LOGISTIC_SCHEMA_V2A =
  "mlb-independent-logistic-season-volume-ablation-v2a" as const;
export const MLB_INDEPENDENT_LOGISTIC_BUILDER_VERSION_V2A =
  "mlb-independent-logistic-v2a" as const;

export const V1_TOTAL_LOGIT_SHIFT_V2A = 0.2417182727197169;
export const V1_VALIDATION_ACTUAL_HOME_RATE_V2A = 0.5072463768115942;
export const BASELINE_TRAIN_HOME_RATE_V2A = 776 / 1463;
export const LOGIT_RECONCILE_TOLERANCE_V2A = 1e-12;

const VALIDATION_BINS = [
  { id: "BIN_1", start: "2024-07-20", end: "2024-07-26" },
  { id: "BIN_2", start: "2024-07-27", end: "2024-08-02" },
  { id: "BIN_3", start: "2024-08-03", end: "2024-08-09" },
  { id: "BIN_4", start: "2024-08-10", end: "2024-08-16" },
  { id: "BIN_5", start: "2024-08-17", end: "2024-08-24" },
] as const;

export function independentLogisticV2aModelRel(): string {
  return "data/research/mlb/independent-model-v1/model/2024-logistic-regression-season-volume-ablation-v2a.json";
}
export function independentLogisticV2aModelPath(cwd = process.cwd()): string {
  return path.join(cwd, independentLogisticV2aModelRel());
}
export function independentLogisticV2aEvalRel(): string {
  return "data/research/mlb/independent-model-v1/evaluations/2024-logistic-regression-season-volume-ablation-v2a-train-validation.json";
}
export function independentLogisticV2aEvalPath(cwd = process.cwd()): string {
  return path.join(cwd, independentLogisticV2aEvalRel());
}
export function independentLogisticV2aAuditRel(): string {
  return "data/research/mlb/independent-model-v1/audits/2024-logistic-regression-season-volume-ablation-v2a-audit.json";
}
export function independentLogisticV2aAuditPath(cwd = process.cwd()): string {
  return path.join(cwd, independentLogisticV2aAuditRel());
}

function sha256Utf8(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

export function hashModelCoreV2a(core: Record<string, unknown>): string {
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

export type LogisticEvalRowV2a = {
  gamePk: number;
  officialDate: string;
  commenceTimeUtc: string;
  target: 0 | 1;
  probability: number;
  predictedClass: 0 | 1;
  correct: boolean;
};

export type FrozenV1EvalRowV2a = {
  gamePk: number;
  officialDate: string;
  target: 0 | 1;
  probability: number;
};

export type IndependentLogisticModelArtifactV2a = {
  schemaVersion: typeof MLB_INDEPENDENT_LOGISTIC_SCHEMA_V2A;
  builderVersion: typeof MLB_INDEPENDENT_LOGISTIC_BUILDER_VERSION_V2A;
  researchOnly: true;
  engineAdmission: typeof MLB_INDEPENDENT_ENGINE_ADMISSION;
  target: "HOME_WIN";
  modelType: "LOGISTIC_REGRESSION";
  experimentId: typeof MLB_INDEPENDENT_LOGISTIC_EXPERIMENT_ID_V2A;
  experimentType: typeof MLB_INDEPENDENT_LOGISTIC_EXPERIMENT_TYPE_V2A;
  modelPrototype: true;
  modelCandidate: false;
  engineApproved: false;
  sourceJoinArtifactHash: string;
  sourceSplitManifestHash: string;
  v1BaselineModelCoreHash: string;
  trainingSampleCount: number;
  validationSampleCount: number;
  holdoutSampleCount: number;
  holdoutEvaluated: false;
  featureSpec: {
    orderedBaseFeatureNames: string[];
    orderedMissingIndicatorNames: string[];
    orderedModelFeatureNames: string[];
    baseDimensions: 29;
    missingIndicators: 22;
    modelDimensions: 51;
    removedFeatures: string[];
  };
  preprocessing: LogisticPreprocessorV2a;
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

export type IndependentLogisticEvalArtifactV2a = {
  schemaVersion: "mlb-independent-logistic-season-volume-ablation-v2a-eval";
  builderVersion: typeof MLB_INDEPENDENT_LOGISTIC_BUILDER_VERSION_V2A;
  researchOnly: true;
  engineAdmission: typeof MLB_INDEPENDENT_ENGINE_ADMISSION;
  holdoutEvaluated: false;
  modelCoreHash: string;
  train: LogisticEvalRowV2a[];
  validation: LogisticEvalRowV2a[];
};

export type AblationResearchInterpretationV2a =
  | "SUPPORTS_SEASON_VOLUME_ABLATION"
  | "DOES_NOT_SUPPORT_SEASON_VOLUME_ABLATION"
  | "MIXED_SEASON_VOLUME_ABLATION_RESULT";

export type IndependentLogisticAuditV2a = {
  generatedAt: string;
  sourceJoinArtifactHash: string;
  sourceSplitManifestHash: string;
  v1BaselineModelCoreHash: string;
  trainingSampleCount: number;
  validationSampleCount: number;
  holdoutMembershipCount: number;
  holdoutFeatureRowsRead: 0;
  holdoutLabelRowsRead: 0;
  holdoutTransformedRows: 0;
  holdoutProbabilitiesCreated: 0;
  holdoutEvaluated: false;
  baseDimensions: 29;
  missingIndicators: 22;
  modelDimensions: 51;
  preprocessingFitPartition: "TRAIN";
  zeroVarianceFeatureNames: string[];
  optimizer: LogisticFitResultV1;
  modelCoreHash: string;
  ablation: FeatureAblationAuditV2a;
  trainMetrics: LogisticMetricsV1;
  validationMetrics: LogisticMetricsV1;
  baselineTrainHomeRate: number;
  baselineTrainMetrics: LogisticMetricsV1;
  baselineValidationMetrics: LogisticMetricsV1;
  validationVsBaseline: {
    accuracyDelta: number;
    logLossDelta: number;
    brierDelta: number;
  };
  v1ValidationMetrics: {
    accuracy: number;
    logLoss: number;
    brierScore: number;
    predictedHomeRate: number;
    meanPredictedProbability: number;
  };
  v2aMinusV1: {
    accuracy: number;
    logLoss: number;
    brierScore: number;
    predictedHomeRate: number;
    meanPredictedProbability: number;
    logitShift: number;
    absMeanProbabilityBias: number;
  };
  probabilityBias: {
    actualValidationHomeRate: number;
    v1MeanProbability: number;
    v1MeanProbabilityBias: number;
    v1AbsMeanProbabilityBias: number;
    v2aMeanProbability: number;
    v2aMeanProbabilityBias: number;
    v2aAbsMeanProbabilityBias: number;
  };
  logitShift: {
    trainMeanLogit: number;
    validationMeanLogit: number;
    trainMeanLogitFromFeatureMeans: number;
    validationMeanLogitFromFeatureMeans: number;
    v2aTotalLogitShift: number;
    sumFeatureShiftContributions: number;
    logitShiftReconciliation: "PASS";
    v1TotalLogitShift: number;
    v2aMinusV1LogitShift: number;
  };
  validationChronologicalBins: Array<{
    id: string;
    start: string;
    end: string;
    n: number;
    actualHomeRate: number;
    v1MeanProbability: number;
    v2aMeanProbability: number;
    v1PredictedHomeClassRate: number;
    v2aPredictedHomeClassRate: number;
    v1LogLoss: number;
    v2aLogLoss: number;
    v1Brier: number;
    v2aBrier: number;
  }>;
  researchInterpretation: AblationResearchInterpretationV2a;
  interpretationNote: string;
  marketUsed: false;
  networkUsed: false;
  engineChanged: false;
  modelCandidate: false;
};

export type IndependentLogisticTrainResultV2a = {
  model: IndependentLogisticModelArtifactV2a;
  evaluation: IndependentLogisticEvalArtifactV2a;
  audit: IndependentLogisticAuditV2a;
};

function labeledRowsForPks(
  join: IndependentJoinArtifactV1,
  pks: number[],
): LogisticTrainRowV2a[] {
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
  const rows: LogisticTrainRowV2a[] = found.map((row) => {
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

function evalRows(
  rows: LogisticTrainRowV2a[],
  prep: LogisticPreprocessorV2a,
  weights: number[],
  intercept: number,
): LogisticEvalRowV2a[] {
  return rows.map((row) => {
    const x = transformRowV2a(row.feature, prep);
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

export function partitionMeanLogitV2a(
  rows: LogisticTrainRowV2a[],
  prep: LogisticPreprocessorV2a,
  weights: number[],
  intercept: number,
): {
  directMeanLogit: number;
  meanFromFeatureMeans: number;
  transformedMeans: number[];
} {
  const dim = MLB_INDEPENDENT_LOGISTIC_MODEL_DIM_V2A;
  const sums = new Array<number>(dim).fill(0);
  const logits: number[] = [];
  for (const row of rows) {
    const x = transformRowV2a(row.feature, prep);
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

export function interpretSeasonVolumeAblationV2a(input: {
  v1AbsLogitShift: number;
  v2aAbsLogitShift: number;
  v1AbsBias: number;
  v2aAbsBias: number;
  v1LogLoss: number;
  v2aLogLoss: number;
  v1Brier: number;
  v2aBrier: number;
}): AblationResearchInterpretationV2a {
  const logitReduced = input.v2aAbsLogitShift < input.v1AbsLogitShift - 1e-6;
  const biasReduced = input.v2aAbsBias < input.v1AbsBias - 1e-6;
  const logLossImproved = input.v2aLogLoss < input.v1LogLoss - 1e-6;
  const brierImproved = input.v2aBrier < input.v1Brier - 1e-6;
  const qualityImproved = logLossImproved || brierImproved;
  if (logitReduced && biasReduced && qualityImproved) {
    return "SUPPORTS_SEASON_VOLUME_ABLATION";
  }
  if (!logitReduced && !biasReduced && !logLossImproved && !brierImproved) {
    return "DOES_NOT_SUPPORT_SEASON_VOLUME_ABLATION";
  }
  return "MIXED_SEASON_VOLUME_ABLATION_RESULT";
}

export function trainIndependentLogisticSeasonVolumeAblationV2a(
  join: IndependentJoinArtifactV1,
  split: IndependentSplitArtifactV1,
  options: {
    sourceJoinHash: string;
    v1ModelCoreHash: string;
    v1Validation: FrozenV1EvalRowV2a[];
    generatedAt?: string;
  },
): IndependentLogisticTrainResultV2a {
  assertLogisticFeatureSpecV2a();
  verifySealedSplitForTrainingV1(join, split, options.sourceJoinHash);
  if (options.v1ModelCoreHash !== MLB_INDEPENDENT_2024_SEALED_V1_MODEL_CORE_HASH_V2A) {
    throw new IndependentLogisticError(
      "V1_MODEL_CORE_HASH_PIN_MISMATCH",
      options.v1ModelCoreHash,
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

  const ablation = auditFeatureAblationV2a();
  const trainRows = labeledRowsForPks(join, split.trainGamePks);
  const validationRows = labeledRowsForPks(join, split.validationGamePks);
  if (trainRows.length !== 1463 || validationRows.length !== 483) {
    throw new IndependentLogisticError(
      "PARTITION_ROW_COUNT",
      `train=${trainRows.length} validation=${validationRows.length}`,
    );
  }
  const trainHomeCount = trainRows.filter((r) => r.target === 1).length;
  if (trainHomeCount !== 776) {
    throw new IndependentLogisticError(
      "BASELINE_TRAIN_HOME_COUNT",
      `${trainHomeCount}`,
    );
  }

  const preprocessing = fitTrainPreprocessorV2a(trainRows);
  const { X, y } = transformMatrixV2a(trainRows, preprocessing);
  const fit = fitFullBatchLogisticV1(
    X,
    y,
    MLB_INDEPENDENT_LOGISTIC_MODEL_DIM_V2A,
  );
  const trainGamePkListHash = sha256Utf8(JSON.stringify(split.trainGamePks));
  const modelCore = {
    schema: "mlb-independent-logistic-core-v2a",
    modelType: "LOGISTIC_REGRESSION",
    experimentId: MLB_INDEPENDENT_LOGISTIC_EXPERIMENT_ID_V2A,
    target: "HOME_WIN",
    sourceJoinHash: options.sourceJoinHash,
    sourceSplitManifestHash: split.splitManifestHash,
    v1BaselineModelCoreHash: options.v1ModelCoreHash,
    trainGamePkListHash,
    orderedBaseFeatureNames: orderedLogisticBaseFeatureNamesV2a(),
    orderedMissingIndicatorNames: orderedLogisticMissingIndicatorNamesV2a(),
    orderedModelFeatureNames: orderedLogisticModelFeatureNamesV2a(),
    removedFeatures: [...MLB_INDEPENDENT_LOGISTIC_REMOVED_SEASON_VOLUME_V2A],
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
  const modelCoreHash = hashModelCoreV2a(modelCore);

  const trainEval = evalRows(trainRows, preprocessing, fit.weights, fit.intercept);
  const validationEval = evalRows(
    validationRows,
    preprocessing,
    fit.weights,
    fit.intercept,
  );
  const trainY = trainRows.map((r) => r.target);
  const valY = validationRows.map((r) => r.target);
  const trainMetrics = evaluateProbabilitiesV1(
    trainY,
    trainEval.map((r) => r.probability),
  );
  const validationMetrics = evaluateProbabilitiesV1(
    valY,
    validationEval.map((r) => r.probability),
  );
  const baselineTrainMetrics = constantBaselineMetricsV1(
    trainY,
    BASELINE_TRAIN_HOME_RATE_V2A,
  );
  const baselineValidationMetrics = constantBaselineMetricsV1(
    valY,
    BASELINE_TRAIN_HOME_RATE_V2A,
  );

  const trainLogit = partitionMeanLogitV2a(
    trainRows,
    preprocessing,
    fit.weights,
    fit.intercept,
  );
  const valLogit = partitionMeanLogitV2a(
    validationRows,
    preprocessing,
    fit.weights,
    fit.intercept,
  );
  if (
    Math.abs(trainLogit.directMeanLogit - trainLogit.meanFromFeatureMeans) >
    LOGIT_RECONCILE_TOLERANCE_V2A
  ) {
    throw new IndependentLogisticError("V2A_LOGIT_RECONCILIATION_FAIL", "train");
  }
  if (
    Math.abs(valLogit.directMeanLogit - valLogit.meanFromFeatureMeans) >
    LOGIT_RECONCILE_TOLERANCE_V2A
  ) {
    throw new IndependentLogisticError(
      "V2A_LOGIT_RECONCILIATION_FAIL",
      "validation",
    );
  }
  const v2aTotalLogitShift =
    valLogit.directMeanLogit - trainLogit.directMeanLogit;
  let sumFeatureShift = 0;
  for (let j = 0; j < MLB_INDEPENDENT_LOGISTIC_MODEL_DIM_V2A; j += 1) {
    sumFeatureShift +=
      fit.weights[j]! *
      (valLogit.transformedMeans[j]! - trainLogit.transformedMeans[j]!);
  }
  if (Math.abs(v2aTotalLogitShift - sumFeatureShift) > LOGIT_RECONCILE_TOLERANCE_V2A) {
    throw new IndependentLogisticError(
      "V2A_LOGIT_SHIFT_RECONCILIATION_FAIL",
      `${v2aTotalLogitShift} vs ${sumFeatureShift}`,
    );
  }

  if (options.v1Validation.length !== 483) {
    throw new IndependentLogisticError(
      "V1_VALIDATION_COUNT",
      `${options.v1Validation.length}`,
    );
  }
  const v1ValByPk = new Map(options.v1Validation.map((r) => [r.gamePk, r]));
  const v1ValY: number[] = [];
  const v1ValP: number[] = [];
  for (const row of validationEval) {
    const v1 = v1ValByPk.get(row.gamePk);
    if (!v1) {
      throw new IndependentLogisticError(
        "V1_VALIDATION_GAMEPK_MISSING",
        `${row.gamePk}`,
      );
    }
    v1ValY.push(v1.target);
    v1ValP.push(v1.probability);
  }
  const v1ValMetrics = evaluateProbabilitiesV1(v1ValY, v1ValP);
  const v1MeanP = v1ValMetrics.meanPredictedProbability;
  const v2aMeanP = validationMetrics.meanPredictedProbability;
  const actualValHome = V1_VALIDATION_ACTUAL_HOME_RATE_V2A;
  const v1Bias = v1MeanP - actualValHome;
  const v2aBias = v2aMeanP - actualValHome;

  const bins = VALIDATION_BINS.map((bin) => {
    const v2aSubset = validationEval.filter(
      (r) => r.officialDate >= bin.start && r.officialDate <= bin.end,
    );
    const v1Subset = options.v1Validation.filter(
      (r) => r.officialDate >= bin.start && r.officialDate <= bin.end,
    );
    const v2aM = evaluateProbabilitiesV1(
      v2aSubset.map((r) => r.target),
      v2aSubset.map((r) => r.probability),
    );
    const v1M = evaluateProbabilitiesV1(
      v1Subset.map((r) => r.target),
      v1Subset.map((r) => r.probability),
    );
    return {
      id: bin.id,
      start: bin.start,
      end: bin.end,
      n: v2aSubset.length,
      actualHomeRate: v2aM.actualHomeRate,
      v1MeanProbability: v1M.meanPredictedProbability,
      v2aMeanProbability: v2aM.meanPredictedProbability,
      v1PredictedHomeClassRate: v1M.predictedHomeRate,
      v2aPredictedHomeClassRate: v2aM.predictedHomeRate,
      v1LogLoss: v1M.logLoss,
      v2aLogLoss: v2aM.logLoss,
      v1Brier: v1M.brierScore,
      v2aBrier: v2aM.brierScore,
    };
  });

  const researchInterpretation = interpretSeasonVolumeAblationV2a({
    v1AbsLogitShift: Math.abs(V1_TOTAL_LOGIT_SHIFT_V2A),
    v2aAbsLogitShift: Math.abs(v2aTotalLogitShift),
    v1AbsBias: Math.abs(v1Bias),
    v2aAbsBias: Math.abs(v2aBias),
    v1LogLoss: v1ValMetrics.logLoss,
    v2aLogLoss: validationMetrics.logLoss,
    v1Brier: v1ValMetrics.brierScore,
    v2aBrier: validationMetrics.brierScore,
  });

  const model: IndependentLogisticModelArtifactV2a = {
    schemaVersion: MLB_INDEPENDENT_LOGISTIC_SCHEMA_V2A,
    builderVersion: MLB_INDEPENDENT_LOGISTIC_BUILDER_VERSION_V2A,
    researchOnly: true,
    engineAdmission: MLB_INDEPENDENT_ENGINE_ADMISSION,
    target: "HOME_WIN",
    modelType: "LOGISTIC_REGRESSION",
    experimentId: MLB_INDEPENDENT_LOGISTIC_EXPERIMENT_ID_V2A,
    experimentType: MLB_INDEPENDENT_LOGISTIC_EXPERIMENT_TYPE_V2A,
    modelPrototype: true,
    modelCandidate: false,
    engineApproved: false,
    sourceJoinArtifactHash: options.sourceJoinHash,
    sourceSplitManifestHash: split.splitManifestHash,
    v1BaselineModelCoreHash: options.v1ModelCoreHash,
    trainingSampleCount: 1463,
    validationSampleCount: 483,
    holdoutSampleCount: 483,
    holdoutEvaluated: false,
    featureSpec: {
      orderedBaseFeatureNames: orderedLogisticBaseFeatureNamesV2a(),
      orderedMissingIndicatorNames: orderedLogisticMissingIndicatorNamesV2a(),
      orderedModelFeatureNames: orderedLogisticModelFeatureNamesV2a(),
      baseDimensions: MLB_INDEPENDENT_LOGISTIC_BASE_DIM_V2A,
      missingIndicators: MLB_INDEPENDENT_LOGISTIC_MISSING_DIM_V2A,
      modelDimensions: MLB_INDEPENDENT_LOGISTIC_MODEL_DIM_V2A,
      removedFeatures: [...MLB_INDEPENDENT_LOGISTIC_REMOVED_SEASON_VOLUME_V2A],
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

  const evaluation: IndependentLogisticEvalArtifactV2a = {
    schemaVersion: "mlb-independent-logistic-season-volume-ablation-v2a-eval",
    builderVersion: MLB_INDEPENDENT_LOGISTIC_BUILDER_VERSION_V2A,
    researchOnly: true,
    engineAdmission: MLB_INDEPENDENT_ENGINE_ADMISSION,
    holdoutEvaluated: false,
    modelCoreHash,
    train: trainEval,
    validation: validationEval,
  };

  const audit: IndependentLogisticAuditV2a = {
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    sourceJoinArtifactHash: options.sourceJoinHash,
    sourceSplitManifestHash: split.splitManifestHash,
    v1BaselineModelCoreHash: options.v1ModelCoreHash,
    trainingSampleCount: 1463,
    validationSampleCount: 483,
    holdoutMembershipCount: 483,
    holdoutFeatureRowsRead: 0,
    holdoutLabelRowsRead: 0,
    holdoutTransformedRows: 0,
    holdoutProbabilitiesCreated: 0,
    holdoutEvaluated: false,
    baseDimensions: 29,
    missingIndicators: 22,
    modelDimensions: 51,
    preprocessingFitPartition: "TRAIN",
    zeroVarianceFeatureNames: preprocessing.zeroVarianceFeatureNames,
    optimizer: fit,
    modelCoreHash,
    ablation,
    trainMetrics,
    validationMetrics,
    baselineTrainHomeRate: BASELINE_TRAIN_HOME_RATE_V2A,
    baselineTrainMetrics,
    baselineValidationMetrics,
    validationVsBaseline: {
      accuracyDelta:
        validationMetrics.accuracy - baselineValidationMetrics.accuracy,
      logLossDelta: validationMetrics.logLoss - baselineValidationMetrics.logLoss,
      brierDelta: validationMetrics.brierScore - baselineValidationMetrics.brierScore,
    },
    v1ValidationMetrics: {
      accuracy: v1ValMetrics.accuracy,
      logLoss: v1ValMetrics.logLoss,
      brierScore: v1ValMetrics.brierScore,
      predictedHomeRate: v1ValMetrics.predictedHomeRate,
      meanPredictedProbability: v1ValMetrics.meanPredictedProbability,
    },
    v2aMinusV1: {
      accuracy: validationMetrics.accuracy - v1ValMetrics.accuracy,
      logLoss: validationMetrics.logLoss - v1ValMetrics.logLoss,
      brierScore: validationMetrics.brierScore - v1ValMetrics.brierScore,
      predictedHomeRate:
        validationMetrics.predictedHomeRate - v1ValMetrics.predictedHomeRate,
      meanPredictedProbability:
        validationMetrics.meanPredictedProbability -
        v1ValMetrics.meanPredictedProbability,
      logitShift: v2aTotalLogitShift - V1_TOTAL_LOGIT_SHIFT_V2A,
      absMeanProbabilityBias: Math.abs(v2aBias) - Math.abs(v1Bias),
    },
    probabilityBias: {
      actualValidationHomeRate: actualValHome,
      v1MeanProbability: v1MeanP,
      v1MeanProbabilityBias: v1Bias,
      v1AbsMeanProbabilityBias: Math.abs(v1Bias),
      v2aMeanProbability: v2aMeanP,
      v2aMeanProbabilityBias: v2aBias,
      v2aAbsMeanProbabilityBias: Math.abs(v2aBias),
    },
    logitShift: {
      trainMeanLogit: trainLogit.directMeanLogit,
      validationMeanLogit: valLogit.directMeanLogit,
      trainMeanLogitFromFeatureMeans: trainLogit.meanFromFeatureMeans,
      validationMeanLogitFromFeatureMeans: valLogit.meanFromFeatureMeans,
      v2aTotalLogitShift,
      sumFeatureShiftContributions: sumFeatureShift,
      logitShiftReconciliation: "PASS",
      v1TotalLogitShift: V1_TOTAL_LOGIT_SHIFT_V2A,
      v2aMinusV1LogitShift: v2aTotalLogitShift - V1_TOTAL_LOGIT_SHIFT_V2A,
    },
    validationChronologicalBins: bins,
    researchInterpretation,
    interpretationNote:
      "Descriptive only. Not an Engine decision and not automatic promotion to a model candidate. Probability quality (logLoss, Brier, mean probability bias, predicted HOME class rate) is primary; accuracy is reported but not used as a sole selection gate.",
    marketUsed: false,
    networkUsed: false,
    engineChanged: false,
    modelCandidate: false,
  };

  return { model, evaluation, audit };
}

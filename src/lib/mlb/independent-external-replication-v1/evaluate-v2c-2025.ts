/**
 * 2025 EXTERNAL REPLICATION TRACK — one-time frozen v2-C aggregate evaluation.
 *
 * Opens the sealed 2025 join after protocol/model gates.
 * No refit. No tuning. No slicing. No 2024 Holdout. No Engine change.
 */
import path from "node:path";
import {
  MLB_INDEPENDENT_ENGINE_ADMISSION,
  type MlbIndependentFeatureRowV1,
} from "../independent-model-v1";
import { stableSigmoid } from "../independent-logistic-v1/logistic";
import { evaluateProbabilitiesV1 } from "../independent-logistic-v1/metrics";
import {
  MLB_INDEPENDENT_EXTERNAL_REPLICATION_TRACK,
  serializeExternalReplicationJson,
  sha256Utf8,
} from "./source-2025";
import {
  type ExternalReplicationJoinArtifact2025,
  type ExternalReplicationJoinRow2025,
} from "./join-feature-label-2025";
import {
  FROZEN_CONSTANT_BASELINE_PROBABILITY,
  FROZEN_PREPROCESSOR_FIT_PARTITION,
  FROZEN_PREPROCESSOR_SOURCE,
  FROZEN_V2C_BASE_DIMENSIONS,
  FROZEN_V2C_INTERCEPT,
  FROZEN_V2C_LAMBDA,
  FROZEN_V2C_MISSING_INDICATORS,
  FROZEN_V2C_MODEL_DIMENSIONS,
  FROZEN_V2C_ORDERED_BASE_FEATURE_NAMES,
  FROZEN_V2C_ORDERED_MISSING_INDICATOR_NAMES,
  FROZEN_V2C_THRESHOLD,
  FROZEN_V2C_TRAIN_CONTEXT_2024,
  FROZEN_V2C_VALIDATION_CONTEXT_2024,
  MLB_INDEPENDENT_2025_EXTERNAL_SAMPLE_COUNT,
  MLB_INDEPENDENT_2025_SEALED_JOIN_SHA256,
  MLB_INDEPENDENT_2025_SEALED_V2C_MODEL_CORE_HASH,
  assertExternalReplication2025JoinShaPin,
  assertFrozenV2cExternalReplicationProtocol2025,
  hashExternalReplicationProtocolArtifact2025,
  type FrozenV2cExternalReplicationProtocol2025,
  type FrozenV2cModelProtocolView,
} from "./preregister-v2c-evaluation-2025";

export const MLB_INDEPENDENT_2025_V2C_EVALUATION_STAGE =
  "EXTERNAL_REPLICATION_EVALUATION" as const;
export const MLB_INDEPENDENT_2025_V2C_EVALUATION_SCHEMA_V1 =
  "mlb-independent-2025-v2c-external-replication-evaluation-v1" as const;
export const MLB_INDEPENDENT_2025_SEALED_V2C_PROTOCOL_SHA256 =
  "e6b5e1f8b2ea29a5968626d6f790c27396d5868354c0dc2e45a961883059c648";
export const MLB_INDEPENDENT_2025_SEALED_V2C_MODEL_ARTIFACT_SHA256 =
  "2d8a0ee63a8885e2f8c6ae0d4c40c1f139235e6d8edfce15fe39899ddc0a41c3";

export class ExternalReplicationEvaluationError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(`${code}: ${message}`);
    this.name = "ExternalReplicationEvaluationError";
    this.code = code;
  }
}

export type ExternalReplicationEvaluationRow2025 = {
  gamePk: number;
  officialDate: string;
  commenceTimeUtc: string;
  target: 0 | 1;
  probability: number;
  predictedClass: 0 | 1;
  correct: boolean;
};

export type ExternalReplicationDirectionalVerdict2025 =
  | "DIRECTIONAL_EXTERNAL_REPLICATION_SUPPORTED"
  | "MIXED_EXTERNAL_REPLICATION"
  | "EXTERNAL_REPLICATION_NOT_SUPPORTED";

export type FrozenV2cEvaluationModel2025 = FrozenV2cModelProtocolView & {
  intercept: number;
  coefficients: number[];
  preprocessing: {
    fitPartition: string;
    fitSampleCount: number;
    orderedBaseFeatureNames: string[];
    orderedMissingIndicatorNames: string[];
    orderedModelFeatureNames?: string[];
    medianByFeature: Record<string, number>;
    meanByFeature: Record<string, number>;
    scaleByFeature: Record<string, number>;
    zeroVarianceFeatureNames: string[];
  };
  featureSpec: {
    orderedBaseFeatureNames: string[];
    orderedMissingIndicatorNames: string[];
    orderedModelFeatureNames: string[];
    baseDimensions: number;
    missingIndicators: number;
    modelDimensions: number;
  };
  hyperparameters: {
    lambda: number;
    threshold: number;
  };
  modelCoreHash: string;
};

export type ExternalReplicationEvaluationArtifact2025 = {
  schemaVersion: typeof MLB_INDEPENDENT_2025_V2C_EVALUATION_SCHEMA_V1;
  generatedAt: string;
  researchOnly: true;
  track: typeof MLB_INDEPENDENT_EXTERNAL_REPLICATION_TRACK;
  stage: typeof MLB_INDEPENDENT_2025_V2C_EVALUATION_STAGE;
  engineAdmission: typeof MLB_INDEPENDENT_ENGINE_ADMISSION;
  modelCandidate: false;
  protocolArtifactSha256: typeof MLB_INDEPENDENT_2025_SEALED_V2C_PROTOCOL_SHA256;
  joinArtifactSha256: typeof MLB_INDEPENDENT_2025_SEALED_JOIN_SHA256;
  v2cModelArtifactSha256: typeof MLB_INDEPENDENT_2025_SEALED_V2C_MODEL_ARTIFACT_SHA256;
  v2cModelCoreHash: typeof MLB_INDEPENDENT_2025_SEALED_V2C_MODEL_CORE_HASH;
  sampleCount: number;
  excludedCount: 0;
  rows: ExternalReplicationEvaluationRow2025[];
  primaryMetrics: {
    rocAuc: number;
    logLoss: number;
    brierScore: number;
  };
  secondaryMetrics: {
    accuracy: number;
    TP: number;
    TN: number;
    FP: number;
    FN: number;
    actualHomeRate: number;
    predictedHomeClassRate: number;
    meanPredictedHomeProbability: number;
    signedProbabilityBias: number;
    absoluteProbabilityBias: number;
    minimumProbability: number;
    p10: number;
    p25: number;
    median: number;
    p75: number;
    p90: number;
    maximumProbability: number;
  };
  constantBaselineMetrics: {
    probability: number;
    rocAuc: 0.5;
    accuracy: number;
    logLoss: number;
    brierScore: number;
  };
  directionalChecks: {
    AUC_PASS: boolean;
    LOGLOSS_PASS: boolean;
    BRIER_PASS: boolean;
    passCount: number;
  };
  directionalVerdict: ExternalReplicationDirectionalVerdict2025;
  "2024Context": {
    trainAuc: number;
    validationAuc: number;
    externalAuc: number;
    externalMinusTrainAuc: number;
    externalMinusValidationAuc: number;
    externalToTrainAucRatio: number;
    validationAccuracy: number;
    validationLogLoss: number;
    validationBrier: number;
    validationMeanProbability: number;
    descriptiveOnly: true;
  };
};

export type ExternalReplicationEvaluationAudit2025 = {
  generatedAt: string;
  researchOnly: true;
  track: typeof MLB_INDEPENDENT_EXTERNAL_REPLICATION_TRACK;
  stage: typeof MLB_INDEPENDENT_2025_V2C_EVALUATION_STAGE;
  engineAdmission: typeof MLB_INDEPENDENT_ENGINE_ADMISSION;
  marketUsed: false;
  networkUsed: false;
  protocolShaVerified: true;
  joinShaVerified: true;
  modelArtifactShaVerified: true;
  modelCoreHashVerified: true;
  preprocessorSource: typeof FROZEN_PREPROCESSOR_SOURCE;
  preprocessorRefit: false;
  modelRefit: false;
  interceptRefit: false;
  coefficientUpdate: false;
  thresholdTuned: false;
  calibrationPerformed: false;
  sampleCount: number;
  excludedCount: 0;
  transformedRows: number;
  modelDimensions: typeof FROZEN_V2C_MODEL_DIMENSIONS;
  logitsCreated: number;
  probabilitiesCreated: number;
  nonfiniteTransformCount: 0;
  nonfiniteLogitCount: 0;
  nonfiniteProbabilityCount: 0;
  externalAggregateEvaluationCount: 1;
  monthlyAnalysisPerformed: false;
  teamAnalysisPerformed: false;
  subgroupAnalysisPerformed: false;
  featureDiagnosticPerformed: false;
  calibrationBinAnalysisPerformed: false;
  thresholdSearchPerformed: false;
  "2025ModelUnseenBeforeEvaluation": true;
  "2025ModelUnseenAfterEvaluation": false;
  "2025JoinParsed": true;
  externalReplicationExposed: true;
  modelCandidate: false;
  holdoutEvaluated: false;
  holdoutFeatureRowsRead: 0;
  holdoutLabelRowsRead: 0;
  holdoutTransformedRows: 0;
  holdoutLogitsCreated: 0;
  holdoutProbabilitiesCreated: 0;
  engineChanged: false;
  recommendationChanged: false;
  todayPredictionCreated: false;
  currentDayPipelineChanged: false;
  evaluationArtifactSha256: string;
  protocolArtifactSha256: typeof MLB_INDEPENDENT_2025_SEALED_V2C_PROTOCOL_SHA256;
  joinArtifactSha256: typeof MLB_INDEPENDENT_2025_SEALED_JOIN_SHA256;
  v2cModelArtifactSha256: typeof MLB_INDEPENDENT_2025_SEALED_V2C_MODEL_ARTIFACT_SHA256;
  v2cModelCoreHash: typeof MLB_INDEPENDENT_2025_SEALED_V2C_MODEL_CORE_HASH;
};

export type ExternalReplicationEvaluationResult2025 = {
  evaluation: ExternalReplicationEvaluationArtifact2025;
  audit: ExternalReplicationEvaluationAudit2025;
};

function sameStringList(actual: unknown, expected: readonly string[]): boolean {
  if (!Array.isArray(actual) || actual.length !== expected.length) return false;
  return actual.every((name, i) => name === expected[i]);
}

function asNumberList(value: unknown): number[] | null {
  if (!Array.isArray(value)) return null;
  if (!value.every((item) => typeof item === "number")) return null;
  return value;
}

export function independentExternalReplication2025V2cEvaluationRel(): string {
  return "data/research/mlb/independent-model-v1/external-replication/2025/evaluations/2025-v2c-external-replication-evaluation-v1.json";
}

export function independentExternalReplication2025V2cEvaluationPath(
  cwd = process.cwd(),
): string {
  return path.join(cwd, independentExternalReplication2025V2cEvaluationRel());
}

export function independentExternalReplication2025V2cEvaluationAuditRel(): string {
  return "data/research/mlb/independent-model-v1/external-replication/2025/audits/2025-v2c-external-replication-evaluation-audit-v1.json";
}

export function independentExternalReplication2025V2cEvaluationAuditPath(
  cwd = process.cwd(),
): string {
  return path.join(cwd, independentExternalReplication2025V2cEvaluationAuditRel());
}

export function hashExternalReplicationEvaluationArtifact2025(
  evaluation: ExternalReplicationEvaluationArtifact2025,
): string {
  return sha256Utf8(serializeExternalReplicationJson(evaluation));
}

export function classifyHomeWinProbability2025(probability: number): 0 | 1 {
  if (!(probability > 0) || !(probability < 1)) {
    throw new ExternalReplicationEvaluationError(
      "PROBABILITY_OUT_OF_BOUNDS",
      `${probability}`,
    );
  }
  return probability >= FROZEN_V2C_THRESHOLD ? 1 : 0;
}

export function percentileLinear2025(sortedAscending: number[], q: number): number {
  if (sortedAscending.length === 0) return 0;
  const index = (sortedAscending.length - 1) * q;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sortedAscending[lower]!;
  return (
    sortedAscending[lower]! +
    (index - lower) * (sortedAscending[upper]! - sortedAscending[lower]!)
  );
}

export function rocAucMannWhitney2025(
  y: ArrayLike<number>,
  scores: ArrayLike<number>,
): number {
  const n = y.length;
  if (n === 0 || scores.length !== n) {
    throw new ExternalReplicationEvaluationError(
      "AUC_LENGTH_MISMATCH",
      `${n} vs ${scores.length}`,
    );
  }
  let nPos = 0;
  for (let i = 0; i < n; i += 1) if (y[i] === 1) nPos += 1;
  const nNeg = n - nPos;
  if (nPos === 0 || nNeg === 0) return 0.5;
  const indexed = Array.from({ length: n }, (_, i) => ({
    s: scores[i]!,
    i,
  }));
  indexed.sort((a, b) => (a.s !== b.s ? a.s - b.s : a.i - b.i));
  const ranks = new Array<number>(n);
  let i = 0;
  while (i < n) {
    let j = i;
    while (j + 1 < n && indexed[j + 1]!.s === indexed[i]!.s) j += 1;
    const avgRank = (i + j) / 2 + 1;
    for (let k = i; k <= j; k += 1) ranks[indexed[k]!.i] = avgRank;
    i = j + 1;
  }
  let sumPos = 0;
  for (let k = 0; k < n; k += 1) {
    if (y[k] === 1) sumPos += ranks[k]!;
  }
  const u = sumPos - (nPos * (nPos + 1)) / 2;
  return u / (nPos * nNeg);
}

export function directionalVerdictFromChecks2025(input: {
  AUC_PASS: boolean;
  LOGLOSS_PASS: boolean;
  BRIER_PASS: boolean;
}): ExternalReplicationDirectionalVerdict2025 {
  const passCount =
    Number(input.AUC_PASS) + Number(input.LOGLOSS_PASS) + Number(input.BRIER_PASS);
  if (passCount === 3) return "DIRECTIONAL_EXTERNAL_REPLICATION_SUPPORTED";
  if (passCount === 0) return "EXTERNAL_REPLICATION_NOT_SUPPORTED";
  return "MIXED_EXTERNAL_REPLICATION";
}

export function assertExternalReplication2025ProtocolShaPin(
  protocolSha256: string,
): void {
  if (protocolSha256 !== MLB_INDEPENDENT_2025_SEALED_V2C_PROTOCOL_SHA256) {
    throw new ExternalReplicationEvaluationError(
      "PROTOCOL_SHA_PIN_MISMATCH",
      `expected ${MLB_INDEPENDENT_2025_SEALED_V2C_PROTOCOL_SHA256}, got ${protocolSha256}`,
    );
  }
}

export function assertExternalReplication2025ModelArtifactShaPin(
  modelArtifactSha256: string,
): void {
  if (modelArtifactSha256 !== MLB_INDEPENDENT_2025_SEALED_V2C_MODEL_ARTIFACT_SHA256) {
    throw new ExternalReplicationEvaluationError(
      "MODEL_ARTIFACT_SHA_PIN_MISMATCH",
      `expected ${MLB_INDEPENDENT_2025_SEALED_V2C_MODEL_ARTIFACT_SHA256}, got ${modelArtifactSha256}`,
    );
  }
}

function readFeatureField(
  feature: MlbIndependentFeatureRowV1,
  name: string,
): number | null {
  if (name.startsWith("home.") || name.startsWith("away.")) {
    const [side, field] = name.split(".") as ["home" | "away", string];
    const value = (feature[side] as Record<string, number | null>)[field];
    if (value === null) return null;
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new ExternalReplicationEvaluationError(
        "FEATURE_NONFINITE",
        `${name}=${value} gamePk=${feature.identity.gamePk}`,
      );
    }
    return value;
  }
  throw new ExternalReplicationEvaluationError("FEATURE_NAME_INVALID", name);
}

export function transformExternalReplicationFeatureWithFrozenPrep2025(
  feature: MlbIndependentFeatureRowV1,
  prep: FrozenV2cEvaluationModel2025["preprocessing"],
): number[] {
  const out = new Array<number>(FROZEN_V2C_MODEL_DIMENSIONS);
  for (let j = 0; j < FROZEN_V2C_BASE_DIMENSIONS; j += 1) {
    const name = FROZEN_V2C_ORDERED_BASE_FEATURE_NAMES[j]!;
    const raw = readFeatureField(feature, name);
    const filled = raw == null ? prep.medianByFeature[name]! : raw;
    const scale = prep.scaleByFeature[name]!;
    const mean = prep.meanByFeature[name]!;
    out[j] = (filled - mean) / scale;
    if (!Number.isFinite(out[j]!)) {
      throw new ExternalReplicationEvaluationError(
        "TRANSFORM_NONFINITE",
        `${name}=${out[j]}`,
      );
    }
  }
  for (let j = 0; j < FROZEN_V2C_MISSING_INDICATORS; j += 1) {
    const indicator = FROZEN_V2C_ORDERED_MISSING_INDICATOR_NAMES[j]!;
    const fieldName = indicator.replace(/\.missing$/, "");
    const raw = readFeatureField(feature, fieldName);
    out[FROZEN_V2C_BASE_DIMENSIONS + j] = raw == null ? 1 : 0;
  }
  if (out.length !== FROZEN_V2C_MODEL_DIMENSIONS) {
    throw new ExternalReplicationEvaluationError(
      "TRANSFORM_DIMENSION_MISMATCH",
      `${out.length}`,
    );
  }
  return out;
}

export function assertFrozenV2cEvaluationModelContract2025(
  model: FrozenV2cModelProtocolView,
): asserts model is FrozenV2cEvaluationModel2025 {
  if (model.modelCoreHash !== MLB_INDEPENDENT_2025_SEALED_V2C_MODEL_CORE_HASH) {
    throw new ExternalReplicationEvaluationError(
      "MODEL_CORE_HASH_PIN_MISMATCH",
      `expected ${MLB_INDEPENDENT_2025_SEALED_V2C_MODEL_CORE_HASH}, got ${String(model.modelCoreHash)}`,
    );
  }
  const coefficients = asNumberList(model.coefficients);
  if (coefficients === null || coefficients.length !== FROZEN_V2C_MODEL_DIMENSIONS) {
    throw new ExternalReplicationEvaluationError(
      "MODEL_COEFFICIENT_COUNT_MISMATCH",
      `expected ${FROZEN_V2C_MODEL_DIMENSIONS}, got ${coefficients?.length ?? "invalid"}`,
    );
  }
  if (model.featureSpec?.modelDimensions !== FROZEN_V2C_MODEL_DIMENSIONS) {
    throw new ExternalReplicationEvaluationError(
      "MODEL_FEATURE_DIMENSION_MISMATCH",
      String(model.featureSpec?.modelDimensions),
    );
  }
  if (model.featureSpec?.baseDimensions !== FROZEN_V2C_BASE_DIMENSIONS) {
    throw new ExternalReplicationEvaluationError(
      "MODEL_BASE_DIMENSION_MISMATCH",
      String(model.featureSpec?.baseDimensions),
    );
  }
  if (model.featureSpec?.missingIndicators !== FROZEN_V2C_MISSING_INDICATORS) {
    throw new ExternalReplicationEvaluationError(
      "MODEL_MISSING_INDICATOR_COUNT_MISMATCH",
      String(model.featureSpec?.missingIndicators),
    );
  }
  if (model.preprocessing?.fitPartition !== FROZEN_PREPROCESSOR_FIT_PARTITION) {
    throw new ExternalReplicationEvaluationError(
      "PREPROCESSING_FIT_PARTITION_MISMATCH",
      String(model.preprocessing?.fitPartition),
    );
  }
  if (model.preprocessing?.fitSampleCount !== 1463) {
    throw new ExternalReplicationEvaluationError(
      "PREPROCESSING_FIT_SAMPLE_COUNT_MISMATCH",
      String(model.preprocessing?.fitSampleCount),
    );
  }
  if (
    !sameStringList(
      model.featureSpec?.orderedBaseFeatureNames,
      FROZEN_V2C_ORDERED_BASE_FEATURE_NAMES,
    ) ||
    !sameStringList(
      model.preprocessing?.orderedBaseFeatureNames,
      FROZEN_V2C_ORDERED_BASE_FEATURE_NAMES,
    )
  ) {
    throw new ExternalReplicationEvaluationError(
      "BASE_FEATURE_ORDER_MISMATCH",
      "frozen base feature order required",
    );
  }
  if (
    !sameStringList(
      model.featureSpec?.orderedMissingIndicatorNames,
      FROZEN_V2C_ORDERED_MISSING_INDICATOR_NAMES,
    ) ||
    !sameStringList(
      model.preprocessing?.orderedMissingIndicatorNames,
      FROZEN_V2C_ORDERED_MISSING_INDICATOR_NAMES,
    )
  ) {
    throw new ExternalReplicationEvaluationError(
      "MISSING_INDICATOR_ORDER_MISMATCH",
      "frozen missing-indicator order required",
    );
  }
  const orderedModel = [
    ...FROZEN_V2C_ORDERED_BASE_FEATURE_NAMES,
    ...FROZEN_V2C_ORDERED_MISSING_INDICATOR_NAMES,
  ];
  if (!sameStringList(model.featureSpec?.orderedModelFeatureNames, orderedModel)) {
    throw new ExternalReplicationEvaluationError(
      "MODEL_FEATURE_ORDER_MISMATCH",
      "frozen model feature order required",
    );
  }
  if (model.hyperparameters?.threshold !== FROZEN_V2C_THRESHOLD) {
    throw new ExternalReplicationEvaluationError(
      "THRESHOLD_MISMATCH",
      String(model.hyperparameters?.threshold),
    );
  }
  if (model.intercept !== FROZEN_V2C_INTERCEPT) {
    throw new ExternalReplicationEvaluationError(
      "INTERCEPT_MISMATCH",
      String(model.intercept),
    );
  }
  if (model.hyperparameters?.lambda !== FROZEN_V2C_LAMBDA) {
    throw new ExternalReplicationEvaluationError(
      "LAMBDA_MISMATCH",
      String(model.hyperparameters?.lambda),
    );
  }
  if (
    model.preprocessing?.medianByFeature == null ||
    model.preprocessing.meanByFeature == null ||
    model.preprocessing.scaleByFeature == null ||
    !Array.isArray(model.preprocessing.zeroVarianceFeatureNames)
  ) {
    throw new ExternalReplicationEvaluationError(
      "PREPROCESSING_STORED_STATS_MISSING",
      "frozen 2024 TRAIN stored stats required",
    );
  }
}

export function assertPreOpenV2cExternalReplicationGates2025(input: {
  protocolSha256: string;
  joinSha256: string;
  modelArtifactSha256: string;
  protocol: FrozenV2cExternalReplicationProtocol2025;
  model: FrozenV2cModelProtocolView;
}): void {
  assertExternalReplication2025ProtocolShaPin(input.protocolSha256);
  try {
    assertExternalReplication2025JoinShaPin(input.joinSha256);
  } catch (e) {
    const err = e as { code?: string; message?: string };
    throw new ExternalReplicationEvaluationError(
      err.code === "JOIN_SHA_PIN_MISMATCH" ? "JOIN_SHA_PIN_MISMATCH" : "JOIN_SHA_PIN_MISMATCH",
      err.message ?? String(e),
    );
  }
  assertExternalReplication2025ModelArtifactShaPin(input.modelArtifactSha256);
  assertFrozenV2cExternalReplicationProtocol2025(input.protocol);
  const protocolHash = hashExternalReplicationProtocolArtifact2025(input.protocol);
  if (protocolHash !== MLB_INDEPENDENT_2025_SEALED_V2C_PROTOCOL_SHA256) {
    throw new ExternalReplicationEvaluationError(
      "PROTOCOL_SHA_PIN_MISMATCH",
      `re-serialized protocol ${protocolHash}`,
    );
  }
  if (input.protocol.joinArtifactSha256 !== MLB_INDEPENDENT_2025_SEALED_JOIN_SHA256) {
    throw new ExternalReplicationEvaluationError(
      "JOIN_SHA_PIN_MISMATCH",
      input.protocol.joinArtifactSha256,
    );
  }
  if (input.protocol.v2cModelCoreHash !== MLB_INDEPENDENT_2025_SEALED_V2C_MODEL_CORE_HASH) {
    throw new ExternalReplicationEvaluationError(
      "MODEL_CORE_HASH_PIN_MISMATCH",
      input.protocol.v2cModelCoreHash,
    );
  }
  assertFrozenV2cEvaluationModelContract2025(input.model);
}

function validateJoinedRow2025(row: ExternalReplicationJoinRow2025, index: number): 0 | 1 {
  if (row.identity == null || row.featureHash == null || row.feature == null || row.label == null) {
    throw new ExternalReplicationEvaluationError(
      "JOIN_ROW_FIELDS_MISSING",
      `index ${index}`,
    );
  }
  const winner = row.label.winner;
  const target = row.label.target;
  if (target !== 0 && target !== 1) {
    throw new ExternalReplicationEvaluationError(
      "LABEL_TARGET_INVALID",
      `gamePk ${row.identity.gamePk} target=${String(target)}`,
    );
  }
  if (winner === "HOME" && target !== 1) {
    throw new ExternalReplicationEvaluationError(
      "WINNER_TARGET_MISMATCH",
      `gamePk ${row.identity.gamePk} HOME/${target}`,
    );
  }
  if (winner === "AWAY" && target !== 0) {
    throw new ExternalReplicationEvaluationError(
      "WINNER_TARGET_MISMATCH",
      `gamePk ${row.identity.gamePk} AWAY/${target}`,
    );
  }
  if (winner !== "HOME" && winner !== "AWAY") {
    throw new ExternalReplicationEvaluationError(
      "LABEL_WINNER_INVALID",
      `gamePk ${row.identity.gamePk}`,
    );
  }
  return target;
}

function scoreTransformedRow2025(
  x: number[],
  intercept: number,
  coefficients: number[],
): { logit: number; probability: number } {
  if (x.length !== FROZEN_V2C_MODEL_DIMENSIONS || coefficients.length !== FROZEN_V2C_MODEL_DIMENSIONS) {
    throw new ExternalReplicationEvaluationError(
      "SCORE_DIMENSION_MISMATCH",
      `${x.length}/${coefficients.length}`,
    );
  }
  let logit = intercept;
  for (let j = 0; j < coefficients.length; j += 1) {
    logit += coefficients[j]! * x[j]!;
  }
  if (!Number.isFinite(logit)) {
    throw new ExternalReplicationEvaluationError("LOGIT_NONFINITE", `${logit}`);
  }
  const probability = stableSigmoid(logit);
  if (!Number.isFinite(probability) || !(probability > 0) || !(probability < 1)) {
    throw new ExternalReplicationEvaluationError(
      "PROBABILITY_OUT_OF_BOUNDS",
      `${probability}`,
    );
  }
  return { logit, probability };
}

export function evaluateV2cExternalReplication2025(input: {
  protocolSha256: string;
  joinSha256: string;
  modelArtifactSha256: string;
  protocol: FrozenV2cExternalReplicationProtocol2025;
  model: FrozenV2cModelProtocolView;
  join: ExternalReplicationJoinArtifact2025;
  sealed?: boolean;
  generatedAt?: string;
}): ExternalReplicationEvaluationResult2025 {
  assertPreOpenV2cExternalReplicationGates2025(input);
  const model = input.model as FrozenV2cEvaluationModel2025;
  const sealed = input.sealed !== false;
  if (input.join.joinReady !== true) {
    throw new ExternalReplicationEvaluationError("JOIN_NOT_READY", "joinReady");
  }
  if (input.join.datasetReady !== false) {
    throw new ExternalReplicationEvaluationError("DATASET_READY_NOT_FALSE", "datasetReady");
  }
  const n = input.join.rows.length;
  if (sealed) {
    if (n !== MLB_INDEPENDENT_2025_EXTERNAL_SAMPLE_COUNT) {
      throw new ExternalReplicationEvaluationError(
        "EVALUATION_SAMPLE_COUNT_MISMATCH",
        `${n} != ${MLB_INDEPENDENT_2025_EXTERNAL_SAMPLE_COUNT}`,
      );
    }
    if (input.join.independentModelSample !== MLB_INDEPENDENT_2025_EXTERNAL_SAMPLE_COUNT) {
      throw new ExternalReplicationEvaluationError(
        "EVALUATION_SAMPLE_COUNT_MISMATCH",
        `independentModelSample ${input.join.independentModelSample}`,
      );
    }
  }
  if (n === 0) {
    throw new ExternalReplicationEvaluationError("EVALUATION_SAMPLE_COUNT_MISMATCH", "0");
  }

  const coefficients = model.coefficients;
  const rows: ExternalReplicationEvaluationRow2025[] = [];
  const y: number[] = [];
  const probabilities: number[] = [];
  for (let i = 0; i < n; i += 1) {
    const joined = input.join.rows[i]!;
    const target = validateJoinedRow2025(joined, i);
    const x = transformExternalReplicationFeatureWithFrozenPrep2025(
      joined.feature,
      model.preprocessing,
    );
    if (x.length !== FROZEN_V2C_MODEL_DIMENSIONS) {
      throw new ExternalReplicationEvaluationError("TRANSFORM_DIMENSION_MISMATCH", `${x.length}`);
    }
    const scored = scoreTransformedRow2025(x, model.intercept, coefficients);
    const predictedClass = classifyHomeWinProbability2025(scored.probability);
    rows.push({
      gamePk: joined.identity.gamePk,
      officialDate: joined.identity.officialDate,
      commenceTimeUtc: joined.identity.commenceTimeUtc,
      target,
      probability: scored.probability,
      predictedClass,
      correct: predictedClass === target,
    });
    y.push(target);
    probabilities.push(scored.probability);
  }

  const metrics = evaluateProbabilitiesV1(y, probabilities, FROZEN_V2C_THRESHOLD);
  const rocAuc = rocAucMannWhitney2025(y, probabilities);
  const baseline = evaluateProbabilitiesV1(
    y,
    Array.from({ length: n }, () => FROZEN_CONSTANT_BASELINE_PROBABILITY),
    FROZEN_V2C_THRESHOLD,
  );
  const signedProbabilityBias =
    metrics.meanPredictedProbability - metrics.actualHomeRate;
  const directionalChecks = {
    AUC_PASS: rocAuc > 0.5,
    LOGLOSS_PASS: metrics.logLoss < baseline.logLoss,
    BRIER_PASS: metrics.brierScore < baseline.brierScore,
    passCount:
      Number(rocAuc > 0.5) +
      Number(metrics.logLoss < baseline.logLoss) +
      Number(metrics.brierScore < baseline.brierScore),
  };
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const evaluation: ExternalReplicationEvaluationArtifact2025 = {
    schemaVersion: MLB_INDEPENDENT_2025_V2C_EVALUATION_SCHEMA_V1,
    generatedAt,
    researchOnly: true,
    track: MLB_INDEPENDENT_EXTERNAL_REPLICATION_TRACK,
    stage: MLB_INDEPENDENT_2025_V2C_EVALUATION_STAGE,
    engineAdmission: MLB_INDEPENDENT_ENGINE_ADMISSION,
    modelCandidate: false,
    protocolArtifactSha256: MLB_INDEPENDENT_2025_SEALED_V2C_PROTOCOL_SHA256,
    joinArtifactSha256: MLB_INDEPENDENT_2025_SEALED_JOIN_SHA256,
    v2cModelArtifactSha256: MLB_INDEPENDENT_2025_SEALED_V2C_MODEL_ARTIFACT_SHA256,
    v2cModelCoreHash: MLB_INDEPENDENT_2025_SEALED_V2C_MODEL_CORE_HASH,
    sampleCount: n,
    excludedCount: 0,
    rows,
    primaryMetrics: {
      rocAuc,
      logLoss: metrics.logLoss,
      brierScore: metrics.brierScore,
    },
    secondaryMetrics: {
      accuracy: metrics.accuracy,
      TP: metrics.confusion.TP,
      TN: metrics.confusion.TN,
      FP: metrics.confusion.FP,
      FN: metrics.confusion.FN,
      actualHomeRate: metrics.actualHomeRate,
      predictedHomeClassRate: metrics.predictedHomeRate,
      meanPredictedHomeProbability: metrics.meanPredictedProbability,
      signedProbabilityBias,
      absoluteProbabilityBias: Math.abs(signedProbabilityBias),
      minimumProbability: metrics.minimumProbability,
      p10: percentileLinear2025([...probabilities].sort((a, b) => a - b), 0.1),
      p25: percentileLinear2025([...probabilities].sort((a, b) => a - b), 0.25),
      median: percentileLinear2025([...probabilities].sort((a, b) => a - b), 0.5),
      p75: percentileLinear2025([...probabilities].sort((a, b) => a - b), 0.75),
      p90: percentileLinear2025([...probabilities].sort((a, b) => a - b), 0.9),
      maximumProbability: metrics.maximumProbability,
    },
    constantBaselineMetrics: {
      probability: FROZEN_CONSTANT_BASELINE_PROBABILITY,
      rocAuc: 0.5,
      accuracy: baseline.accuracy,
      logLoss: baseline.logLoss,
      brierScore: baseline.brierScore,
    },
    directionalChecks,
    directionalVerdict: directionalVerdictFromChecks2025(directionalChecks),
    "2024Context": {
      trainAuc: FROZEN_V2C_TRAIN_CONTEXT_2024.rocAuc,
      validationAuc: FROZEN_V2C_VALIDATION_CONTEXT_2024.rocAuc,
      externalAuc: rocAuc,
      externalMinusTrainAuc: rocAuc - FROZEN_V2C_TRAIN_CONTEXT_2024.rocAuc,
      externalMinusValidationAuc: rocAuc - FROZEN_V2C_VALIDATION_CONTEXT_2024.rocAuc,
      externalToTrainAucRatio: rocAuc / FROZEN_V2C_TRAIN_CONTEXT_2024.rocAuc,
      validationAccuracy: FROZEN_V2C_VALIDATION_CONTEXT_2024.accuracy,
      validationLogLoss: FROZEN_V2C_VALIDATION_CONTEXT_2024.logLoss,
      validationBrier: FROZEN_V2C_VALIDATION_CONTEXT_2024.brierScore,
      validationMeanProbability: FROZEN_V2C_VALIDATION_CONTEXT_2024.meanPredictedProbability,
      descriptiveOnly: true,
    },
  };
  const evaluationArtifactSha256 =
    hashExternalReplicationEvaluationArtifact2025(evaluation);
  const audit: ExternalReplicationEvaluationAudit2025 = {
    generatedAt,
    researchOnly: true,
    track: MLB_INDEPENDENT_EXTERNAL_REPLICATION_TRACK,
    stage: MLB_INDEPENDENT_2025_V2C_EVALUATION_STAGE,
    engineAdmission: MLB_INDEPENDENT_ENGINE_ADMISSION,
    marketUsed: false,
    networkUsed: false,
    protocolShaVerified: true,
    joinShaVerified: true,
    modelArtifactShaVerified: true,
    modelCoreHashVerified: true,
    preprocessorSource: FROZEN_PREPROCESSOR_SOURCE,
    preprocessorRefit: false,
    modelRefit: false,
    interceptRefit: false,
    coefficientUpdate: false,
    thresholdTuned: false,
    calibrationPerformed: false,
    sampleCount: n,
    excludedCount: 0,
    transformedRows: n,
    modelDimensions: FROZEN_V2C_MODEL_DIMENSIONS,
    logitsCreated: n,
    probabilitiesCreated: n,
    nonfiniteTransformCount: 0,
    nonfiniteLogitCount: 0,
    nonfiniteProbabilityCount: 0,
    externalAggregateEvaluationCount: 1,
    monthlyAnalysisPerformed: false,
    teamAnalysisPerformed: false,
    subgroupAnalysisPerformed: false,
    featureDiagnosticPerformed: false,
    calibrationBinAnalysisPerformed: false,
    thresholdSearchPerformed: false,
    "2025ModelUnseenBeforeEvaluation": true,
    "2025ModelUnseenAfterEvaluation": false,
    "2025JoinParsed": true,
    externalReplicationExposed: true,
    modelCandidate: false,
    holdoutEvaluated: false,
    holdoutFeatureRowsRead: 0,
    holdoutLabelRowsRead: 0,
    holdoutTransformedRows: 0,
    holdoutLogitsCreated: 0,
    holdoutProbabilitiesCreated: 0,
    engineChanged: false,
    recommendationChanged: false,
    todayPredictionCreated: false,
    currentDayPipelineChanged: false,
    evaluationArtifactSha256,
    protocolArtifactSha256: MLB_INDEPENDENT_2025_SEALED_V2C_PROTOCOL_SHA256,
    joinArtifactSha256: MLB_INDEPENDENT_2025_SEALED_JOIN_SHA256,
    v2cModelArtifactSha256: MLB_INDEPENDENT_2025_SEALED_V2C_MODEL_ARTIFACT_SHA256,
    v2cModelCoreHash: MLB_INDEPENDENT_2025_SEALED_V2C_MODEL_CORE_HASH,
  };
  return { evaluation, audit };
}

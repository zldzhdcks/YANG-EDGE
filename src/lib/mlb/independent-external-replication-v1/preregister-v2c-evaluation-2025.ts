/**
 * 2025 EXTERNAL REPLICATION TRACK — freeze the one-time v2-C evaluation protocol.
 *
 * PROTOCOL ONLY. Does not open 2025 model performance.
 * Does not parse joined 2025 rows. Does not transform, score, or evaluate.
 */
import path from "node:path";
import {
  MLB_INDEPENDENT_ENGINE_ADMISSION,
} from "../independent-model-v1";
import {
  MLB_INDEPENDENT_2025_SEALED_SOURCE_SHA256,
  MLB_INDEPENDENT_EXTERNAL_REPLICATION_TRACK,
  serializeExternalReplicationJson,
  sha256Utf8,
} from "./source-2025";
import {
  MLB_INDEPENDENT_2025_SEALED_FEATURE_SHA256,
  MLB_INDEPENDENT_2025_SEALED_LABEL_SHA256,
  independentExternalReplication2025JoinRel,
} from "./join-feature-label-2025";

export const MLB_INDEPENDENT_2025_V2C_PROTOCOL_STAGE =
  "EXTERNAL_REPLICATION_PROTOCOL" as const;
export const MLB_INDEPENDENT_2025_V2C_PROTOCOL_SCHEMA_V1 =
  "mlb-independent-2025-v2c-external-replication-protocol-v1" as const;

export const MLB_INDEPENDENT_2025_SEALED_JOIN_SHA256 =
  "aafe735333222c1c7c73d4a1b83203e6dbbcb19ddf9deba89fa6d8587d2b06db";
export const MLB_INDEPENDENT_2025_SEALED_V2C_MODEL_CORE_HASH =
  "5412b6bae88e5d7fad53f8962950e4c9846470b14433e73edd9cbfe96631d126";

export const MLB_INDEPENDENT_2025_EXTERNAL_SAMPLE_COUNT = 2430 as const;
export const FROZEN_V2C_BASE_DIMENSIONS = 20 as const;
export const FROZEN_V2C_MISSING_INDICATORS = 22 as const;
export const FROZEN_V2C_MODEL_DIMENSIONS = 42 as const;
export const FROZEN_V2C_INTERCEPT = 0.14539743342695882;
export const FROZEN_V2C_THRESHOLD = 0.5;
export const FROZEN_V2C_LAMBDA = 0.01;
export const FROZEN_CONSTANT_BASELINE_HOME_WINS = 776 as const;
export const FROZEN_CONSTANT_BASELINE_TRAIN_N = 1463 as const;
export const FROZEN_CONSTANT_BASELINE_PROBABILITY =
  FROZEN_CONSTANT_BASELINE_HOME_WINS / FROZEN_CONSTANT_BASELINE_TRAIN_N;
export const FROZEN_PREPROCESSOR_SOURCE = "FROZEN_2024_TRAIN" as const;
export const FROZEN_PREPROCESSOR_FIT_PARTITION = "TRAIN" as const;

export const FROZEN_V2C_ORDERED_BASE_FEATURE_NAMES = [
  "home.winRateBefore",
  "home.last5WinsBefore",
  "home.last5LossesBefore",
  "home.last5WinRateBefore",
  "home.runsScoredAverageBefore",
  "home.runsAllowedAverageBefore",
  "home.last5RunsScoredAverageBefore",
  "home.last5RunsAllowedAverageBefore",
  "home.homeWinRateBefore",
  "home.awayWinRateBefore",
  "away.winRateBefore",
  "away.last5WinsBefore",
  "away.last5LossesBefore",
  "away.last5WinRateBefore",
  "away.runsScoredAverageBefore",
  "away.runsAllowedAverageBefore",
  "away.last5RunsScoredAverageBefore",
  "away.last5RunsAllowedAverageBefore",
  "away.homeWinRateBefore",
  "away.awayWinRateBefore",
] as const;

export const FROZEN_V2C_ORDERED_MISSING_INDICATOR_NAMES = [
  "home.winRateBefore.missing",
  "home.last5WinsBefore.missing",
  "home.last5LossesBefore.missing",
  "home.last5WinRateBefore.missing",
  "home.runsScoredAverageBefore.missing",
  "home.runsAllowedAverageBefore.missing",
  "home.last5RunsScoredAverageBefore.missing",
  "home.last5RunsAllowedAverageBefore.missing",
  "home.homeWinRateBefore.missing",
  "home.awayWinRateBefore.missing",
  "home.restDaysBefore.missing",
  "away.winRateBefore.missing",
  "away.last5WinsBefore.missing",
  "away.last5LossesBefore.missing",
  "away.last5WinRateBefore.missing",
  "away.runsScoredAverageBefore.missing",
  "away.runsAllowedAverageBefore.missing",
  "away.last5RunsScoredAverageBefore.missing",
  "away.last5RunsAllowedAverageBefore.missing",
  "away.homeWinRateBefore.missing",
  "away.awayWinRateBefore.missing",
  "away.restDaysBefore.missing",
] as const;

export const FROZEN_V2C_REMOVED_H2H_FEATURE_NAMES = [
  "headToHeadGamesBefore",
  "headToHeadHomeWinsBefore",
  "headToHeadAwayWinsBefore",
] as const;

export const FROZEN_PRIMARY_ENDPOINTS = [
  "ROC AUC",
  "LogLoss",
  "Brier Score",
] as const;

export const FROZEN_SECONDARY_ENDPOINTS = [
  "accuracy at threshold 0.5",
  "TP",
  "TN",
  "FP",
  "FN",
  "actual HOME rate",
  "predicted HOME class rate",
  "mean predicted HOME probability",
  "signed probability bias",
  "absolute probability bias",
  "minimum probability",
  "p10",
  "p25",
  "median",
  "p75",
  "p90",
  "maximum probability",
] as const;

export const FROZEN_V2C_VALIDATION_CONTEXT_2024 = {
  rocAuc: 0.5553249871377123,
  accuracy: 0.5652173913043478,
  logLoss: 0.6902564942247655,
  brierScore: 0.24851268325592688,
  meanPredictedProbability: 0.531184644100952,
} as const;

export const FROZEN_V2C_TRAIN_CONTEXT_2024 = {
  rocAuc: 0.5991226984198442,
} as const;

export function independentExternalReplication2025V2cProtocolRel(): string {
  return "data/research/mlb/independent-model-v1/external-replication/2025/protocols/2025-v2c-external-replication-protocol-v1.json";
}

export function independentExternalReplication2025V2cProtocolPath(
  cwd = process.cwd(),
): string {
  return path.join(cwd, independentExternalReplication2025V2cProtocolRel());
}

export function independentExternalReplication2025V2cProtocolAuditRel(): string {
  return "data/research/mlb/independent-model-v1/external-replication/2025/audits/2025-v2c-external-replication-protocol-audit-v1.json";
}

export function independentExternalReplication2025V2cProtocolAuditPath(
  cwd = process.cwd(),
): string {
  return path.join(cwd, independentExternalReplication2025V2cProtocolAuditRel());
}

export function independentSealedV2cModelArtifactRel(): string {
  return "data/research/mlb/independent-model-v1/model/2024-logistic-regression-head-to-head-ablation-v2c.json";
}

export function independentSealedV2cModelArtifactPath(
  cwd = process.cwd(),
): string {
  return path.join(cwd, independentSealedV2cModelArtifactRel());
}

export class ExternalReplicationProtocolError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(`${code}: ${message}`);
    this.name = "ExternalReplicationProtocolError";
    this.code = code;
  }
}

export type FrozenV2cModelProtocolView = {
  modelCoreHash?: unknown;
  intercept?: unknown;
  coefficients?: unknown;
  modelCandidate?: unknown;
  holdoutEvaluated?: unknown;
  featureSpec?: {
    orderedBaseFeatureNames?: unknown;
    orderedMissingIndicatorNames?: unknown;
    orderedModelFeatureNames?: unknown;
    baseDimensions?: unknown;
    missingIndicators?: unknown;
    modelDimensions?: unknown;
    removedFeatures?: unknown;
  };
  preprocessing?: {
    fitPartition?: unknown;
    fitSampleCount?: unknown;
    orderedBaseFeatureNames?: unknown;
    orderedMissingIndicatorNames?: unknown;
    medianByFeature?: unknown;
    meanByFeature?: unknown;
    scaleByFeature?: unknown;
    zeroVarianceFeatureNames?: unknown;
  };
  hyperparameters?: {
    lambda?: unknown;
    threshold?: unknown;
  };
};

export type FrozenV2cExternalReplicationProtocol2025 = {
  schemaVersion: typeof MLB_INDEPENDENT_2025_V2C_PROTOCOL_SCHEMA_V1;
  generatedAt: string;
  researchOnly: true;
  track: typeof MLB_INDEPENDENT_EXTERNAL_REPLICATION_TRACK;
  stage: typeof MLB_INDEPENDENT_2025_V2C_PROTOCOL_STAGE;
  engineAdmission: typeof MLB_INDEPENDENT_ENGINE_ADMISSION;
  scientificRole: "ONE_COMPLETE_EXTERNAL_REPLICATION_SET";
  joinArtifactRel: string;
  joinArtifactSha256: typeof MLB_INDEPENDENT_2025_SEALED_JOIN_SHA256;
  v2cModelArtifactRel: string;
  v2cModelArtifactSha256: string;
  v2cModelCoreHash: typeof MLB_INDEPENDENT_2025_SEALED_V2C_MODEL_CORE_HASH;
  sealedInputPins: {
    sourceSha256: typeof MLB_INDEPENDENT_2025_SEALED_SOURCE_SHA256;
    safeAFeatureSha256: typeof MLB_INDEPENDENT_2025_SEALED_FEATURE_SHA256;
    labelSha256: typeof MLB_INDEPENDENT_2025_SEALED_LABEL_SHA256;
    joinSha256: typeof MLB_INDEPENDENT_2025_SEALED_JOIN_SHA256;
  };
  expectedSampleCount: typeof MLB_INDEPENDENT_2025_EXTERNAL_SAMPLE_COUNT;
  frozenFeatureSpec: {
    baseDimensions: typeof FROZEN_V2C_BASE_DIMENSIONS;
    missingIndicators: typeof FROZEN_V2C_MISSING_INDICATORS;
    modelDimensions: typeof FROZEN_V2C_MODEL_DIMENSIONS;
    orderedBaseFeatureNames: string[];
    orderedMissingIndicatorNames: string[];
    orderedModelFeatureNames: string[];
    removedHeadToHeadFeatures: string[];
    headToHeadRemoved: true;
    streakRestBaseRemoved: true;
    seasonVolumeBaseRemoved: true;
    missingIndicatorOrderChanged: false;
    restDaysMissingIndicatorsRetained: true;
  };
  frozenPreprocessing: {
    PREPROCESSOR_SOURCE: typeof FROZEN_PREPROCESSOR_SOURCE;
    fitPartition: typeof FROZEN_PREPROCESSOR_FIT_PARTITION;
    fitSampleCount: typeof FROZEN_CONSTANT_BASELINE_TRAIN_N;
    useExactStored: [
      "medianByFeature",
      "meanByFeature",
      "scaleByFeature",
      "zeroVarianceFeatureNames",
    ];
    fitOn2025Allowed: false;
    combined2024And2025FitAllowed: false;
    applyStoredPreprocessorToEachJoinedFeatureRow: true;
  };
  frozenParameters: {
    intercept: typeof FROZEN_V2C_INTERCEPT;
    coefficientCount: typeof FROZEN_V2C_MODEL_DIMENSIONS;
    threshold: typeof FROZEN_V2C_THRESHOLD;
    lambdaProvenance: typeof FROZEN_V2C_LAMBDA;
    MODEL_REFIT_ALLOWED: false;
    INTERCEPT_REFIT_ALLOWED: false;
    COEFFICIENT_UPDATE_ALLOWED: false;
    THRESHOLD_TUNING_ALLOWED: false;
    CALIBRATION_ALLOWED: false;
  };
  primaryEndpoints: string[];
  secondaryEndpoints: string[];
  constantBaselineProbability: number;
  constantBaseline: {
    homeWins: typeof FROZEN_CONSTANT_BASELINE_HOME_WINS;
    trainSampleCount: typeof FROZEN_CONSTANT_BASELINE_TRAIN_N;
    probability: number;
    source: "2024_TRAIN_HOME_RATE";
    redefineFrom2025HomePrevalenceAllowed: false;
    requiredMetrics: [
      "constant baseline accuracy",
      "constant baseline LogLoss",
      "constant baseline Brier Score",
      "constant baseline ROC AUC = 0.5",
    ];
    alternateBaselineSelectionAfterResultsKnownAllowed: false;
  };
  directionalVerdictRules: {
    AUC_PASS: "v2-C ROC AUC > 0.5";
    LOGLOSS_PASS: "v2-C LogLoss < frozen constant baseline LogLoss";
    BRIER_PASS: "v2-C Brier < frozen constant baseline Brier";
    allThreePass: "DIRECTIONAL_EXTERNAL_REPLICATION_SUPPORTED";
    oneOrTwoPass: "MIXED_EXTERNAL_REPLICATION";
    zeroPass: "EXTERNAL_REPLICATION_NOT_SUPPORTED";
    classificationIsDirectionalEvidenceOnly: true;
    automaticModelCandidateDecision: false;
    newMagnitudeCutoffAfterSeeing2025Allowed: false;
  };
  v2cValidationContext2024: typeof FROZEN_V2C_VALIDATION_CONTEXT_2024;
  trainValidationExternalContext: {
    train2024Auc: typeof FROZEN_V2C_TRAIN_CONTEXT_2024.rocAuc;
    validation2024Auc: typeof FROZEN_V2C_VALIDATION_CONTEXT_2024.rocAuc;
    external2025Auc: "FUTURE_UNSEEN_RESULT";
    reportAfterEvaluation: [
      "externalMinusTrainAuc",
      "externalMinusValidationAuc",
      "external / train AUC ratio",
    ];
    descriptiveOnly: true;
    require2025ToMatchOrBeat2024ValidationAllowed: false;
  };
  aggregateOnlyRules: {
    EXTERNAL_AGGREGATE_EVALUATION_COUNT: 1;
    EXTERNAL_MONTHLY_ANALYSIS_PERFORMED: false;
    EXTERNAL_TEAM_ANALYSIS_PERFORMED: false;
    EXTERNAL_SUBGROUP_ANALYSIS_PERFORMED: false;
    EXTERNAL_FEATURE_DIAGNOSTIC_PERFORMED: false;
    EXTERNAL_CALIBRATION_BIN_ANALYSIS_PERFORMED: false;
    EXTERNAL_THRESHOLD_SEARCH_PERFORMED: false;
  };
  postOpenPolicy: {
    afterProbabilitiesOrMetricsCreated: "2025_MODEL_UNSEEN_BECOMES_NO";
    exposedName: "EXTERNAL_REPLICATION_EXPOSED";
    alterV2cAndRerun2025AsIfStillExternal: false;
    successorRequiresNewDevelopmentEvidence: true;
    successorRequiresDifferentUntouchedReplicationSet: true;
  };
  candidatePolicy: {
    V2C_MODEL_CANDIDATE_BEFORE_EXTERNAL: false;
    V2C_MODEL_CANDIDATE_AUTOMATIC_AFTER_EXTERNAL: false;
    allPrimaryMetricsImproveStillRequiresIndependentCtoReview: true;
  };
  holdoutPolicy: {
    remainsSealedRegardlessOf2025Result: true;
    automaticOpenIf2025LooksGood: false;
    evaluated: false;
    candidateReviewRequiredBeforeAnyHoldoutProtocol: true;
  };
  engineProductPolicy: {
    ENGINE_ADMISSION: typeof MLB_INDEPENDENT_ENGINE_ADMISSION;
    ENGINE_CHANGED: false;
    TODAY_PREDICTION_CREATED: false;
    RECOMMENDATION_CHANGED: false;
    CURRENT_DAY_PIPELINE_CHANGED: false;
  };
  futureEvaluator: {
    pinThisProtocolShaBeforeParsingJoinedRows: true;
    parseJoinedRowsDuringProtocolRegistration: false;
    createTransformedXDuringProtocolRegistration: false;
    createLogitsDuringProtocolRegistration: false;
    createProbabilitiesDuringProtocolRegistration: false;
    evaluateDuringProtocolRegistration: false;
  };
  prohibitions: string[];
};

export type FrozenV2cExternalReplicationProtocolAudit2025 = {
  generatedAt: string;
  researchOnly: true;
  track: typeof MLB_INDEPENDENT_EXTERNAL_REPLICATION_TRACK;
  stage: typeof MLB_INDEPENDENT_2025_V2C_PROTOCOL_STAGE;
  engineAdmission: typeof MLB_INDEPENDENT_ENGINE_ADMISSION;
  marketUsed: false;
  protocolCreated: true;
  protocolSealed: false;
  protocolArtifactSha256: string;
  joinShaVerified: true;
  joinRowsParsed: false;
  modelArtifactRead: true;
  modelCoreHashVerified: true;
  modelArtifactUnchanged: true;
  "2025TransformedXCreated": false;
  "2025LogitsCreated": false;
  "2025ProbabilitiesCreated": false;
  "2025Evaluated": false;
  "2025ModelUnseen": true;
  splitCreated: false;
  modelRefit: false;
  preprocessorRefit: false;
  thresholdTuned: false;
  calibrationPerformed: false;
  holdoutEvaluated: false;
  modelCandidate: false;
  engineChanged: false;
  recommendationChanged: false;
  joinArtifactSha256: typeof MLB_INDEPENDENT_2025_SEALED_JOIN_SHA256;
  v2cModelArtifactSha256: string;
  v2cModelCoreHash: typeof MLB_INDEPENDENT_2025_SEALED_V2C_MODEL_CORE_HASH;
  expectedSampleCount: typeof MLB_INDEPENDENT_2025_EXTERNAL_SAMPLE_COUNT;
};

export type FrozenV2cExternalReplicationProtocolResult2025 = {
  protocol: FrozenV2cExternalReplicationProtocol2025;
  audit: FrozenV2cExternalReplicationProtocolAudit2025;
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

export function hashExternalReplicationProtocolArtifact2025(
  protocol: FrozenV2cExternalReplicationProtocol2025,
): string {
  return sha256Utf8(serializeExternalReplicationJson(protocol));
}

export function assertExternalReplication2025JoinShaPin(joinSha256: string): void {
  if (joinSha256 !== MLB_INDEPENDENT_2025_SEALED_JOIN_SHA256) {
    throw new ExternalReplicationProtocolError(
      "JOIN_SHA_PIN_MISMATCH",
      `expected ${MLB_INDEPENDENT_2025_SEALED_JOIN_SHA256}, got ${joinSha256}`,
    );
  }
}

function assertFrozenV2cModelForProtocol(
  model: FrozenV2cModelProtocolView,
): void {
  if (model.modelCoreHash !== MLB_INDEPENDENT_2025_SEALED_V2C_MODEL_CORE_HASH) {
    throw new ExternalReplicationProtocolError(
      "MODEL_CORE_HASH_PIN_MISMATCH",
      `expected ${MLB_INDEPENDENT_2025_SEALED_V2C_MODEL_CORE_HASH}, got ${String(model.modelCoreHash)}`,
    );
  }
  const coefficients = asNumberList(model.coefficients);
  if (coefficients === null || coefficients.length !== FROZEN_V2C_MODEL_DIMENSIONS) {
    throw new ExternalReplicationProtocolError(
      "MODEL_COEFFICIENT_COUNT_MISMATCH",
      `expected ${FROZEN_V2C_MODEL_DIMENSIONS}, got ${coefficients?.length ?? "invalid"}`,
    );
  }
  if (model.featureSpec?.modelDimensions !== FROZEN_V2C_MODEL_DIMENSIONS) {
    throw new ExternalReplicationProtocolError(
      "MODEL_FEATURE_DIMENSION_MISMATCH",
      `expected ${FROZEN_V2C_MODEL_DIMENSIONS}, got ${String(model.featureSpec?.modelDimensions)}`,
    );
  }
  if (model.featureSpec?.baseDimensions !== FROZEN_V2C_BASE_DIMENSIONS) {
    throw new ExternalReplicationProtocolError(
      "MODEL_BASE_DIMENSION_MISMATCH",
      `expected ${FROZEN_V2C_BASE_DIMENSIONS}, got ${String(model.featureSpec?.baseDimensions)}`,
    );
  }
  if (model.featureSpec?.missingIndicators !== FROZEN_V2C_MISSING_INDICATORS) {
    throw new ExternalReplicationProtocolError(
      "MODEL_MISSING_INDICATOR_COUNT_MISMATCH",
      `expected ${FROZEN_V2C_MISSING_INDICATORS}, got ${String(model.featureSpec?.missingIndicators)}`,
    );
  }
  if (model.preprocessing?.fitPartition !== FROZEN_PREPROCESSOR_FIT_PARTITION) {
    throw new ExternalReplicationProtocolError(
      "PREPROCESSING_FIT_PARTITION_MISMATCH",
      `expected ${FROZEN_PREPROCESSOR_FIT_PARTITION}, got ${String(model.preprocessing?.fitPartition)}`,
    );
  }
  if (model.preprocessing?.fitSampleCount !== FROZEN_CONSTANT_BASELINE_TRAIN_N) {
    throw new ExternalReplicationProtocolError(
      "PREPROCESSING_FIT_SAMPLE_COUNT_MISMATCH",
      `expected ${FROZEN_CONSTANT_BASELINE_TRAIN_N}, got ${String(model.preprocessing?.fitSampleCount)}`,
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
    throw new ExternalReplicationProtocolError(
      "BASE_FEATURE_ORDER_MISMATCH",
      "sealed v2-C base feature order required",
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
    throw new ExternalReplicationProtocolError(
      "MISSING_INDICATOR_ORDER_MISMATCH",
      "sealed v2-C missing-indicator order required",
    );
  }
  const orderedModel = [
    ...FROZEN_V2C_ORDERED_BASE_FEATURE_NAMES,
    ...FROZEN_V2C_ORDERED_MISSING_INDICATOR_NAMES,
  ];
  if (!sameStringList(model.featureSpec?.orderedModelFeatureNames, orderedModel)) {
    throw new ExternalReplicationProtocolError(
      "MODEL_FEATURE_ORDER_MISMATCH",
      "sealed v2-C model feature order required",
    );
  }
  if (
    !sameStringList(
      model.featureSpec?.removedFeatures,
      FROZEN_V2C_REMOVED_H2H_FEATURE_NAMES,
    )
  ) {
    throw new ExternalReplicationProtocolError(
      "REMOVED_FEATURES_MISMATCH",
      "sealed v2-C removed H2H names required",
    );
  }
  if (model.hyperparameters?.threshold !== FROZEN_V2C_THRESHOLD) {
    throw new ExternalReplicationProtocolError(
      "THRESHOLD_MISMATCH",
      `expected ${FROZEN_V2C_THRESHOLD}, got ${String(model.hyperparameters?.threshold)}`,
    );
  }
  if (model.intercept !== FROZEN_V2C_INTERCEPT) {
    throw new ExternalReplicationProtocolError(
      "INTERCEPT_MISMATCH",
      `expected ${FROZEN_V2C_INTERCEPT}, got ${String(model.intercept)}`,
    );
  }
  if (model.hyperparameters?.lambda !== FROZEN_V2C_LAMBDA) {
    throw new ExternalReplicationProtocolError(
      "LAMBDA_MISMATCH",
      `expected ${FROZEN_V2C_LAMBDA}, got ${String(model.hyperparameters?.lambda)}`,
    );
  }
  if (
    model.preprocessing?.medianByFeature == null ||
    model.preprocessing.meanByFeature == null ||
    model.preprocessing.scaleByFeature == null ||
    !Array.isArray(model.preprocessing.zeroVarianceFeatureNames)
  ) {
    throw new ExternalReplicationProtocolError(
      "PREPROCESSING_STORED_STATS_MISSING",
      "frozen 2024 TRAIN stored stats required",
    );
  }
  if (model.modelCandidate !== false) {
    throw new ExternalReplicationProtocolError(
      "MODEL_CANDIDATE_NOT_FALSE",
      `expected false, got ${String(model.modelCandidate)}`,
    );
  }
  if (model.holdoutEvaluated !== false) {
    throw new ExternalReplicationProtocolError(
      "HOLDOUT_EVALUATED_NOT_FALSE",
      `expected false, got ${String(model.holdoutEvaluated)}`,
    );
  }
}

function buildFrozenProtocol(
  generatedAt: string,
  modelArtifactSha256: string,
): FrozenV2cExternalReplicationProtocol2025 {
  const orderedModelFeatureNames = [
    ...FROZEN_V2C_ORDERED_BASE_FEATURE_NAMES,
    ...FROZEN_V2C_ORDERED_MISSING_INDICATOR_NAMES,
  ];
  return {
    schemaVersion: MLB_INDEPENDENT_2025_V2C_PROTOCOL_SCHEMA_V1,
    generatedAt,
    researchOnly: true,
    track: MLB_INDEPENDENT_EXTERNAL_REPLICATION_TRACK,
    stage: MLB_INDEPENDENT_2025_V2C_PROTOCOL_STAGE,
    engineAdmission: MLB_INDEPENDENT_ENGINE_ADMISSION,
    scientificRole: "ONE_COMPLETE_EXTERNAL_REPLICATION_SET",
    joinArtifactRel: independentExternalReplication2025JoinRel(),
    joinArtifactSha256: MLB_INDEPENDENT_2025_SEALED_JOIN_SHA256,
    v2cModelArtifactRel: independentSealedV2cModelArtifactRel(),
    v2cModelArtifactSha256: modelArtifactSha256,
    v2cModelCoreHash: MLB_INDEPENDENT_2025_SEALED_V2C_MODEL_CORE_HASH,
    sealedInputPins: {
      sourceSha256: MLB_INDEPENDENT_2025_SEALED_SOURCE_SHA256,
      safeAFeatureSha256: MLB_INDEPENDENT_2025_SEALED_FEATURE_SHA256,
      labelSha256: MLB_INDEPENDENT_2025_SEALED_LABEL_SHA256,
      joinSha256: MLB_INDEPENDENT_2025_SEALED_JOIN_SHA256,
    },
    expectedSampleCount: MLB_INDEPENDENT_2025_EXTERNAL_SAMPLE_COUNT,
    frozenFeatureSpec: {
      baseDimensions: FROZEN_V2C_BASE_DIMENSIONS,
      missingIndicators: FROZEN_V2C_MISSING_INDICATORS,
      modelDimensions: FROZEN_V2C_MODEL_DIMENSIONS,
      orderedBaseFeatureNames: [...FROZEN_V2C_ORDERED_BASE_FEATURE_NAMES],
      orderedMissingIndicatorNames: [...FROZEN_V2C_ORDERED_MISSING_INDICATOR_NAMES],
      orderedModelFeatureNames,
      removedHeadToHeadFeatures: [...FROZEN_V2C_REMOVED_H2H_FEATURE_NAMES],
      headToHeadRemoved: true,
      streakRestBaseRemoved: true,
      seasonVolumeBaseRemoved: true,
      missingIndicatorOrderChanged: false,
      restDaysMissingIndicatorsRetained: true,
    },
    frozenPreprocessing: {
      PREPROCESSOR_SOURCE: FROZEN_PREPROCESSOR_SOURCE,
      fitPartition: FROZEN_PREPROCESSOR_FIT_PARTITION,
      fitSampleCount: FROZEN_CONSTANT_BASELINE_TRAIN_N,
      useExactStored: [
        "medianByFeature",
        "meanByFeature",
        "scaleByFeature",
        "zeroVarianceFeatureNames",
      ],
      fitOn2025Allowed: false,
      combined2024And2025FitAllowed: false,
      applyStoredPreprocessorToEachJoinedFeatureRow: true,
    },
    frozenParameters: {
      intercept: FROZEN_V2C_INTERCEPT,
      coefficientCount: FROZEN_V2C_MODEL_DIMENSIONS,
      threshold: FROZEN_V2C_THRESHOLD,
      lambdaProvenance: FROZEN_V2C_LAMBDA,
      MODEL_REFIT_ALLOWED: false,
      INTERCEPT_REFIT_ALLOWED: false,
      COEFFICIENT_UPDATE_ALLOWED: false,
      THRESHOLD_TUNING_ALLOWED: false,
      CALIBRATION_ALLOWED: false,
    },
    primaryEndpoints: [...FROZEN_PRIMARY_ENDPOINTS],
    secondaryEndpoints: [...FROZEN_SECONDARY_ENDPOINTS],
    constantBaselineProbability: FROZEN_CONSTANT_BASELINE_PROBABILITY,
    constantBaseline: {
      homeWins: FROZEN_CONSTANT_BASELINE_HOME_WINS,
      trainSampleCount: FROZEN_CONSTANT_BASELINE_TRAIN_N,
      probability: FROZEN_CONSTANT_BASELINE_PROBABILITY,
      source: "2024_TRAIN_HOME_RATE",
      redefineFrom2025HomePrevalenceAllowed: false,
      requiredMetrics: [
        "constant baseline accuracy",
        "constant baseline LogLoss",
        "constant baseline Brier Score",
        "constant baseline ROC AUC = 0.5",
      ],
      alternateBaselineSelectionAfterResultsKnownAllowed: false,
    },
    directionalVerdictRules: {
      AUC_PASS: "v2-C ROC AUC > 0.5",
      LOGLOSS_PASS: "v2-C LogLoss < frozen constant baseline LogLoss",
      BRIER_PASS: "v2-C Brier < frozen constant baseline Brier",
      allThreePass: "DIRECTIONAL_EXTERNAL_REPLICATION_SUPPORTED",
      oneOrTwoPass: "MIXED_EXTERNAL_REPLICATION",
      zeroPass: "EXTERNAL_REPLICATION_NOT_SUPPORTED",
      classificationIsDirectionalEvidenceOnly: true,
      automaticModelCandidateDecision: false,
      newMagnitudeCutoffAfterSeeing2025Allowed: false,
    },
    v2cValidationContext2024: FROZEN_V2C_VALIDATION_CONTEXT_2024,
    trainValidationExternalContext: {
      train2024Auc: FROZEN_V2C_TRAIN_CONTEXT_2024.rocAuc,
      validation2024Auc: FROZEN_V2C_VALIDATION_CONTEXT_2024.rocAuc,
      external2025Auc: "FUTURE_UNSEEN_RESULT",
      reportAfterEvaluation: [
        "externalMinusTrainAuc",
        "externalMinusValidationAuc",
        "external / train AUC ratio",
      ],
      descriptiveOnly: true,
      require2025ToMatchOrBeat2024ValidationAllowed: false,
    },
    aggregateOnlyRules: {
      EXTERNAL_AGGREGATE_EVALUATION_COUNT: 1,
      EXTERNAL_MONTHLY_ANALYSIS_PERFORMED: false,
      EXTERNAL_TEAM_ANALYSIS_PERFORMED: false,
      EXTERNAL_SUBGROUP_ANALYSIS_PERFORMED: false,
      EXTERNAL_FEATURE_DIAGNOSTIC_PERFORMED: false,
      EXTERNAL_CALIBRATION_BIN_ANALYSIS_PERFORMED: false,
      EXTERNAL_THRESHOLD_SEARCH_PERFORMED: false,
    },
    postOpenPolicy: {
      afterProbabilitiesOrMetricsCreated: "2025_MODEL_UNSEEN_BECOMES_NO",
      exposedName: "EXTERNAL_REPLICATION_EXPOSED",
      alterV2cAndRerun2025AsIfStillExternal: false,
      successorRequiresNewDevelopmentEvidence: true,
      successorRequiresDifferentUntouchedReplicationSet: true,
    },
    candidatePolicy: {
      V2C_MODEL_CANDIDATE_BEFORE_EXTERNAL: false,
      V2C_MODEL_CANDIDATE_AUTOMATIC_AFTER_EXTERNAL: false,
      allPrimaryMetricsImproveStillRequiresIndependentCtoReview: true,
    },
    holdoutPolicy: {
      remainsSealedRegardlessOf2025Result: true,
      automaticOpenIf2025LooksGood: false,
      evaluated: false,
      candidateReviewRequiredBeforeAnyHoldoutProtocol: true,
    },
    engineProductPolicy: {
      ENGINE_ADMISSION: MLB_INDEPENDENT_ENGINE_ADMISSION,
      ENGINE_CHANGED: false,
      TODAY_PREDICTION_CREATED: false,
      RECOMMENDATION_CHANGED: false,
      CURRENT_DAY_PIPELINE_CHANGED: false,
    },
    futureEvaluator: {
      pinThisProtocolShaBeforeParsingJoinedRows: true,
      parseJoinedRowsDuringProtocolRegistration: false,
      createTransformedXDuringProtocolRegistration: false,
      createLogitsDuringProtocolRegistration: false,
      createProbabilitiesDuringProtocolRegistration: false,
      evaluateDuringProtocolRegistration: false,
    },
    prohibitions: [
      "NO 2025 TRANSFORM",
      "NO LOGITS",
      "NO PROBABILITIES",
      "NO METRICS",
      "NO 2025 SPLIT",
      "NO FOLDS",
      "NO TUNING",
      "NO 2025 PREPROCESSING FIT",
      "NO COMBINED 2024+2025 FIT",
      "NO MONTHLY BINS",
      "NO TEAM RECORDS",
      "NO HOME-FAVORITE STYLE SLICES",
      "NO CONFIDENCE BINS",
      "NO FEATURE AUC",
      "NO COEFFICIENT DIAGNOSTICS",
      "NO ERROR MINING",
      "NO AUTOMATIC CANDIDATE PROMOTION",
      "NO AUTOMATIC HOLDOUT OPEN",
      "NO ENGINE ADMISSION",
    ],
  };
}

export function assertFrozenV2cExternalReplicationProtocol2025(
  protocol: FrozenV2cExternalReplicationProtocol2025,
): void {
  if (protocol.joinArtifactSha256 !== MLB_INDEPENDENT_2025_SEALED_JOIN_SHA256) {
    throw new ExternalReplicationProtocolError(
      "JOIN_SHA_PIN_MISMATCH",
      protocol.joinArtifactSha256,
    );
  }
  if (protocol.v2cModelCoreHash !== MLB_INDEPENDENT_2025_SEALED_V2C_MODEL_CORE_HASH) {
    throw new ExternalReplicationProtocolError(
      "MODEL_CORE_HASH_PIN_MISMATCH",
      protocol.v2cModelCoreHash,
    );
  }
  if (protocol.constantBaselineProbability !== FROZEN_CONSTANT_BASELINE_PROBABILITY) {
    throw new ExternalReplicationProtocolError(
      "PROTOCOL_BASELINE_MISMATCH",
      `${protocol.constantBaselineProbability} != ${FROZEN_CONSTANT_BASELINE_PROBABILITY}`,
    );
  }
  if (protocol.constantBaseline.probability !== FROZEN_CONSTANT_BASELINE_PROBABILITY) {
    throw new ExternalReplicationProtocolError(
      "PROTOCOL_BASELINE_MISMATCH",
      "constantBaseline.probability",
    );
  }
  if (
    protocol.constantBaseline.homeWins !== FROZEN_CONSTANT_BASELINE_HOME_WINS ||
    protocol.constantBaseline.trainSampleCount !== FROZEN_CONSTANT_BASELINE_TRAIN_N
  ) {
    throw new ExternalReplicationProtocolError(
      "PROTOCOL_BASELINE_MISMATCH",
      "776/1463 provenance",
    );
  }
  if (!sameStringList(protocol.primaryEndpoints, FROZEN_PRIMARY_ENDPOINTS)) {
    throw new ExternalReplicationProtocolError(
      "PRIMARY_ENDPOINTS_CHANGED",
      protocol.primaryEndpoints.join(","),
    );
  }
  if (!sameStringList(protocol.secondaryEndpoints, FROZEN_SECONDARY_ENDPOINTS)) {
    throw new ExternalReplicationProtocolError(
      "SECONDARY_ENDPOINTS_CHANGED",
      protocol.secondaryEndpoints.join(","),
    );
  }
  if (protocol.aggregateOnlyRules.EXTERNAL_AGGREGATE_EVALUATION_COUNT !== 1) {
    throw new ExternalReplicationProtocolError(
      "AGGREGATE_ONLY_RULE_CHANGED",
      `EXTERNAL_AGGREGATE_EVALUATION_COUNT=${protocol.aggregateOnlyRules.EXTERNAL_AGGREGATE_EVALUATION_COUNT}`,
    );
  }
  const aggregateFlags: Array<
    keyof FrozenV2cExternalReplicationProtocol2025["aggregateOnlyRules"]
  > = [
    "EXTERNAL_MONTHLY_ANALYSIS_PERFORMED",
    "EXTERNAL_TEAM_ANALYSIS_PERFORMED",
    "EXTERNAL_SUBGROUP_ANALYSIS_PERFORMED",
    "EXTERNAL_FEATURE_DIAGNOSTIC_PERFORMED",
    "EXTERNAL_CALIBRATION_BIN_ANALYSIS_PERFORMED",
    "EXTERNAL_THRESHOLD_SEARCH_PERFORMED",
  ];
  for (const flag of aggregateFlags) {
    if (protocol.aggregateOnlyRules[flag] !== false) {
      throw new ExternalReplicationProtocolError(
        "AGGREGATE_ONLY_RULE_CHANGED",
        String(flag),
      );
    }
  }
  if (protocol.candidatePolicy.V2C_MODEL_CANDIDATE_AUTOMATIC_AFTER_EXTERNAL !== false) {
    throw new ExternalReplicationProtocolError(
      "AUTOMATIC_CANDIDATE_PROMOTION_PROHIBITED",
      "V2C_MODEL_CANDIDATE_AUTOMATIC_AFTER_EXTERNAL must be false",
    );
  }
  if (protocol.candidatePolicy.V2C_MODEL_CANDIDATE_BEFORE_EXTERNAL !== false) {
    throw new ExternalReplicationProtocolError(
      "AUTOMATIC_CANDIDATE_PROMOTION_PROHIBITED",
      "V2C_MODEL_CANDIDATE_BEFORE_EXTERNAL must be false",
    );
  }
  if (protocol.holdoutPolicy.evaluated !== false) {
    throw new ExternalReplicationProtocolError(
      "HOLDOUT_REMAINS_SEALED",
      "holdoutPolicy.evaluated must be false",
    );
  }
  if (protocol.holdoutPolicy.automaticOpenIf2025LooksGood !== false) {
    throw new ExternalReplicationProtocolError(
      "HOLDOUT_REMAINS_SEALED",
      "automatic open prohibited",
    );
  }
  if (protocol.expectedSampleCount !== MLB_INDEPENDENT_2025_EXTERNAL_SAMPLE_COUNT) {
    throw new ExternalReplicationProtocolError(
      "EXPECTED_SAMPLE_COUNT_MISMATCH",
      String(protocol.expectedSampleCount),
    );
  }
  if (protocol.frozenPreprocessing.PREPROCESSOR_SOURCE !== FROZEN_PREPROCESSOR_SOURCE) {
    throw new ExternalReplicationProtocolError(
      "PREPROCESSOR_SOURCE_MISMATCH",
      protocol.frozenPreprocessing.PREPROCESSOR_SOURCE,
    );
  }
  if (protocol.frozenParameters.threshold !== FROZEN_V2C_THRESHOLD) {
    throw new ExternalReplicationProtocolError(
      "THRESHOLD_MISMATCH",
      String(protocol.frozenParameters.threshold),
    );
  }
}

export function preregisterV2cExternalReplicationProtocol2025(input: {
  joinArtifactSha256: string;
  modelArtifactSha256: string;
  model: FrozenV2cModelProtocolView;
  generatedAt?: string;
}): FrozenV2cExternalReplicationProtocolResult2025 {
  if (!/^[a-f0-9]{64}$/.test(input.modelArtifactSha256)) {
    throw new ExternalReplicationProtocolError(
      "MODEL_ARTIFACT_SHA_INVALID",
      input.modelArtifactSha256,
    );
  }
  assertExternalReplication2025JoinShaPin(input.joinArtifactSha256);
  assertFrozenV2cModelForProtocol(input.model);
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const protocol = buildFrozenProtocol(generatedAt, input.modelArtifactSha256);
  assertFrozenV2cExternalReplicationProtocol2025(protocol);
  const protocolArtifactSha256 = hashExternalReplicationProtocolArtifact2025(protocol);
  const audit: FrozenV2cExternalReplicationProtocolAudit2025 = {
    generatedAt,
    researchOnly: true,
    track: MLB_INDEPENDENT_EXTERNAL_REPLICATION_TRACK,
    stage: MLB_INDEPENDENT_2025_V2C_PROTOCOL_STAGE,
    engineAdmission: MLB_INDEPENDENT_ENGINE_ADMISSION,
    marketUsed: false,
    protocolCreated: true,
    protocolSealed: false,
    protocolArtifactSha256,
    joinShaVerified: true,
    joinRowsParsed: false,
    modelArtifactRead: true,
    modelCoreHashVerified: true,
    modelArtifactUnchanged: true,
    "2025TransformedXCreated": false,
    "2025LogitsCreated": false,
    "2025ProbabilitiesCreated": false,
    "2025Evaluated": false,
    "2025ModelUnseen": true,
    splitCreated: false,
    modelRefit: false,
    preprocessorRefit: false,
    thresholdTuned: false,
    calibrationPerformed: false,
    holdoutEvaluated: false,
    modelCandidate: false,
    engineChanged: false,
    recommendationChanged: false,
    joinArtifactSha256: MLB_INDEPENDENT_2025_SEALED_JOIN_SHA256,
    v2cModelArtifactSha256: input.modelArtifactSha256,
    v2cModelCoreHash: MLB_INDEPENDENT_2025_SEALED_V2C_MODEL_CORE_HASH,
    expectedSampleCount: MLB_INDEPENDENT_2025_EXTERNAL_SAMPLE_COUNT,
  };
  return { protocol, audit };
}

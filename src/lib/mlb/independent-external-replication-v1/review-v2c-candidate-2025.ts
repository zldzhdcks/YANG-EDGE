/**
 * 2025 EXTERNAL REPLICATION TRACK — frozen v2-C MODEL_CANDIDATE review.
 *
 * Governance decision only. Reads sealed 2025 summary evidence.
 * Does not rerun v2-C. Does not recreate probabilities. Does not
 * recompute primary metrics. Does not open 2024 Holdout.
 */
import path from "node:path";
import {
  MLB_INDEPENDENT_ENGINE_ADMISSION,
} from "../independent-model-v1";
import {
  MLB_INDEPENDENT_EXTERNAL_REPLICATION_TRACK,
  serializeExternalReplicationJson,
  sha256Utf8,
} from "./source-2025";
import {
  MLB_INDEPENDENT_2025_EXTERNAL_SAMPLE_COUNT,
  MLB_INDEPENDENT_2025_SEALED_V2C_MODEL_CORE_HASH,
} from "./preregister-v2c-evaluation-2025";

export const MLB_INDEPENDENT_2025_V2C_CANDIDATE_REVIEW_STAGE =
  "MODEL_CANDIDATE_REVIEW" as const;
export const MLB_INDEPENDENT_2025_V2C_CANDIDATE_REVIEW_SCHEMA_V1 =
  "mlb-independent-2025-v2c-model-candidate-review-v1" as const;

export const MLB_INDEPENDENT_2025_SEALED_V2C_EVALUATION_SHA256 =
  "c361045407fde88688859e1e127f0c19c2f520b36fdec438862b208326fd55ee";

export const SEALED_2025_EXTERNAL_SAMPLE_COUNT =
  MLB_INDEPENDENT_2025_EXTERNAL_SAMPLE_COUNT;
export const SEALED_2025_ROC_AUC = 0.5413553485750394;
export const SEALED_2025_LOG_LOSS = 0.6899889316799483;
export const SEALED_2025_BRIER = 0.24836896331906277;
export const SEALED_CONSTANT_BASELINE_PROBABILITY = 0.530416951469583;
export const SEALED_CONSTANT_BASELINE_AUC = 0.5 as const;
export const SEALED_CONSTANT_BASELINE_LOG_LOSS = 0.6897873751844317;
export const SEALED_CONSTANT_BASELINE_BRIER = 0.24832160002901463;
export const SEALED_CONSTANT_BASELINE_ACCURACY = 0.5427983539094651;
export const SEALED_V2C_ACCURACY = 0.5469135802469136;
export const SEALED_V2C_TP = 875 as const;
export const SEALED_V2C_TN = 454 as const;
export const SEALED_V2C_FP = 657 as const;
export const SEALED_V2C_FN = 444 as const;
export const SEALED_V2C_CORRECT_COUNT = 1329 as const;
export const SEALED_CONSTANT_HOME_BASELINE_CORRECT_COUNT = 1319 as const;
export const SEALED_ABSOLUTE_CORRECT_GAME_ADVANTAGE = 10 as const;
export const SEALED_PRIMARY_ENDPOINT_COUNT = 3 as const;
export const SEALED_PRIMARY_PASS_COUNT = 1 as const;
export const FROZEN_2024_HOLDOUT_MEMBERSHIP_COUNT = 483 as const;

export const V2C_CANDIDATE_REVIEW_DECISION = "NOT_ADMITTED" as const;
export const V2C_CANDIDATE_PRIMARY_REASON =
  "EXTERNAL_PROBABILITY_QUALITY_NOT_REPLICATED" as const;
export const V2C_CANDIDATE_SUPPORTING_REASON =
  "MIXED_EXTERNAL_REPLICATION" as const;
export const V2C_RESEARCH_BASELINE_STATUS = "SEALED" as const;
export const EXTERNAL_REPLICATION_EXPOSED_STATE =
  "EXTERNAL_REPLICATION_EXPOSED" as const;

export class ExternalReplicationCandidateReviewError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(`${code}: ${message}`);
    this.name = "ExternalReplicationCandidateReviewError";
    this.code = code;
  }
}

export type SealedV2cExternalReplicationEvidence2025 = {
  sampleCount: number;
  modelCandidate: boolean;
  v2cModelCoreHash: string;
  engineAdmission: string;
  primaryMetrics: {
    rocAuc: number;
    logLoss: number;
    brierScore: number;
  };
  constantBaselineMetrics: {
    probability: number;
    rocAuc: number;
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
  directionalVerdict: string;
  secondaryMetrics: {
    accuracy: number;
    TP: number;
    TN: number;
    FP: number;
    FN: number;
  };
};

export type FrozenV2cModelCandidateReview2025 = {
  schemaVersion: typeof MLB_INDEPENDENT_2025_V2C_CANDIDATE_REVIEW_SCHEMA_V1;
  generatedAt: string;
  researchOnly: true;
  track: typeof MLB_INDEPENDENT_EXTERNAL_REPLICATION_TRACK;
  stage: typeof MLB_INDEPENDENT_2025_V2C_CANDIDATE_REVIEW_STAGE;
  evaluationArtifactSha256: typeof MLB_INDEPENDENT_2025_SEALED_V2C_EVALUATION_SHA256;
  v2cModelCoreHash: typeof MLB_INDEPENDENT_2025_SEALED_V2C_MODEL_CORE_HASH;
  externalVerdict: typeof V2C_CANDIDATE_SUPPORTING_REASON;
  primaryChecks: {
    AUC_PASS: true;
    LOGLOSS_PASS: false;
    BRIER_PASS: false;
    passCount: typeof SEALED_PRIMARY_PASS_COUNT;
    primaryEndpointCount: typeof SEALED_PRIMARY_ENDPOINT_COUNT;
  };
  primaryMetrics: {
    rocAuc: typeof SEALED_2025_ROC_AUC;
    logLoss: typeof SEALED_2025_LOG_LOSS;
    brierScore: typeof SEALED_2025_BRIER;
  };
  constantBaselineMetrics: {
    probability: typeof SEALED_CONSTANT_BASELINE_PROBABILITY;
    rocAuc: typeof SEALED_CONSTANT_BASELINE_AUC;
    accuracy: typeof SEALED_CONSTANT_BASELINE_ACCURACY;
    logLoss: typeof SEALED_CONSTANT_BASELINE_LOG_LOSS;
    brierScore: typeof SEALED_CONSTANT_BASELINE_BRIER;
  };
  secondaryContext: {
    v2cAccuracy: typeof SEALED_V2C_ACCURACY;
    constantHomeBaselineAccuracy: typeof SEALED_CONSTANT_BASELINE_ACCURACY;
    v2cCorrect: typeof SEALED_V2C_CORRECT_COUNT;
    constantHomeBaselineCorrect: typeof SEALED_CONSTANT_HOME_BASELINE_CORRECT_COUNT;
    absoluteCorrectGameAdvantage: typeof SEALED_ABSOLUTE_CORRECT_GAME_ADVANTAGE;
    secondaryDoesNotOverridePrimary: true;
  };
  candidateDecision: typeof V2C_CANDIDATE_REVIEW_DECISION;
  candidate: false;
  primaryReason: typeof V2C_CANDIDATE_PRIMARY_REASON;
  supportingReason: typeof V2C_CANDIDATE_SUPPORTING_REASON;
  researchBaseline: typeof V2C_RESEARCH_BASELINE_STATUS;
  hasReplicatedRankingSignal: true;
  hasReplicatedProbabilityQuality: false;
  holdoutOpen: false;
  holdoutMembershipCount: typeof FROZEN_2024_HOLDOUT_MEMBERSHIP_COUNT;
  holdoutFeatureRowsRead: 0;
  holdoutLabelRowsRead: 0;
  holdoutTransformedRows: 0;
  holdoutLogitsCreated: 0;
  holdoutProbabilitiesCreated: 0;
  holdoutEvaluated: false;
  "2025ExternalState": typeof EXTERNAL_REPLICATION_EXPOSED_STATE;
  "2025ModelUnseen": false;
  rerun2025AsUntouchedExternalAllowed: false;
  postExposureDiagnosticPerformed: false;
  engineAdmission: typeof MLB_INDEPENDENT_ENGINE_ADMISSION;
};

export type FrozenV2cModelCandidateReviewAudit2025 = {
  generatedAt: string;
  researchOnly: true;
  track: typeof MLB_INDEPENDENT_EXTERNAL_REPLICATION_TRACK;
  stage: typeof MLB_INDEPENDENT_2025_V2C_CANDIDATE_REVIEW_STAGE;
  engineAdmission: typeof MLB_INDEPENDENT_ENGINE_ADMISSION;
  marketUsed: false;
  candidateReviewPerformed: true;
  modelCandidateBeforeReview: false;
  modelCandidateAfterReview: false;
  modelRerun: false;
  probabilitiesRecreated: false;
  metricsRecomputed: false;
  thresholdTuned: false;
  calibrationPerformed: false;
  postExposureDiagnosticPerformed: false;
  monthlyAnalysisPerformed: false;
  teamAnalysisPerformed: false;
  subgroupAnalysisPerformed: false;
  featureDiagnosticPerformed: false;
  calibrationBinAnalysisPerformed: false;
  thresholdSearchPerformed: false;
  holdoutOpen: false;
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
  "2025ModelUnseen": false;
  "2025ExternalState": typeof EXTERNAL_REPLICATION_EXPOSED_STATE;
  evaluationArtifactSha256: typeof MLB_INDEPENDENT_2025_SEALED_V2C_EVALUATION_SHA256;
  v2cModelCoreHash: typeof MLB_INDEPENDENT_2025_SEALED_V2C_MODEL_CORE_HASH;
  reviewArtifactSha256: string;
};

export type FrozenV2cModelCandidateReviewResult2025 = {
  review: FrozenV2cModelCandidateReview2025;
  audit: FrozenV2cModelCandidateReviewAudit2025;
};

export function independentExternalReplication2025V2cCandidateReviewRel(): string {
  return "data/research/mlb/independent-model-v1/external-replication/2025/reviews/2025-v2c-model-candidate-review-v1.json";
}

export function independentExternalReplication2025V2cCandidateReviewPath(
  cwd = process.cwd(),
): string {
  return path.join(cwd, independentExternalReplication2025V2cCandidateReviewRel());
}

export function independentExternalReplication2025V2cCandidateReviewAuditRel(): string {
  return "data/research/mlb/independent-model-v1/external-replication/2025/audits/2025-v2c-model-candidate-review-audit-v1.json";
}

export function independentExternalReplication2025V2cCandidateReviewAuditPath(
  cwd = process.cwd(),
): string {
  return path.join(
    cwd,
    independentExternalReplication2025V2cCandidateReviewAuditRel(),
  );
}

export function hashExternalReplicationCandidateReviewArtifact2025(
  review: FrozenV2cModelCandidateReview2025,
): string {
  return sha256Utf8(serializeExternalReplicationJson(review));
}

export function assertExternalReplication2025EvaluationShaPin(
  evaluationSha256: string,
): void {
  if (evaluationSha256 !== MLB_INDEPENDENT_2025_SEALED_V2C_EVALUATION_SHA256) {
    throw new ExternalReplicationCandidateReviewError(
      "EVALUATION_SHA_PIN_MISMATCH",
      `expected ${MLB_INDEPENDENT_2025_SEALED_V2C_EVALUATION_SHA256}, got ${evaluationSha256}`,
    );
  }
}

export function assertExternalReplication2025ModelCoreHashPin(
  modelCoreHash: string,
): void {
  if (modelCoreHash !== MLB_INDEPENDENT_2025_SEALED_V2C_MODEL_CORE_HASH) {
    throw new ExternalReplicationCandidateReviewError(
      "MODEL_CORE_HASH_PIN_MISMATCH",
      `expected ${MLB_INDEPENDENT_2025_SEALED_V2C_MODEL_CORE_HASH}, got ${modelCoreHash}`,
    );
  }
}

export function assertSealedV2cCandidateReviewEvidence2025(
  evidence: SealedV2cExternalReplicationEvidence2025,
): void {
  if (evidence.sampleCount !== SEALED_2025_EXTERNAL_SAMPLE_COUNT) {
    throw new ExternalReplicationCandidateReviewError(
      "SAMPLE_COUNT_PIN_MISMATCH",
      `${evidence.sampleCount}`,
    );
  }
  if (evidence.v2cModelCoreHash !== MLB_INDEPENDENT_2025_SEALED_V2C_MODEL_CORE_HASH) {
    throw new ExternalReplicationCandidateReviewError(
      "MODEL_CORE_HASH_PIN_MISMATCH",
      evidence.v2cModelCoreHash,
    );
  }
  if (evidence.engineAdmission !== MLB_INDEPENDENT_ENGINE_ADMISSION) {
    throw new ExternalReplicationCandidateReviewError(
      "ENGINE_ADMISSION_NOT_PROHIBITED",
      String(evidence.engineAdmission),
    );
  }
  if (evidence.modelCandidate !== false) {
    throw new ExternalReplicationCandidateReviewError(
      "CANDIDATE_CANNOT_BECOME_TRUE",
      String(evidence.modelCandidate),
    );
  }
  if (evidence.directionalVerdict !== V2C_CANDIDATE_SUPPORTING_REASON) {
    throw new ExternalReplicationCandidateReviewError(
      "EXTERNAL_VERDICT_NOT_MIXED",
      evidence.directionalVerdict,
    );
  }
  const checks = evidence.directionalChecks;
  if (checks.AUC_PASS !== true) {
    throw new ExternalReplicationCandidateReviewError(
      "AUC_PASS_REQUIRED",
      String(checks.AUC_PASS),
    );
  }
  if (checks.LOGLOSS_PASS !== false) {
    throw new ExternalReplicationCandidateReviewError(
      "LOGLOSS_PASS_MUST_BE_FALSE",
      String(checks.LOGLOSS_PASS),
    );
  }
  if (checks.BRIER_PASS !== false) {
    throw new ExternalReplicationCandidateReviewError(
      "BRIER_PASS_MUST_BE_FALSE",
      String(checks.BRIER_PASS),
    );
  }
  if (checks.passCount !== SEALED_PRIMARY_PASS_COUNT) {
    throw new ExternalReplicationCandidateReviewError(
      "PRIMARY_PASS_COUNT_MISMATCH",
      `${checks.passCount}`,
    );
  }
  const primary = evidence.primaryMetrics;
  if (
    primary.rocAuc !== SEALED_2025_ROC_AUC ||
    primary.logLoss !== SEALED_2025_LOG_LOSS ||
    primary.brierScore !== SEALED_2025_BRIER
  ) {
    throw new ExternalReplicationCandidateReviewError(
      "PRIMARY_METRICS_PIN_MISMATCH",
      JSON.stringify(primary),
    );
  }
  const baseline = evidence.constantBaselineMetrics;
  if (
    baseline.probability !== SEALED_CONSTANT_BASELINE_PROBABILITY ||
    baseline.rocAuc !== SEALED_CONSTANT_BASELINE_AUC ||
    baseline.accuracy !== SEALED_CONSTANT_BASELINE_ACCURACY ||
    baseline.logLoss !== SEALED_CONSTANT_BASELINE_LOG_LOSS ||
    baseline.brierScore !== SEALED_CONSTANT_BASELINE_BRIER
  ) {
    throw new ExternalReplicationCandidateReviewError(
      "CONSTANT_BASELINE_PIN_MISMATCH",
      JSON.stringify(baseline),
    );
  }
  const secondary = evidence.secondaryMetrics;
  if (
    secondary.accuracy !== SEALED_V2C_ACCURACY ||
    secondary.TP !== SEALED_V2C_TP ||
    secondary.TN !== SEALED_V2C_TN ||
    secondary.FP !== SEALED_V2C_FP ||
    secondary.FN !== SEALED_V2C_FN
  ) {
    throw new ExternalReplicationCandidateReviewError(
      "SECONDARY_METRICS_PIN_MISMATCH",
      JSON.stringify(secondary),
    );
  }
  const v2cCorrect = secondary.TP + secondary.TN;
  const homeLabels = secondary.TP + secondary.FN;
  const awayLabels = secondary.TN + secondary.FP;
  const total = v2cCorrect + secondary.FP + secondary.FN;
  if (v2cCorrect !== SEALED_V2C_CORRECT_COUNT) {
    throw new ExternalReplicationCandidateReviewError(
      "CONFUSION_MATRIX_RECONCILIATION",
      `correct ${v2cCorrect}`,
    );
  }
  if (homeLabels !== 1319 || awayLabels !== 1111 || total !== 2430) {
    throw new ExternalReplicationCandidateReviewError(
      "CONFUSION_MATRIX_RECONCILIATION",
      `HOME ${homeLabels} AWAY ${awayLabels} TOTAL ${total}`,
    );
  }
}

export function reviewV2cModelCandidate2025(input: {
  evaluationSha256: string;
  evidence: SealedV2cExternalReplicationEvidence2025;
  modelCoreHash: string;
  generatedAt?: string;
  requestedCandidate?: boolean;
  requestedHoldoutOpen?: boolean;
  requested2025ModelUnseen?: boolean;
}): FrozenV2cModelCandidateReviewResult2025 {
  assertExternalReplication2025EvaluationShaPin(input.evaluationSha256);
  assertExternalReplication2025ModelCoreHashPin(input.modelCoreHash);
  assertSealedV2cCandidateReviewEvidence2025(input.evidence);
  if (input.requestedCandidate === true) {
    throw new ExternalReplicationCandidateReviewError(
      "CANDIDATE_CANNOT_BECOME_TRUE",
      "requestedCandidate",
    );
  }
  if (input.requestedHoldoutOpen === true) {
    throw new ExternalReplicationCandidateReviewError(
      "HOLDOUT_CANNOT_OPEN",
      "requestedHoldoutOpen",
    );
  }
  if (input.requested2025ModelUnseen === true) {
    throw new ExternalReplicationCandidateReviewError(
      "EXPOSED_STATE_CANNOT_REVERT",
      "requested2025ModelUnseen",
    );
  }

  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const review: FrozenV2cModelCandidateReview2025 = {
    schemaVersion: MLB_INDEPENDENT_2025_V2C_CANDIDATE_REVIEW_SCHEMA_V1,
    generatedAt,
    researchOnly: true,
    track: MLB_INDEPENDENT_EXTERNAL_REPLICATION_TRACK,
    stage: MLB_INDEPENDENT_2025_V2C_CANDIDATE_REVIEW_STAGE,
    evaluationArtifactSha256: MLB_INDEPENDENT_2025_SEALED_V2C_EVALUATION_SHA256,
    v2cModelCoreHash: MLB_INDEPENDENT_2025_SEALED_V2C_MODEL_CORE_HASH,
    externalVerdict: V2C_CANDIDATE_SUPPORTING_REASON,
    primaryChecks: {
      AUC_PASS: true,
      LOGLOSS_PASS: false,
      BRIER_PASS: false,
      passCount: SEALED_PRIMARY_PASS_COUNT,
      primaryEndpointCount: SEALED_PRIMARY_ENDPOINT_COUNT,
    },
    primaryMetrics: {
      rocAuc: SEALED_2025_ROC_AUC,
      logLoss: SEALED_2025_LOG_LOSS,
      brierScore: SEALED_2025_BRIER,
    },
    constantBaselineMetrics: {
      probability: SEALED_CONSTANT_BASELINE_PROBABILITY,
      rocAuc: SEALED_CONSTANT_BASELINE_AUC,
      accuracy: SEALED_CONSTANT_BASELINE_ACCURACY,
      logLoss: SEALED_CONSTANT_BASELINE_LOG_LOSS,
      brierScore: SEALED_CONSTANT_BASELINE_BRIER,
    },
    secondaryContext: {
      v2cAccuracy: SEALED_V2C_ACCURACY,
      constantHomeBaselineAccuracy: SEALED_CONSTANT_BASELINE_ACCURACY,
      v2cCorrect: SEALED_V2C_CORRECT_COUNT,
      constantHomeBaselineCorrect: SEALED_CONSTANT_HOME_BASELINE_CORRECT_COUNT,
      absoluteCorrectGameAdvantage: SEALED_ABSOLUTE_CORRECT_GAME_ADVANTAGE,
      secondaryDoesNotOverridePrimary: true,
    },
    candidateDecision: V2C_CANDIDATE_REVIEW_DECISION,
    candidate: false,
    primaryReason: V2C_CANDIDATE_PRIMARY_REASON,
    supportingReason: V2C_CANDIDATE_SUPPORTING_REASON,
    researchBaseline: V2C_RESEARCH_BASELINE_STATUS,
    hasReplicatedRankingSignal: true,
    hasReplicatedProbabilityQuality: false,
    holdoutOpen: false,
    holdoutMembershipCount: FROZEN_2024_HOLDOUT_MEMBERSHIP_COUNT,
    holdoutFeatureRowsRead: 0,
    holdoutLabelRowsRead: 0,
    holdoutTransformedRows: 0,
    holdoutLogitsCreated: 0,
    holdoutProbabilitiesCreated: 0,
    holdoutEvaluated: false,
    "2025ExternalState": EXTERNAL_REPLICATION_EXPOSED_STATE,
    "2025ModelUnseen": false,
    rerun2025AsUntouchedExternalAllowed: false,
    postExposureDiagnosticPerformed: false,
    engineAdmission: MLB_INDEPENDENT_ENGINE_ADMISSION,
  };

  const reviewArtifactSha256 =
    hashExternalReplicationCandidateReviewArtifact2025(review);
  const audit: FrozenV2cModelCandidateReviewAudit2025 = {
    generatedAt,
    researchOnly: true,
    track: MLB_INDEPENDENT_EXTERNAL_REPLICATION_TRACK,
    stage: MLB_INDEPENDENT_2025_V2C_CANDIDATE_REVIEW_STAGE,
    engineAdmission: MLB_INDEPENDENT_ENGINE_ADMISSION,
    marketUsed: false,
    candidateReviewPerformed: true,
    modelCandidateBeforeReview: false,
    modelCandidateAfterReview: false,
    modelRerun: false,
    probabilitiesRecreated: false,
    metricsRecomputed: false,
    thresholdTuned: false,
    calibrationPerformed: false,
    postExposureDiagnosticPerformed: false,
    monthlyAnalysisPerformed: false,
    teamAnalysisPerformed: false,
    subgroupAnalysisPerformed: false,
    featureDiagnosticPerformed: false,
    calibrationBinAnalysisPerformed: false,
    thresholdSearchPerformed: false,
    holdoutOpen: false,
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
    "2025ModelUnseen": false,
    "2025ExternalState": EXTERNAL_REPLICATION_EXPOSED_STATE,
    evaluationArtifactSha256: MLB_INDEPENDENT_2025_SEALED_V2C_EVALUATION_SHA256,
    v2cModelCoreHash: MLB_INDEPENDENT_2025_SEALED_V2C_MODEL_CORE_HASH,
    reviewArtifactSha256,
  };

  return { review, audit };
}

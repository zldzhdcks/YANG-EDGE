/**
 * Independent-model research-direction review after the closed v2-C cycle.
 *
 * Governance / research design only. Uses sealed aggregate summaries.
 * Does not train a model, open 2024 Holdout, or inspect 2025 evaluation rows.
 */
import { createHash } from "node:crypto";
import path from "node:path";
import { MLB_INDEPENDENT_ENGINE_ADMISSION } from "../independent-model-v1";
import {
  EXTERNAL_REPLICATION_EXPOSED_STATE,
  FROZEN_2024_HOLDOUT_MEMBERSHIP_COUNT,
  MLB_INDEPENDENT_2025_SEALED_V2C_EVALUATION_SHA256,
  SEALED_2025_BRIER,
  SEALED_2025_EXTERNAL_SAMPLE_COUNT,
  SEALED_2025_LOG_LOSS,
  SEALED_2025_ROC_AUC,
  SEALED_CONSTANT_BASELINE_AUC,
  SEALED_CONSTANT_BASELINE_BRIER,
  SEALED_CONSTANT_BASELINE_LOG_LOSS,
  V2C_CANDIDATE_PRIMARY_REASON,
  V2C_CANDIDATE_REVIEW_DECISION,
  V2C_CANDIDATE_SUPPORTING_REASON,
  V2C_RESEARCH_BASELINE_STATUS,
} from "../independent-external-replication-v1/review-v2c-candidate-2025";
import { MLB_INDEPENDENT_2025_SEALED_V2C_MODEL_CORE_HASH } from "../independent-external-replication-v1/preregister-v2c-evaluation-2025";

export const POST_V2C_RESEARCH_DIRECTION_STAGE =
  "POST_V2C_RESEARCH_DIRECTION_REVIEW" as const;
export const POST_V2C_RESEARCH_DIRECTION_SCHEMA_V1 =
  "mlb-independent-post-v2c-research-direction-review-v1" as const;

export const MLB_INDEPENDENT_2025_SEALED_V2C_CANDIDATE_REVIEW_SHA256 =
  "b44d39c8d4927750b00ca7c52f3454756aa144282957b30f3b026e8db9ee67fb";

export const SEALED_V2C_TRAIN_AUC_2024 = 0.5991226984198442;
export const SEALED_V2C_VALIDATION_AUC_2024 = 0.5553249871377123;
export const WEAK_INDEPENDENT_RANKING_SIGNAL_EXISTS = "SUPPORTED" as const;
export const CURRENT_PROBABILITY_MODEL_QUALITY = "NOT_SUFFICIENT" as const;
export const REPEATED_SAFE_A_FEATURE_PRUNING = "DIMINISHING_RESEARCH_VALUE" as const;
export const RECOMMENDED_STRATEGY =
  "MULTI_SEASON_EVIDENCE_PLUS_PREGAME_SAFE_FEATURE_EXPANSION" as const;
export const NEXT_SOURCE_FOUNDATION_CANDIDATE = "2023_MLB_REGULAR_SEASON" as const;
export const NEXT_SOURCE_FOUNDATION_STATUS = "PROPOSED_NOT_STARTED" as const;
export const V2C_CYCLE_STATUS = "CLOSED" as const;

export class PostV2cResearchDirectionError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(`${code}: ${message}`);
    this.name = "PostV2cResearchDirectionError";
    this.code = code;
  }
}

export type PostV2cResearchDirectionReviewV1 = {
  schemaVersion: typeof POST_V2C_RESEARCH_DIRECTION_SCHEMA_V1;
  generatedAt: string;
  researchOnly: true;
  stage: typeof POST_V2C_RESEARCH_DIRECTION_STAGE;
  v2cCycleStatus: typeof V2C_CYCLE_STATUS;
  v2cCandidateDecision: typeof V2C_CANDIDATE_REVIEW_DECISION;
  externalReplicationVerdict: typeof V2C_CANDIDATE_SUPPORTING_REASON;
  replicatedRankingSignal: true;
  replicatedProbabilityQuality: false;
  currentProbabilityModelQuality: typeof CURRENT_PROBABILITY_MODEL_QUALITY;
  weakIndependentRankingSignalExists: typeof WEAK_INDEPENDENT_RANKING_SIGNAL_EXISTS;
  rankingSignalWording: "weak";
  rankingSignalProductionGrade: false;
  rankingSignalSufficientAloneForCandidate: false;
  repeatedSafeAFeaturePruning: typeof REPEATED_SAFE_A_FEATURE_PRUNING;
  doNotDefaultToV2dFeatureDeletion: true;
  immediateV2d: false;
  immediateCalibration: false;
  immediateComplexModel: false;
  calibrateV2cOn2025: false;
  immediateXgboostRandomForestNn: false;
  recommendedStrategy: typeof RECOMMENDED_STRATEGY;
  nextSourceFoundationCandidate: typeof NEXT_SOURCE_FOUNDATION_CANDIDATE;
  nextSourceFoundationStatus: typeof NEXT_SOURCE_FOUNDATION_STATUS;
  newModelTrainingAllowedNow: false;
  holdoutEvaluated: false;
  holdoutOpen: false;
  holdoutMembershipCount: typeof FROZEN_2024_HOLDOUT_MEMBERSHIP_COUNT;
  "2025ExternalState": typeof EXTERNAL_REPLICATION_EXPOSED_STATE;
  "2025ModelUnseen": false;
  "2025RowLevelDiagnosticAllowed": false;
  postExposureDiagnosticPerformed: false;
  v2cResearchBaseline: typeof V2C_RESEARCH_BASELINE_STATUS;
  engineAdmission: typeof MLB_INDEPENDENT_ENGINE_ADMISSION;
  sealedExternalEvidence: {
    sampleCount: typeof SEALED_2025_EXTERNAL_SAMPLE_COUNT;
    rocAuc: typeof SEALED_2025_ROC_AUC;
    logLoss: typeof SEALED_2025_LOG_LOSS;
    brierScore: typeof SEALED_2025_BRIER;
    constantBaselineAuc: typeof SEALED_CONSTANT_BASELINE_AUC;
    constantBaselineLogLoss: typeof SEALED_CONSTANT_BASELINE_LOG_LOSS;
    constantBaselineBrier: typeof SEALED_CONSTANT_BASELINE_BRIER;
    AUC_PASS: true;
    LOGLOSS_PASS: false;
    BRIER_PASS: false;
    modelCandidate: false;
  };
  rankingSignalEvidence: {
    v2cTrainAuc2024: typeof SEALED_V2C_TRAIN_AUC_2024;
    v2cValidationAuc2024: typeof SEALED_V2C_VALIDATION_AUC_2024;
    v2cExternalAuc2025: typeof SEALED_2025_ROC_AUC;
  };
  lessons: {
    lesson1: typeof WEAK_INDEPENDENT_RANKING_SIGNAL_EXISTS;
    lesson2: typeof CURRENT_PROBABILITY_MODEL_QUALITY;
    lesson3: typeof REPEATED_SAFE_A_FEATURE_PRUNING;
    lesson4OmittedInformationFamiliesAreHypotheses: true;
  };
  rejectedImmediateDirections: {
    continuePruningCurrentSafeAAsDefault: true;
    postHocCalibrateV2cOn2025: true;
    moveImmediatelyToMoreComplexMlModel: true;
  };
  omittedInformationFamilyHypotheses: [
    "STARTER",
    "BULLPEN",
    "LINEUP",
    "INJURY_AVAILABILITY",
    "PARK_VENUE_CONTEXT",
    "WEATHER_WHERE_LEGALLY_RELIABLY_AVAILABLE",
    "PLAYER_LEVEL_CONTEXT",
  ];
  classBFeatureProgram: {
    status: "PROPOSED_NOT_STARTED";
    candidateFamilies: [
      "STARTER_CONTEXT",
      "BULLPEN_CONTEXT",
      "LINEUP_CONTEXT",
      "PLAYER_AVAILABILITY",
      "PARK_CONTEXT",
      "WEATHER_CONTEXT",
    ];
    requiredContractFields: [
      "sourceLegality",
      "sourceProvider",
      "availableAt",
      "asOf",
      "pregameDeadline",
      "historicalReconstructability",
      "missingnessPolicy",
      "currentDayAvailability",
      "earlyVsLateOnlyClassification",
      "leakageRisk",
    ];
    noFeatureEntersModelBeforeContract: true;
  };
  productTiming: {
    preserveEarlyAnalysis: true;
    preserveLateUpdate: true;
    preserveFinalSnapshot: true;
    initialUsefulAnalysisTarget: "NEAR_T_MINUS_3H";
    laterExpansionTarget: "TOWARD_T_MINUS_6H_WHERE_EVIDENCE_SUPPORTS";
    featureAvailabilityClasses: ["EARLY_SAFE", "LATE_ONLY", "NOT_RELIABLY_RECONSTRUCTABLE"];
  };
  researchOrder: [
    "PHASE_A_2023_HISTORICAL_SOURCE_FOUNDATION",
    "PHASE_B_2023_SAFE_A_FEATURE_LABEL_JOIN",
    "PHASE_C_MULTI_SEASON_SAFE_A_STABILITY_DISTRIBUTION_AUDIT",
    "PHASE_D_CLASS_B_PREGAME_FEATURE_CONTRACT_V1",
    "PHASE_E_HISTORICAL_CLASS_B_FEASIBILITY_COVERAGE_AUDIT",
    "PHASE_F_NEW_MODEL_HYPOTHESIS_PREREGISTRATION",
    "PHASE_G_NEW_PROTOTYPE_TRAINING",
  ];
  noModelBeforePhaseF: true;
  nextModelStartGates: {
    additionalHistoricalSeasonFoundationSealed: false;
    multiSeasonIdentityLeakageChecksPass: false;
    featureAvailabilityContractsDefined: false;
    candidateNewFeatureGroupsJustified: false;
    trainingValidationChronologyPredefined: false;
    futureUntouchedEvaluationStrategyDefined: false;
    holdoutPolicyExplicitlyResolved: false;
  };
  holdoutGovernance: {
    remainsSealed: true;
    automaticAssignmentToFutureSuccessor: false;
    successorRequiresFormalLineageBeforeHoldoutProtocol: true;
  };
  exposed2025Governance: {
    state: typeof EXTERNAL_REPLICATION_EXPOSED_STATE;
    mayBeUsedLaterOnlyAsLabeledExploratoryPostExposureResearch: true;
    mustNeverBeDescribedAsIndependentValidation: true;
    immediateRowLevelDiagnosticAllowed: false;
  };
  candidateReviewPrimaryReason: typeof V2C_CANDIDATE_PRIMARY_REASON;
  evaluationArtifactSha256: typeof MLB_INDEPENDENT_2025_SEALED_V2C_EVALUATION_SHA256;
  candidateReviewArtifactSha256: typeof MLB_INDEPENDENT_2025_SEALED_V2C_CANDIDATE_REVIEW_SHA256;
  v2cModelCoreHash: typeof MLB_INDEPENDENT_2025_SEALED_V2C_MODEL_CORE_HASH;
};

export type PostV2cResearchDirectionAuditV1 = {
  generatedAt: string;
  researchOnly: true;
  stage: typeof POST_V2C_RESEARCH_DIRECTION_STAGE;
  engineAdmission: typeof MLB_INDEPENDENT_ENGINE_ADMISSION;
  modelTrained: false;
  modelEvaluated: false;
  "2025RowsInspected": false;
  "2025PostExposureDiagnosticPerformed": false;
  holdoutEvaluated: false;
  engineChanged: false;
  recommendationChanged: false;
  networkUsed: false;
  v2cCycleClosed: true;
  newModelTrainingAllowedNow: false;
  immediateV2d: false;
  calibrateV2cOn2025: false;
  reviewArtifactSha256: string;
  evaluationArtifactSha256: typeof MLB_INDEPENDENT_2025_SEALED_V2C_EVALUATION_SHA256;
  candidateReviewArtifactSha256: typeof MLB_INDEPENDENT_2025_SEALED_V2C_CANDIDATE_REVIEW_SHA256;
};

export type PostV2cResearchDirectionResultV1 = {
  review: PostV2cResearchDirectionReviewV1;
  audit: PostV2cResearchDirectionAuditV1;
};

function serializeResearchDirectionJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function sha256Utf8(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

export function independentPostV2cResearchDirectionReviewRel(): string {
  return "data/research/mlb/independent-model-v1/reviews/post-v2c-research-direction-review-v1.json";
}

export function independentPostV2cResearchDirectionReviewPath(
  cwd = process.cwd(),
): string {
  return path.join(cwd, independentPostV2cResearchDirectionReviewRel());
}

export function independentPostV2cResearchDirectionAuditRel(): string {
  return "data/research/mlb/independent-model-v1/audits/post-v2c-research-direction-review-audit-v1.json";
}

export function independentPostV2cResearchDirectionAuditPath(
  cwd = process.cwd(),
): string {
  return path.join(cwd, independentPostV2cResearchDirectionAuditRel());
}

export function hashPostV2cResearchDirectionReviewV1(
  review: PostV2cResearchDirectionReviewV1,
): string {
  return sha256Utf8(serializeResearchDirectionJson(review));
}

export { serializeResearchDirectionJson };

export function reviewPostV2cResearchDirectionV1(input: {
  evaluationSha256: string;
  candidateReviewSha256: string;
  candidateDecision: string;
  externalVerdict: string;
  generatedAt?: string;
  requestedImmediateV2d?: boolean;
  requestedCalibrate2025?: boolean;
  requestedComplexModel?: boolean;
  requestedNewModelTraining?: boolean;
  requested2025RowInspection?: boolean;
  requestedHoldoutOpen?: boolean;
}): PostV2cResearchDirectionResultV1 {
  if (input.evaluationSha256 !== MLB_INDEPENDENT_2025_SEALED_V2C_EVALUATION_SHA256) {
    throw new PostV2cResearchDirectionError(
      "EVALUATION_SHA_PIN_MISMATCH",
      input.evaluationSha256,
    );
  }
  if (
    input.candidateReviewSha256 !==
    MLB_INDEPENDENT_2025_SEALED_V2C_CANDIDATE_REVIEW_SHA256
  ) {
    throw new PostV2cResearchDirectionError(
      "CANDIDATE_REVIEW_SHA_PIN_MISMATCH",
      input.candidateReviewSha256,
    );
  }
  if (input.candidateDecision !== V2C_CANDIDATE_REVIEW_DECISION) {
    throw new PostV2cResearchDirectionError(
      "CANDIDATE_DECISION_NOT_ADMITTED_REQUIRED",
      input.candidateDecision,
    );
  }
  if (input.externalVerdict !== V2C_CANDIDATE_SUPPORTING_REASON) {
    throw new PostV2cResearchDirectionError(
      "EXTERNAL_VERDICT_NOT_MIXED",
      input.externalVerdict,
    );
  }
  if (input.requestedImmediateV2d === true) {
    throw new PostV2cResearchDirectionError("IMMEDIATE_V2D_PROHIBITED", "v2-D");
  }
  if (input.requestedCalibrate2025 === true) {
    throw new PostV2cResearchDirectionError(
      "CALIBRATE_V2C_ON_2025_PROHIBITED",
      "2025 calibration",
    );
  }
  if (input.requestedComplexModel === true) {
    throw new PostV2cResearchDirectionError(
      "IMMEDIATE_COMPLEX_MODEL_PROHIBITED",
      "complex model",
    );
  }
  if (input.requestedNewModelTraining === true) {
    throw new PostV2cResearchDirectionError(
      "NEW_MODEL_TRAINING_PROHIBITED",
      "new model",
    );
  }
  if (input.requested2025RowInspection === true) {
    throw new PostV2cResearchDirectionError(
      "2025_ROW_LEVEL_INSPECTION_PROHIBITED",
      "2025 rows",
    );
  }
  if (input.requestedHoldoutOpen === true) {
    throw new PostV2cResearchDirectionError("HOLDOUT_CANNOT_OPEN", "Holdout");
  }
  if (
    !(SEALED_V2C_TRAIN_AUC_2024 > 0.5) ||
    !(SEALED_V2C_VALIDATION_AUC_2024 > 0.5) ||
    !(SEALED_2025_ROC_AUC > 0.5)
  ) {
    throw new PostV2cResearchDirectionError(
      "RANKING_SIGNAL_PIN_MISMATCH",
      "sealed AUCs must remain above 0.5",
    );
  }
  if (
    !(SEALED_2025_LOG_LOSS > SEALED_CONSTANT_BASELINE_LOG_LOSS) ||
    !(SEALED_2025_BRIER > SEALED_CONSTANT_BASELINE_BRIER)
  ) {
    throw new PostV2cResearchDirectionError(
      "PROBABILITY_QUALITY_PIN_MISMATCH",
      "sealed LogLoss/Brier must remain worse than frozen constant baseline",
    );
  }

  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const review: PostV2cResearchDirectionReviewV1 = {
    schemaVersion: POST_V2C_RESEARCH_DIRECTION_SCHEMA_V1,
    generatedAt,
    researchOnly: true,
    stage: POST_V2C_RESEARCH_DIRECTION_STAGE,
    v2cCycleStatus: V2C_CYCLE_STATUS,
    v2cCandidateDecision: V2C_CANDIDATE_REVIEW_DECISION,
    externalReplicationVerdict: V2C_CANDIDATE_SUPPORTING_REASON,
    replicatedRankingSignal: true,
    replicatedProbabilityQuality: false,
    currentProbabilityModelQuality: CURRENT_PROBABILITY_MODEL_QUALITY,
    weakIndependentRankingSignalExists: WEAK_INDEPENDENT_RANKING_SIGNAL_EXISTS,
    rankingSignalWording: "weak",
    rankingSignalProductionGrade: false,
    rankingSignalSufficientAloneForCandidate: false,
    repeatedSafeAFeaturePruning: REPEATED_SAFE_A_FEATURE_PRUNING,
    doNotDefaultToV2dFeatureDeletion: true,
    immediateV2d: false,
    immediateCalibration: false,
    immediateComplexModel: false,
    calibrateV2cOn2025: false,
    immediateXgboostRandomForestNn: false,
    recommendedStrategy: RECOMMENDED_STRATEGY,
    nextSourceFoundationCandidate: NEXT_SOURCE_FOUNDATION_CANDIDATE,
    nextSourceFoundationStatus: NEXT_SOURCE_FOUNDATION_STATUS,
    newModelTrainingAllowedNow: false,
    holdoutEvaluated: false,
    holdoutOpen: false,
    holdoutMembershipCount: FROZEN_2024_HOLDOUT_MEMBERSHIP_COUNT,
    "2025ExternalState": EXTERNAL_REPLICATION_EXPOSED_STATE,
    "2025ModelUnseen": false,
    "2025RowLevelDiagnosticAllowed": false,
    postExposureDiagnosticPerformed: false,
    v2cResearchBaseline: V2C_RESEARCH_BASELINE_STATUS,
    engineAdmission: MLB_INDEPENDENT_ENGINE_ADMISSION,
    sealedExternalEvidence: {
      sampleCount: SEALED_2025_EXTERNAL_SAMPLE_COUNT,
      rocAuc: SEALED_2025_ROC_AUC,
      logLoss: SEALED_2025_LOG_LOSS,
      brierScore: SEALED_2025_BRIER,
      constantBaselineAuc: SEALED_CONSTANT_BASELINE_AUC,
      constantBaselineLogLoss: SEALED_CONSTANT_BASELINE_LOG_LOSS,
      constantBaselineBrier: SEALED_CONSTANT_BASELINE_BRIER,
      AUC_PASS: true,
      LOGLOSS_PASS: false,
      BRIER_PASS: false,
      modelCandidate: false,
    },
    rankingSignalEvidence: {
      v2cTrainAuc2024: SEALED_V2C_TRAIN_AUC_2024,
      v2cValidationAuc2024: SEALED_V2C_VALIDATION_AUC_2024,
      v2cExternalAuc2025: SEALED_2025_ROC_AUC,
    },
    lessons: {
      lesson1: WEAK_INDEPENDENT_RANKING_SIGNAL_EXISTS,
      lesson2: CURRENT_PROBABILITY_MODEL_QUALITY,
      lesson3: REPEATED_SAFE_A_FEATURE_PRUNING,
      lesson4OmittedInformationFamiliesAreHypotheses: true,
    },
    rejectedImmediateDirections: {
      continuePruningCurrentSafeAAsDefault: true,
      postHocCalibrateV2cOn2025: true,
      moveImmediatelyToMoreComplexMlModel: true,
    },
    omittedInformationFamilyHypotheses: [
      "STARTER",
      "BULLPEN",
      "LINEUP",
      "INJURY_AVAILABILITY",
      "PARK_VENUE_CONTEXT",
      "WEATHER_WHERE_LEGALLY_RELIABLY_AVAILABLE",
      "PLAYER_LEVEL_CONTEXT",
    ],
    classBFeatureProgram: {
      status: "PROPOSED_NOT_STARTED",
      candidateFamilies: [
        "STARTER_CONTEXT",
        "BULLPEN_CONTEXT",
        "LINEUP_CONTEXT",
        "PLAYER_AVAILABILITY",
        "PARK_CONTEXT",
        "WEATHER_CONTEXT",
      ],
      requiredContractFields: [
        "sourceLegality",
        "sourceProvider",
        "availableAt",
        "asOf",
        "pregameDeadline",
        "historicalReconstructability",
        "missingnessPolicy",
        "currentDayAvailability",
        "earlyVsLateOnlyClassification",
        "leakageRisk",
      ],
      noFeatureEntersModelBeforeContract: true,
    },
    productTiming: {
      preserveEarlyAnalysis: true,
      preserveLateUpdate: true,
      preserveFinalSnapshot: true,
      initialUsefulAnalysisTarget: "NEAR_T_MINUS_3H",
      laterExpansionTarget: "TOWARD_T_MINUS_6H_WHERE_EVIDENCE_SUPPORTS",
      featureAvailabilityClasses: [
        "EARLY_SAFE",
        "LATE_ONLY",
        "NOT_RELIABLY_RECONSTRUCTABLE",
      ],
    },
    researchOrder: [
      "PHASE_A_2023_HISTORICAL_SOURCE_FOUNDATION",
      "PHASE_B_2023_SAFE_A_FEATURE_LABEL_JOIN",
      "PHASE_C_MULTI_SEASON_SAFE_A_STABILITY_DISTRIBUTION_AUDIT",
      "PHASE_D_CLASS_B_PREGAME_FEATURE_CONTRACT_V1",
      "PHASE_E_HISTORICAL_CLASS_B_FEASIBILITY_COVERAGE_AUDIT",
      "PHASE_F_NEW_MODEL_HYPOTHESIS_PREREGISTRATION",
      "PHASE_G_NEW_PROTOTYPE_TRAINING",
    ],
    noModelBeforePhaseF: true,
    nextModelStartGates: {
      additionalHistoricalSeasonFoundationSealed: false,
      multiSeasonIdentityLeakageChecksPass: false,
      featureAvailabilityContractsDefined: false,
      candidateNewFeatureGroupsJustified: false,
      trainingValidationChronologyPredefined: false,
      futureUntouchedEvaluationStrategyDefined: false,
      holdoutPolicyExplicitlyResolved: false,
    },
    holdoutGovernance: {
      remainsSealed: true,
      automaticAssignmentToFutureSuccessor: false,
      successorRequiresFormalLineageBeforeHoldoutProtocol: true,
    },
    exposed2025Governance: {
      state: EXTERNAL_REPLICATION_EXPOSED_STATE,
      mayBeUsedLaterOnlyAsLabeledExploratoryPostExposureResearch: true,
      mustNeverBeDescribedAsIndependentValidation: true,
      immediateRowLevelDiagnosticAllowed: false,
    },
    candidateReviewPrimaryReason: V2C_CANDIDATE_PRIMARY_REASON,
    evaluationArtifactSha256: MLB_INDEPENDENT_2025_SEALED_V2C_EVALUATION_SHA256,
    candidateReviewArtifactSha256:
      MLB_INDEPENDENT_2025_SEALED_V2C_CANDIDATE_REVIEW_SHA256,
    v2cModelCoreHash: MLB_INDEPENDENT_2025_SEALED_V2C_MODEL_CORE_HASH,
  };

  const reviewArtifactSha256 = hashPostV2cResearchDirectionReviewV1(review);
  const audit: PostV2cResearchDirectionAuditV1 = {
    generatedAt,
    researchOnly: true,
    stage: POST_V2C_RESEARCH_DIRECTION_STAGE,
    engineAdmission: MLB_INDEPENDENT_ENGINE_ADMISSION,
    modelTrained: false,
    modelEvaluated: false,
    "2025RowsInspected": false,
    "2025PostExposureDiagnosticPerformed": false,
    holdoutEvaluated: false,
    engineChanged: false,
    recommendationChanged: false,
    networkUsed: false,
    v2cCycleClosed: true,
    newModelTrainingAllowedNow: false,
    immediateV2d: false,
    calibrateV2cOn2025: false,
    reviewArtifactSha256,
    evaluationArtifactSha256: MLB_INDEPENDENT_2025_SEALED_V2C_EVALUATION_SHA256,
    candidateReviewArtifactSha256:
      MLB_INDEPENDENT_2025_SEALED_V2C_CANDIDATE_REVIEW_SHA256,
  };

  return { review, audit };
}

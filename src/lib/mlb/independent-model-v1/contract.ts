/**
 * MLB Independent Training Dataset Contract v1.
 *
 * CONTRACT_READY only. Does not materialize rows, train, or predict.
 * Independent of prediction-v0 (market-assisted) and LEGACY_V1 (rule-v1).
 *
 * This module must not import prediction-v0, edge, recommendations,
 * grading/review, or official-result builders.
 */

export const MLB_INDEPENDENT_CONTRACT_STATUS = "CONTRACT_READY" as const;
export const MLB_INDEPENDENT_MODEL_SAMPLE = 0 as const;
export const MLB_INDEPENDENT_DATASET_READY = false;
export const MLB_INDEPENDENT_ENGINE_ADMISSION = "PROHIBITED" as const;

export const MLB_INDEPENDENT_FEATURE_SCHEMA_V1 =
  "mlb-independent-feature-artifact-v1" as const;
export const MLB_INDEPENDENT_FEATURE_ROW_SCHEMA_V1 =
  "mlb-independent-feature-row-v1" as const;
export const MLB_INDEPENDENT_FEATURE_BUILDER_VERSION =
  "mlb-independent-feature-contract-v1" as const;

export const MLB_INDEPENDENT_LABEL_SCHEMA_V1 =
  "mlb-independent-label-artifact-v1" as const;
export const MLB_INDEPENDENT_LABEL_ROW_SCHEMA_V1 =
  "mlb-independent-label-row-v1" as const;
export const MLB_INDEPENDENT_LABEL_BUILDER_VERSION =
  "mlb-independent-label-contract-v1" as const;

/**
 * Class A — SAFE_HISTORICALLY_RECONSTRUCTABLE.
 * Eligibility is the data window, not when reconstruction ran.
 * statsThroughDate <= officialDate - 1 day. Same officialDate (incl. DH) excluded.
 */
export const MLB_INDEPENDENT_CLASS_A_TEMPORAL_POLICY_V1 =
  "HISTORICAL_RECONSTRUCTION_D1" as const;

/**
 * Class B — SAFE_ONLY_WITH_PREGAME_PROVENANCE.
 * Requires sourceTimestamp < cutoffTime. UNKNOWN must not be promoted to TRUE_PREGAME_OBSERVATION.
 * Not admitted in Independent v1 Core.
 */
export const MLB_INDEPENDENT_CLASS_B_TEMPORAL_POLICY_V1 =
  "TRUE_PREGAME_SOURCE_BEFORE_CUTOFF" as const;

export const MLB_INDEPENDENT_CLASS_B_ADMITTED_IN_V1_CORE = false;

/** v1 Core rows/artifacts use Class A policy only. */
export const MLB_INDEPENDENT_TEMPORAL_POLICY_V1 =
  MLB_INDEPENDENT_CLASS_A_TEMPORAL_POLICY_V1;

export const MLB_INDEPENDENT_IDENTITY_KEY_V1 = "gamePk" as const;

export const MLB_INDEPENDENT_TARGET_V1 = "HOME_WIN" as const;
export const MLB_INDEPENDENT_HOME_WIN = 1 as const;
export const MLB_INDEPENDENT_AWAY_WIN = 0 as const;
export const MLB_INDEPENDENT_LABEL_SOURCE_V1 =
  "official-result-artifact" as const;

export type FeatureClass =
  | "SAFE_HISTORICALLY_RECONSTRUCTABLE"
  | "SAFE_ONLY_WITH_PREGAME_PROVENANCE"
  | "PROHIBITED_OR_LABEL_ONLY";

/**
 * HISTORICAL_RECONSTRUCTION = Class A data-window provenance.
 * TRUE_PREGAME_OBSERVATION = Class B live/pregame capture (not v1 Core).
 * UNKNOWN must never be promoted to TRUE_PREGAME_OBSERVATION.
 */
export type TemporalPhase =
  | "HISTORICAL_RECONSTRUCTION"
  | "TRUE_PREGAME_OBSERVATION"
  | "UNKNOWN";

export type MlbIndependentLabelStatus =
  | "FINAL"
  | "NOT_FINAL"
  | "POSTPONED"
  | "CANCELLED"
  | "SUSPENDED"
  | "UNKNOWN";

export type MlbIndependentWinner = "HOME" | "AWAY" | "DRAW";

export const MLB_INDEPENDENT_FEATURE_CLASS_A_V1 = [
  "gamesPlayedBefore",
  "winsBefore",
  "lossesBefore",
  "winRateBefore",
  "last5WinsBefore",
  "last5LossesBefore",
  "last5WinRateBefore",
  "runsScoredAverageBefore",
  "runsAllowedAverageBefore",
  "last5RunsScoredAverageBefore",
  "last5RunsAllowedAverageBefore",
  "homeWinRateBefore",
  "awayWinRateBefore",
  "currentWinStreakBefore",
  "currentLossStreakBefore",
  "restDaysBefore",
  "headToHeadGamesBefore",
  "headToHeadHomeWinsBefore",
  "headToHeadAwayWinsBefore",
] as const;

export const MLB_INDEPENDENT_FEATURE_CLASS_B_V1 = [
  "probableStartingPitcherIdentity",
  "starterPregameSeasonStats",
  "confirmedLineup",
  "injury",
  "bullpenAvailability",
  "weatherForecast",
  "playerContext",
] as const;

export const MLB_INDEPENDENT_FEATURE_CLASS_C_V1 = [
  "marketOdds",
  "marketImpliedProbability",
  "devigProbability",
  "marketFavorite",
  "marketPrior",
  "modelMarketEdge",
  "valueEdge",
  "closingOdds",
  "actualFinalScore",
  "actualWinner",
  "officialResultStatus",
  "postgameStarterIdentity",
  "postgameLineup",
  "grade",
  "successFailureReview",
  "postgameAnnotations",
  "targetGameBoxscoreStatistics",
] as const;

/**
 * Object keys that must never appear anywhere in a feature row/artifact.
 * Matching is case/separator-insensitive (see normalizeFeatureKeyToken).
 * Existence is forbidden even if the value is 0 / null / unused.
 */
export const MLB_INDEPENDENT_PROHIBITED_FEATURE_KEYS_V1 = [
  "market",
  "odds",
  "devig",
  "marketOdds",
  "marketProbability",
  "marketPrior",
  "valueEdge",
  "modelEdge",
  "modelMarketEdge",
  "closingOdds",
  "finalScore",
  "homeScore",
  "awayScore",
  "actualWinner",
  "winner",
  "grade",
  "resultStatus",
] as const;

export const MLB_INDEPENDENT_LABEL_ELIGIBLE_STATUS_V1 = "FINAL" as const;
export const MLB_INDEPENDENT_LABEL_ELIGIBLE_WINNERS_V1 = [
  "HOME",
  "AWAY",
] as const;
export const MLB_INDEPENDENT_LABEL_EXCLUDED_STATUS_V1 = [
  "NOT_FINAL",
  "POSTPONED",
  "CANCELLED",
  "SUSPENDED",
  "UNKNOWN",
] as const;
export const MLB_INDEPENDENT_LABEL_EXCLUDED_WINNERS_V1 = ["DRAW"] as const;

export const MLB_INDEPENDENT_PIPELINE_STAGES_V1 = [
  "HISTORICAL_SOURCE",
  "FEATURE_FREEZE",
  "FEATURE_ARTIFACT_SEALED",
  "RESULT_LABEL_LOAD",
  "LABEL_ARTIFACT",
  "TRAINING_JOIN",
  "TRAIN_VALIDATION_HOLDOUT",
] as const;

/** Join builder is not implemented in this mission. Contract only. */
export const MLB_INDEPENDENT_JOIN_CONTRACT_V1 = {
  joinImplemented: false,
  identityKey: MLB_INDEPENDENT_IDENTITY_KEY_V1,
  supplementalIdentity: [
    "officialDate",
    "homeTeamId",
    "awayTeamId",
    "commenceTimeUtc",
  ] as const,
  mismatchPolicy: "BLOCK" as const,
  preserveFeatureHash: true,
  featureBuilderMustNotImportLabel: true,
  labelBuilderMustNotMutateFeatures: true,
  forbiddenIdentityRecovery: [
    "teamNameFuzzyMatching",
    "nearestKickoffGuessing",
    "resultScoreIdentityRecovery",
  ] as const,
};

export const MLB_INDEPENDENT_SPLIT_CONTRACT_V1 = {
  randomRowSplitAllowed: false,
  chronologicalSplitRequired: true,
  splitBuilderImplemented: false,
} as const;

export type MlbIndependentIdentityV1 = {
  gamePk: number;
  officialDate: string;
  homeTeamId: number;
  awayTeamId: number;
  commenceTimeUtc: string;
};

export type MlbIndependentTeamSideFeaturesV1 = {
  gamesPlayedBefore: number;
  winsBefore: number;
  lossesBefore: number;
  winRateBefore: number | null;
  last5WinsBefore: number | null;
  last5LossesBefore: number | null;
  last5WinRateBefore: number | null;
  runsScoredAverageBefore: number | null;
  runsAllowedAverageBefore: number | null;
  last5RunsScoredAverageBefore: number | null;
  last5RunsAllowedAverageBefore: number | null;
  homeWinRateBefore: number | null;
  awayWinRateBefore: number | null;
  currentWinStreakBefore: number;
  currentLossStreakBefore: number;
  restDaysBefore: number | null;
};

export type FeatureHashStatus = "UNSEALED" | "STRUCTURALLY_VALID_CANDIDATE";

export type MlbIndependentFeatureRowV1 = {
  schemaVersion: typeof MLB_INDEPENDENT_FEATURE_ROW_SCHEMA_V1;
  identity: MlbIndependentIdentityV1;
  featureClass: "SAFE_HISTORICALLY_RECONSTRUCTABLE";
  temporalPolicy: typeof MLB_INDEPENDENT_CLASS_A_TEMPORAL_POLICY_V1;
  temporalPhase: "HISTORICAL_RECONSTRUCTION";
  /** Inclusive last officialDate whose completed games may enter features. */
  statsThroughDate: string;
  /**
   * DATA_CUTOFF / STATS_AS_OF — calendar date of last included history.
   * Must match statsThroughDate. Not reconstruction wall-clock. Not live capture.
   */
  asOf: string;
  /**
   * Not used for Class A eligibility. Reserved for Class B
   * TRUE_PREGAME_SOURCE_BEFORE_CUTOFF (sourceTimestamp < cutoffTime).
   */
  cutoffTime: string | null;
  home: MlbIndependentTeamSideFeaturesV1;
  away: MlbIndependentTeamSideFeaturesV1;
  headToHeadGamesBefore: number;
  headToHeadHomeWinsBefore: number;
  headToHeadAwayWinsBefore: number;
  /**
   * null = UNSEALED / NOT_YET_MATERIALIZED.
   * 64-char lowercase hex = structurally valid candidate hash only.
   * Authenticity is proven only by a future builder/join verifier, not this validator.
   */
  featureHash: string | null;
};

export type MlbIndependentFeatureArtifactV1 = {
  schemaVersion: typeof MLB_INDEPENDENT_FEATURE_SCHEMA_V1;
  builderVersion: typeof MLB_INDEPENDENT_FEATURE_BUILDER_VERSION;
  researchOnly: true;
  independentModelSample: 0;
  engineAdmission: typeof MLB_INDEPENDENT_ENGINE_ADMISSION;
  datasetReady: false;
  temporalPolicy: typeof MLB_INDEPENDENT_CLASS_A_TEMPORAL_POLICY_V1;
  featureClass: "SAFE_HISTORICALLY_RECONSTRUCTABLE";
  writeOnce: true;
  rows: MlbIndependentFeatureRowV1[];
};

export type MlbIndependentLabelRowV1 = {
  schemaVersion: typeof MLB_INDEPENDENT_LABEL_ROW_SCHEMA_V1;
  identity: MlbIndependentIdentityV1;
  status: "FINAL";
  winner: "HOME" | "AWAY";
  target: typeof MLB_INDEPENDENT_HOME_WIN | typeof MLB_INDEPENDENT_AWAY_WIN;
  labelSource: typeof MLB_INDEPENDENT_LABEL_SOURCE_V1;
};

export type MlbIndependentLabelArtifactV1 = {
  schemaVersion: typeof MLB_INDEPENDENT_LABEL_SCHEMA_V1;
  builderVersion: typeof MLB_INDEPENDENT_LABEL_BUILDER_VERSION;
  researchOnly: true;
  independentModelSample: 0;
  engineAdmission: typeof MLB_INDEPENDENT_ENGINE_ADMISSION;
  datasetReady: false;
  target: typeof MLB_INDEPENDENT_TARGET_V1;
  labelSource: typeof MLB_INDEPENDENT_LABEL_SOURCE_V1;
  rows: MlbIndependentLabelRowV1[];
};

export const MLB_INDEPENDENT_IDENTITY_KEYS_V1 = [
  "gamePk",
  "officialDate",
  "homeTeamId",
  "awayTeamId",
  "commenceTimeUtc",
] as const;

export const MLB_INDEPENDENT_TEAM_SIDE_KEYS_V1 = [
  "gamesPlayedBefore",
  "winsBefore",
  "lossesBefore",
  "winRateBefore",
  "last5WinsBefore",
  "last5LossesBefore",
  "last5WinRateBefore",
  "runsScoredAverageBefore",
  "runsAllowedAverageBefore",
  "last5RunsScoredAverageBefore",
  "last5RunsAllowedAverageBefore",
  "homeWinRateBefore",
  "awayWinRateBefore",
  "currentWinStreakBefore",
  "currentLossStreakBefore",
  "restDaysBefore",
] as const;

export const MLB_INDEPENDENT_FEATURE_ROW_KEYS_V1 = [
  "schemaVersion",
  "identity",
  "featureClass",
  "temporalPolicy",
  "temporalPhase",
  "statsThroughDate",
  "asOf",
  "cutoffTime",
  "home",
  "away",
  "headToHeadGamesBefore",
  "headToHeadHomeWinsBefore",
  "headToHeadAwayWinsBefore",
  "featureHash",
] as const;

export const MLB_INDEPENDENT_FEATURE_ARTIFACT_KEYS_V1 = [
  "schemaVersion",
  "builderVersion",
  "researchOnly",
  "independentModelSample",
  "engineAdmission",
  "datasetReady",
  "temporalPolicy",
  "featureClass",
  "writeOnce",
  "rows",
] as const;

export const MLB_INDEPENDENT_LABEL_ROW_KEYS_V1 = [
  "schemaVersion",
  "identity",
  "status",
  "winner",
  "target",
  "labelSource",
] as const;

export const MLB_INDEPENDENT_LABEL_ARTIFACT_KEYS_V1 = [
  "schemaVersion",
  "builderVersion",
  "researchOnly",
  "independentModelSample",
  "engineAdmission",
  "datasetReady",
  "target",
  "labelSource",
  "rows",
] as const;

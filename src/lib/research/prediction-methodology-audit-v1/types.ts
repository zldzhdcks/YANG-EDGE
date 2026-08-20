/**
 * YANG EDGE Prediction Methodology Audit v1 — types.
 * Read-only classification of historical MLB / Football prediction artifacts.
 */

export const PREDICTION_METHODOLOGY_AUDIT_V1_SCHEMA =
  "yang-edge-prediction-methodology-audit-v1" as const;

export const PREDICTION_METHODOLOGY_AUDIT_V1_BUILDER =
  "prediction-methodology-audit-builder-v1" as const;

export type MethodologyClass =
  | "INDEPENDENT_STATISTICAL"
  | "LEGACY_HEURISTIC"
  | "MARKET_ASSISTED"
  | "MARKET_BASELINE"
  | "INSUFFICIENT_INPUT"
  | "BLOCKED";

export type MarketRole =
  | "Display only"
  | "Benchmark only"
  | "Feature"
  | "Probability input"
  | "Recommendation gate";

export type FeatureStage =
  | "NONE"
  | "PROVIDER_OR_REPO"
  | "DATASET"
  | "PREGAME_FEATURE"
  | "PREDICTION_USED";

export type ExplainabilitySupport = "SUPPORTED" | "PARTIAL" | "NOT_SUPPORTED";

export type HistoricalPredictionRow = {
  sport: "MLB" | "FOOTBALL";
  date: string;
  artifactRel: string;
  artifactKind: string;
  modelVersion: string | null;
  modelStatus: string | null;
  contract: string;
  numberOfGames: number;
  predictedGames: number | null;
  officialPickCount: number;
  actualPredictionInputs: string[];
  marketPriorUsed: boolean;
  marketProbabilityDisplayed: boolean;
  marketInProbabilityFormula: boolean;
  playerLevelDataUsed: boolean;
  lineupPlayerStatsUsed: boolean;
  starterAdvancedStatsUsed: boolean;
  bullpenDataUsed: boolean;
  teamAdvancedStatsUsed: boolean;
  classification: MethodologyClass;
  classificationReason: string;
};

export type FeatureUtilizationRow = {
  sport: "MLB" | "FOOTBALL";
  category: string;
  data: string;
  providerOrSource: string;
  collected: boolean | "UNKNOWN";
  stored: boolean | "UNKNOWN";
  feature: boolean;
  prediction: boolean;
  stage: FeatureStage;
  gap: string;
};

export type MarketDependenceRow = {
  sport: "MLB" | "FOOTBALL";
  item: string;
  path: string;
  roles: MarketRole[];
  evidence: string;
};

export type ExplainabilityRow = {
  question: string;
  mlb: ExplainabilitySupport;
  football: ExplainabilitySupport;
  evidence: string;
};

export type PredictionMethodologyAuditV1 = {
  schemaVersion: typeof PREDICTION_METHODOLOGY_AUDIT_V1_SCHEMA;
  builderVersion: typeof PREDICTION_METHODOLOGY_AUDIT_V1_BUILDER;
  generatedAt: string;
  researchOnly: true;
  mutation: {
    predictionSnapshotsModified: 0;
    engineWeightsModified: 0;
    predictionLogicModified: 0;
    providerCalls: 0;
  };
  gitBefore: {
    branch: string;
    head: string;
    originMain: string;
    ahead: number;
    behind: number;
    statusPorcelain: string[];
  };
  independentStatisticalModelExists: false;
  independentModelSample: 0;
  currentPredictionReality: {
    mlb: string;
    football: string;
    independentModel: string;
  };
  historical: HistoricalPredictionRow[];
  classificationCounts: Record<MethodologyClass, number>;
  mlbFeatureUtilization: FeatureUtilizationRow[];
  footballFeatureUtilization: FeatureUtilizationRow[];
  providerGaps: FeatureUtilizationRow[];
  marketDependence: MarketDependenceRow[];
  explainability: ExplainabilityRow[];
  scorecardRecommendation: {
    doNotRewriteHistoricalScorecards: true;
    separateTracks: string[];
    startIndependentSampleAtZero: true;
    reason: string;
  };
  leakageAudit: {
    resultUsedAsPregameFeature: false;
    predictionV0LoadsResultArtifacts: false;
    notes: string[];
  };
};

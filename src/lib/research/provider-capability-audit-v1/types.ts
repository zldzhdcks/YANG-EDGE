/**
 * Paid Provider Player Data Capability & Intake Audit v1.
 * Research only. No Engine weights. Independent model sample stays 0.
 */

export const PROVIDER_CAPABILITY_AUDIT_V1_SCHEMA =
  "yang-edge-provider-capability-audit-v1" as const;

export const PROVIDER_CAPABILITY_AUDIT_V1_BUILDER =
  "provider-capability-audit-builder-v1" as const;

export type EvidenceGrade = "A" | "B" | "C" | "D";

export type FeatureAvailability =
  | "AVAILABLE_CURRENT_PROVIDER"
  | "AVAILABLE_DIFFERENT_ENDPOINT"
  | "AVAILABLE_HIGHER_PLAN"
  | "AVAILABLE_OTHER_PROVIDER"
  | "STORED_ALREADY"
  | "NOT_STORED"
  | "NOT_AVAILABLE"
  | "UNKNOWN"
  | "NEEDS_PROVIDER_DOC_REVIEW";

export type BuildVsBuy =
  | "BUILD_FROM_EXISTING_RAW"
  | "BUY_PROVIDER"
  | "DERIVE_FROM_EXISTING_HISTORY"
  | "NOT_CURRENTLY_FEASIBLE";

export type IntakePriority = "P0" | "P1" | "P2" | "P3" | "NONE";

export type LicenseClass =
  | "PRIVATE_RESEARCH_OK"
  | "PUBLIC_DISPLAY_REQUIRES_REVIEW"
  | "REDISTRIBUTION_RESTRICTED"
  | "COMMERCIAL_LICENSE_REQUIRED"
  | "UNKNOWN";

export type GapMatrixRow = {
  sport: "MLB" | "FOOTBALL" | "BASKETBALL" | "VOLLEYBALL" | "MULTI";
  category: string;
  feature: string;
  provider: string;
  availability: FeatureAvailability;
  currentPlanKnown: boolean | "CURRENT_PLAN_UNKNOWN";
  stored: boolean;
  pregameDataset: boolean;
  featureReady: boolean;
  predictionUsed: boolean;
  evidenceGrade: EvidenceGrade;
  evidence: string;
  gap: string;
  buildVsBuy: BuildVsBuy;
  intakePriority: IntakePriority;
  sampleConcern: string;
  leakageNote: string;
};

export type ProviderInventoryRow = {
  id: string;
  officialName: string;
  sports: string[];
  repositoryIntegration: boolean;
  apiKeyRequired: boolean;
  currentCodePath: string;
  researchSourceOfTruth: boolean;
  historicalSupport: string;
  livePregameSupport: string;
  playerDataSupport: string;
  advancedDataSupport: string;
  pricingPlanVisibility: string;
  licenseNote: string;
  licenseClass: LicenseClass;
};

export type MlbStatsApiProbeEvidence = {
  executed: true;
  paidCalls: 0;
  httpAttempts: number;
  httpSuccess: number;
  httpFailed: number;
  note: string;
  statTypesObserved: string[];
  situationCodesOfInterest: string[];
  hittingGameLogStatKeys: string[];
  sabermetricsHittingKeys: string[];
  sabermetricsPitchingKeys: string[];
  expectedStatisticsKeys: string[];
  seasonAdvancedHittingKeys: string[];
  statSplitsSitCodesReturned: string[];
  statSplitsStatKeys: string[];
  pitchArsenalKeys: string[];
  pitchArsenalTypesObserved: string[];
  trackingHittingSplits: number;
  metricAveragesHttpStatus: number;
};

export type ProviderCapabilityAuditV1 = {
  schemaVersion: typeof PROVIDER_CAPABILITY_AUDIT_V1_SCHEMA;
  builderVersion: typeof PROVIDER_CAPABILITY_AUDIT_V1_BUILDER;
  generatedAt: string;
  researchOnly: true;
  independentModelSample: 0;
  marketInIndependentProbability: false;
  engineAdmission: "PROHIBITED";
  mutation: {
    predictionSnapshotsModified: 0;
    engineWeightsModified: 0;
    predictionLogicModified: 0;
    scorecardModified: 0;
    paidProviderCalls: 0;
  };
  gitBefore: {
    branch: string;
    head: string;
    originMain: string;
    ahead: number;
    behind: number;
    statusPorcelain: string[];
  };
  previousAudits: {
    methodology: string;
    playerCondition: string;
  };
  probe: {
    paidApis: "NOT_EXECUTED";
    paidReason: string;
    mlbStatsApiPublic: MlbStatsApiProbeEvidence;
  };
  providers: ProviderInventoryRow[];
  rows: GapMatrixRow[];
  availabilityCounts: Record<FeatureAvailability, number>;
  buildVsBuyCounts: Record<BuildVsBuy, number>;
  intakeCounts: Record<IntakePriority, number>;
};

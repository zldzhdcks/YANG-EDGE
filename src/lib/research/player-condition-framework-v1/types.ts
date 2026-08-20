/**
 * Player Condition / Matchup / Environment research types.
 * Design only — no Engine weights, no prediction writes.
 */

export const PLAYER_CONDITION_FRAMEWORK_V1 =
  "yang-edge-player-condition-research-framework-v1" as const;

export const PLAYER_CONDITION_AUDIT_V1_SCHEMA =
  "yang-edge-player-condition-feature-audit-v1" as const;

export const PLAYER_CONDITION_AUDIT_V1_BUILDER =
  "player-condition-feature-audit-builder-v1" as const;

/** Highest stage reached. UNKNOWN / NOT_AVAILABLE / NEEDS_PROVIDER_DOC_REVIEW are terminal. */
export type FeatureAvailabilityStage =
  | "PREDICTION_USED"
  | "FEATURE_READY"
  | "STORED"
  | "AVAILABLE_PROVIDER"
  | "NOT_AVAILABLE"
  | "UNKNOWN"
  | "NEEDS_PROVIDER_DOC_REVIEW";

export type AvailabilityStatus =
  | "CONFIRMED_STARTER"
  | "EXPECTED_STARTER"
  | "BENCH"
  | "INJURED"
  | "SUSPENDED"
  | "QUESTIONABLE"
  | "LIMITED"
  | "RETURN_FROM_INJURY"
  | "MINUTES_OR_PITCH_RESTRICTION"
  | "REST_POSSIBILITY"
  | "UNKNOWN";

export type SplitReliabilityMeta = {
  sampleSize: number | null;
  window: string | null;
  populationBaseline: number | null;
  playerBaseline: number | null;
  splitValue: number | null;
  baselineDelta: number | null;
  reliability: "INSUFFICIENT" | "PROVISIONAL" | "USABLE" | "UNKNOWN";
  shrinkRequired: boolean;
  /** Must stay undefined until a later validation mission. */
  shrinkCoefficient: undefined;
};

export type TodayAdjustedPlayerStrengthDesign = {
  formula:
    | "BaseStrength + RecentConditionAdjustment + MatchupAdjustment + AvailabilityAdjustment + WorkloadAdjustment + EnvironmentAdjustment";
  weights: "UNDEFINED";
  marketInputsAllowed: false;
  notes: string[];
};

export type PlayerKeyDriver = {
  playerId: string | null;
  playerName: string | null;
  category:
    | "BASE_STRENGTH"
    | "RECENT_CONDITION"
    | "AVAILABILITY"
    | "LINEUP"
    | "MATCHUP"
    | "WORKLOAD"
    | "ENVIRONMENT";
  direction: "HOME" | "AWAY" | "NEUTRAL";
  feature: string;
  baseline: number | null;
  todayValue: number | null;
  matchup: string | null;
  sampleSize: number | null;
  reliability: SplitReliabilityMeta["reliability"];
  explanation: string;
};

export type FeatureCatalogRow = {
  sport: "MLB" | "FOOTBALL" | "BASKETBALL" | "VOLLEYBALL";
  category: string;
  feature: string;
  provider: string;
  stage: FeatureAvailabilityStage;
  stored: boolean;
  pregameSafe: boolean | "UNKNOWN";
  sampleConcern: string;
  futureResearch: string;
  evidence: string;
};

export type PlayerConditionFeatureAuditV1 = {
  schemaVersion: typeof PLAYER_CONDITION_AUDIT_V1_SCHEMA;
  builderVersion: typeof PLAYER_CONDITION_AUDIT_V1_BUILDER;
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
  previousMethodologyAuditCommit: string;
  marketInPlayerStrength: false;
  independentModelSample: 0;
  weights: "UNDEFINED";
  todayAdjustedPlayerStrength: TodayAdjustedPlayerStrengthDesign;
  availabilityStatuses: AvailabilityStatus[];
  shrinkagePolicy: {
    observedSplitThenReliabilityThenShrink: true;
    coefficientsFrozen: false;
    smallSampleSpecialistForbidden: true;
  };
  mlbCacheEvidence: {
    note: string;
    pitchingGameLogObservedKeys: string[];
    personObservedKeys: string[];
    scheduleObservedKeys: string[];
    boxGameBattingObservedKeys: string[];
    venueFieldInfoObservedKeys: string[];
    venueLocationObservedKeys: string[];
    hittingGameLogFetched: false;
    seasonHittingObservedInPregameBoxscoreSample: false;
    scheduleWeatherHydratedInSample: false;
  };
  rows: FeatureCatalogRow[];
  stageCounts: Record<FeatureAvailabilityStage, number>;
};

/**
 * Current-date research target scope lock v1.
 *
 * Defines WHICH games are research targets for an explicit KST date.
 * Does not collect evidence, predict, pass, or publish.
 */
export const RESEARCH_TARGET_SCOPE_LOCK_MECHANISM =
  "research-target-scope-lock-v1" as const;

/** Compatible historical schema name used by Daily C Stage A artifacts. */
export const DAILY_SCOPE_LOCK_SCHEMA_VERSION =
  "yang-edge-daily-scope-lock-v1" as const;

export const RESEARCH_TARGET_SCOPE_LOCK_POLICY_VERSION =
  "research-target-admission-v1" as const;

export type ResearchTargetScopeStatus =
  | "LOCKED"
  | "IDEMPOTENT_EXISTING"
  | "TARGET_SCOPE_SOURCE_MISSING"
  | "TARGET_SCOPE_SOURCE_INVALID"
  | "TARGET_SCOPE_NO_ADMISSIBLE_TARGETS"
  | "TARGET_SCOPE_CONFLICT"
  | "SCOPE_LOCK_CONFLICT";

export type DecisionCoverageStatus =
  | "COVERAGE_COMPLETE"
  | "COVERAGE_INCOMPLETE"
  | "TARGET_SCOPE_SOURCE_MISSING";

export type ResearchTargetSourceClass =
  | "OPERATOR_BETMAN_DAILY_SLATE"
  | "BETMAN_FULL_SLATE";

export type ResearchTargetExclusionReason =
  | "UNSUPPORTED_SPORT"
  | "REJECTED_REVIEW"
  | "MISSING_IDENTITY_FIELDS"
  | "DATE_MISMATCH"
  | "DUPLICATE_IDENTICAL"
  | "NOT_ADMITTED_BY_POLICY";

export type ResearchTargetGame = {
  targetId: string;
  operatorSlateGameId: string;
  sport: string;
  competitionNameRaw: string | null;
  homeTeamRaw: string;
  awayTeamRaw: string;
  scheduledStartTimeKst: string | null;
  providerGameId: string | null;
  providerFixtureId: string | null;
};

export type ResearchTargetExclusion = {
  operatorSlateGameId: string | null;
  sport: string | null;
  reason: ResearchTargetExclusionReason;
  detail?: string;
};

export type ResearchTargetScopeSourceRef = {
  class: ResearchTargetSourceClass;
  rel: string;
  sha256: string;
};

export type ResearchTargetScopeLockDocument = {
  schemaVersion: typeof DAILY_SCOPE_LOCK_SCHEMA_VERSION;
  lockMechanism: typeof RESEARCH_TARGET_SCOPE_LOCK_MECHANISM;
  policyVersion: typeof RESEARCH_TARGET_SCOPE_LOCK_POLICY_VERSION;
  dateKst: string;
  lockStatus: "LOCKED";
  scopeLockStatus: "COMPLETE" | "EMPTY_ADMISSIBLE";
  status: "LOCKED" | "TARGET_SCOPE_NO_ADMISSIBLE_TARGETS";
  createdAt: string;
  scopeLockedAt: string;
  source: ResearchTargetScopeSourceRef;
  targetCount: number;
  officialDenominator: number;
  targets: ResearchTargetGame[];
  exclusions: ResearchTargetExclusion[];
  sports: string[];
  observedScope: {
    total: number;
    bySport: Record<string, number>;
  };
  scopeShrinkAfterLockForbidden: true;
  researchOnly: true;
  prediction: "NONE";
  engine: "NONE";
  recommendation: "NONE";
  predictionInput: false;
  engineAdmission: "PROHIBITED";
  fuzzyMatchingUsed: false;
  invariant: "EVERY_LOCKED_TARGET_REQUIRES_EXACTLY_ONE_SEALED_PREDICTION_OR_PASS";
  note: string;
};

export type ResearchTargetScopeLockResult = {
  dateKst: string;
  status: ResearchTargetScopeStatus;
  lockCreated: boolean;
  targetCount: number | null;
  targetCountAuthoritative: boolean;
  excludedCount: number;
  outputPath: string | null;
  sourcePath: string | null;
  sourceStatus:
    | "FOUND"
    | "MISSING"
    | "INVALID"
    | "NO_ADMISSIBLE"
    | "CONFLICT";
  document: ResearchTargetScopeLockDocument | null;
  message: string;
};

export type DecisionCoverageResult = {
  status: DecisionCoverageStatus;
  lockedTargetCount: number | null;
  sealedDecisionCount: number;
  missingTargetIds: string[];
  unexpectedDecisionIds: string[];
  targetCountAuthoritative: boolean;
};
